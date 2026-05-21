/**
 * Gemini video preprocessing — downscale and frame-rate reduction via FFmpeg.
 *
 * Gemini consumes ~250-300 tokens per second of footage. Dropping a 1080p/30fps
 * clip to 720p/1fps keeps visual understanding intact while shrinking the
 * upload and the model's prompt budget by an order of magnitude.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type PreprocessHeight = 720 | 480 | 360;

export interface PreprocessOptions {
  /** Target vertical resolution. Width is scaled proportionally. */
  height?: PreprocessHeight;
  /** Output frames per second. 1 fps suits most extraction/logging tasks. */
  fps?: number;
  /** Constant Rate Factor — lower is higher quality. 28 is a good default. */
  crf?: number;
  /** Drop audio. Set false when audio transcription matters. */
  stripAudio?: boolean;
  /** Override output path; otherwise a tmp file is created. */
  outputPath?: string;
}

export interface PreprocessResult {
  /** Path to the re-encoded MP4. */
  outputPath: string;
  /** Size of the output file in bytes. */
  sizeBytes: number;
  /** FFmpeg arguments used, for logging/debugging. */
  args: string[];
}

/**
 * Build the FFmpeg argv for a preprocess job. Exposed for testing — the live
 * runner spawns this directly.
 */
export function buildPreprocessArgs(
  inputPath: string,
  outputPath: string,
  opts: PreprocessOptions = {},
): string[] {
  const height = opts.height ?? 720;
  const fps = opts.fps ?? 1;
  const crf = opts.crf ?? 28;
  const stripAudio = opts.stripAudio ?? false;

  const args = [
    '-y',
    '-i', inputPath,
    '-vf', `scale=-2:${height},fps=${fps}`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
  ];

  if (stripAudio) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', '96k');
  }

  args.push(outputPath);
  return args;
}

/**
 * Re-encode a video to a Gemini-friendly footprint. Returns the new path and
 * size; the caller owns cleanup of the temp file.
 */
export async function preprocessVideo(
  inputPath: string,
  opts: PreprocessOptions = {},
): Promise<PreprocessResult> {
  const outputPath = opts.outputPath ?? (await defaultOutputPath());
  const args = buildPreprocessArgs(inputPath.replace(/\\/g, '/'), outputPath, opts);

  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: process.platform === 'win32',
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}. stderr: ${stderr.slice(-500)}`));
      } else {
        resolve();
      }
    });
  });

  const { size } = await stat(outputPath);
  return { outputPath, sizeBytes: size, args };
}

async function defaultOutputPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cutsense-gemini-'));
  return join(dir, 'preprocessed.mp4');
}
