/**
 * FFmpeg fast renderer - lossless stream copy for cuts-only edits.
 *
 * When a timeline has no captions, no title cards, no enhancements,
 * all transitions are "cut", and all clips reference the same source,
 * we can use FFmpeg concat with stream copy instead of Remotion.
 * This is ~50x faster and produces pixel-perfect output.
 */

import { spawn } from 'node:child_process';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CutSenseTimeline } from '@cutsense/core';

export interface FFmpegRenderOptions {
  onProgress?: (info: { renderedClips: number; totalClips: number; percent: number }) => void;
}

/**
 * Checks if a timeline can use the fast FFmpeg path.
 * Returns true only for simple cuts-only edits with no effects.
 */
export function canUseFastRender(timeline: CutSenseTimeline): boolean {
  if (!timeline.clips.length) return false;
  if (timeline.captions) return false;
  if (timeline.titleCards?.length) return false;
  if (timeline.editMode === 'enhanced') return false;

  const firstSrc = timeline.clips[0].src;

  for (const clip of timeline.clips) {
    // All clips must reference the same source file
    if (clip.src !== firstSrc) return false;
    // No speed changes
    if (clip.playbackRate && clip.playbackRate !== 1) return false;
    // No enhancements
    if (clip.isEnhanced) return false;
    // Only hard cuts (no fades)
    if (clip.transition?.type === 'fade') return false;
  }

  return true;
}

/**
 * Renders a cuts-only timeline using FFmpeg stream copy.
 * Produces lossless output - no re-encoding, original quality preserved.
 */
export async function renderWithFFmpeg(
  timeline: CutSenseTimeline,
  outputPath: string,
  options: FFmpegRenderOptions = {},
): Promise<string> {
  const fps = timeline.fps || 30;
  const srcPath = timeline.clips[0].src;
  const tmpDir = join(tmpdir(), `cutsense-ffmpeg-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  await mkdir(dirname(outputPath), { recursive: true });

  const segmentFiles: string[] = [];

  // Extract each clip as a separate segment
  for (let i = 0; i < timeline.clips.length; i++) {
    const clip = timeline.clips[i];
    const startSec = clip.startFrom / fps;
    const durationSec = clip.durationInFrames / fps;
    const segFile = join(tmpDir, `seg_${String(i).padStart(4, '0')}.mp4`);
    segmentFiles.push(segFile);

    await runFFmpeg([
      '-ss', startSec.toFixed(4),
      '-t', durationSec.toFixed(4),
      '-i', srcPath.replace(/\\/g, '/'),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      '-y', segFile.replace(/\\/g, '/'),
    ]);

    options.onProgress?.({
      renderedClips: i + 1,
      totalClips: timeline.clips.length,
      percent: Math.round(((i + 1) / timeline.clips.length) * 80),
    });
  }

  // Write concat list
  const listFile = join(tmpDir, 'concat.txt');
  const listContent = segmentFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  await writeFile(listFile, listContent, 'utf-8');

  // Concat all segments
  await runFFmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile.replace(/\\/g, '/'),
    '-c', 'copy',
    '-y', outputPath.replace(/\\/g, '/'),
  ]);

  options.onProgress?.({
    renderedClips: timeline.clips.length,
    totalClips: timeline.clips.length,
    percent: 100,
  });

  // Cleanup temp files
  for (const f of segmentFiles) {
    await unlink(f).catch(() => {});
  }
  await unlink(listFile).catch(() => {});

  return outputPath;
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}:\n${stderr.slice(-500)}`));
        return;
      }
      resolve();
    });

    child.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}
