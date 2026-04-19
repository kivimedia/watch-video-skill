import http from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractAudio } from '@cutsense/ingest';
import { transcribe } from '@cutsense/ingest';
import { createJob, getJob } from '@cutsense/storage';
import { JobOrchestrator } from '@cutsense/agent';
import { createProvider } from '@cutsense/providers';
import type { ProviderName } from '@cutsense/core';

const execFileAsync = promisify(execFile);
const SERVICE_KEY = process.env['CUTSENSE_SERVICE_KEY'] ?? '';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!SERVICE_KEY) return true; // dev mode: no key required
  return req.headers['x-service-key'] === SERVICE_KEY;
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function readJSON<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body) as T); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
  send(res, status, { error: message });
}

// ─── FFmpeg helper (execFile = array args, no shell injection possible) ────────

async function ffmpegExec(args: string[]): Promise<void> {
  await execFileAsync('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * POST /transcribe
 * Body: { video_path: string, language?: string }
 * Returns full TranscriptResult (words with word-level timestamps from faster-whisper).
 * Used by TCE's weekly_transcriber pipeline step.
 */
async function handleTranscribe(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = await readJSON<{ video_path: string; language?: string }>(req);
  if (!body.video_path) { sendError(res, 400, 'video_path is required'); return; }

  const tmpDir = join(tmpdir(), `cutsense-transcribe-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    console.log(`[/transcribe] Extracting audio from ${body.video_path}`);
    const audioPath = await extractAudio(body.video_path, tmpDir);

    console.log(`[/transcribe] Running Whisper on ${audioPath}`);
    const result = await transcribe(audioPath, {
      language: body.language,
      timeoutMs: 30 * 60 * 1000, // 30 min budget for long walking videos
    });

    send(res, 200, result);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * POST /split
 * Body: { video_path: string, segments: Array<{ start_sec, end_sec, clip_name }>, output_dir: string }
 * Returns: { clips: Array<{ name, path }> }
 * Lossless FFmpeg stream-copy split - no re-encode. Used by weekly_clip_splitter.
 */
async function handleSplit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = await readJSON<{
    video_path: string;
    segments: Array<{ start_sec: number; end_sec: number; clip_name: string }>;
    output_dir: string;
  }>(req);

  if (!body.video_path || !body.segments?.length || !body.output_dir) {
    sendError(res, 400, 'video_path, segments[], and output_dir are required');
    return;
  }

  await mkdir(body.output_dir, { recursive: true });
  const clips: Array<{ name: string; path: string }> = [];

  for (const seg of body.segments) {
    const duration = seg.end_sec - seg.start_sec;
    if (duration <= 0) {
      sendError(res, 400, `Segment ${seg.clip_name} has non-positive duration`);
      return;
    }

    const outPath = join(body.output_dir, `${seg.clip_name}.mp4`);
    console.log(`[/split] ${seg.clip_name}: ${seg.start_sec.toFixed(2)}s-${seg.end_sec.toFixed(2)}s -> ${outPath}`);

    // execFile with array args - safe, no shell interpolation
    await ffmpegExec([
      '-ss', seg.start_sec.toFixed(4),
      '-t', duration.toFixed(4),
      '-i', body.video_path,
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      '-y', outPath,
    ]);

    clips.push({ name: seg.clip_name, path: outPath });
  }

  send(res, 200, { clips });
}

/**
 * POST /edit
 * Body: { clip_path, prompt, captions?, silence_cut_min_ms?, take_picker?, provider? }
 * Returns: { job_id } immediately. Pipeline runs async - poll GET /jobs/:id/status.
 * Used by TCE's weekly_clip_editor for each of the 5 per-clip edits.
 */
async function handleEdit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = await readJSON<{
    clip_path: string;
    prompt: string;
    captions?: 'none' | 'standard' | 'jumbo';
    silence_cut_min_ms?: number;
    take_picker?: 'vision_audio' | 'none';
    provider?: string;
  }>(req);

  if (!body.clip_path || !body.prompt) {
    sendError(res, 400, 'clip_path and prompt are required');
    return;
  }

  const job = await createJob(body.clip_path, {
    userInstruction: body.prompt,
    captionStyle: body.captions ?? 'jumbo',
    silenceCutMinMs: body.silence_cut_min_ms,
    takePicker: body.take_picker ?? 'vision_audio',
    provider: body.provider ?? 'anthropic',
  });

  // Respond with job_id before pipeline starts - TCE polls /jobs/:id/status
  send(res, 202, { job_id: job.id });

  const provider = createProvider((body.provider ?? 'anthropic') as ProviderName, undefined);
  const orchestrator = new JobOrchestrator({
    provider,
    userInstruction: body.prompt,
    captionStyle: body.captions ?? 'jumbo',
    onProgress: (stage, step, detail) => {
      console.log(`[/edit][${job.id}] [${stage}] ${step}${detail ? ': ' + detail : ''}`);
    },
  });

  orchestrator.run(job.id).catch((err: unknown) => {
    console.error(`[/edit] Job ${job.id} failed:`, err instanceof Error ? err.message : String(err));
  });
}

/**
 * GET /jobs/:id/status
 * Returns: { job_id, state, error?, output_path? }
 * Reads the CutSense state machine manifest. TCE polls this for each clip.
 */
async function handleJobStatus(
  res: http.ServerResponse,
  jobId: string,
): Promise<void> {
  try {
    const job = await getJob(jobId);
    const outputPath = job.state === 'render_done'
      ? join(job.jobDir, 'output', 'output.mp4')
      : undefined;
    send(res, 200, { job_id: job.id, state: job.state, error: job.error, output_path: outputPath });
  } catch {
    sendError(res, 404, `Job not found: ${jobId}`);
  }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (!isAuthorized(req)) {
      sendError(res, 401, 'Unauthorized');
      return;
    }

    try {
      if (method === 'POST' && url === '/transcribe') { await handleTranscribe(req, res); return; }
      if (method === 'POST' && url === '/split') { await handleSplit(req, res); return; }
      if (method === 'POST' && url === '/edit') { await handleEdit(req, res); return; }

      const jobMatch = /^\/jobs\/([^/]+)\/status$/.exec(url);
      if (method === 'GET' && jobMatch) { await handleJobStatus(res, jobMatch[1]!); return; }

      if (method === 'GET' && url === '/health') { send(res, 200, { ok: true }); return; }

      sendError(res, 404, `Unknown route: ${method} ${url}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cutsense-server] ${method} ${url} error:`, msg);
      sendError(res, 500, msg);
    }
  });
}
