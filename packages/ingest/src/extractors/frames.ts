/**
 * Frame extractor - calls the extract_frames.py sidecar script.
 */

import { mkdir } from 'fs/promises';
import type { FrameInfo } from '@cutsense/core';
import { ScriptRunner } from '../sidecar/runner.js';

export interface FrameExtractionOptions {
  /** Frames per second to extract. Defaults to 1. */
  fps?: number;
  /** Timeout in ms. Defaults to ScriptRunner default (10 min). */
  timeoutMs?: number;
}

interface RawFrameInfo {
  path: string;
  timestamp: number;
  frame_number: number;
  phash?: string;
  is_duplicate: boolean;
}

/**
 * Extracts frames from a video by calling the extract_frames.py sidecar.
 *
 * @param videoPath - absolute path to the source video
 * @param outputDir - directory where frame images will be written
 * @param options - extraction options
 * @returns array of FrameInfo objects
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  options: FrameExtractionOptions = {},
): Promise<FrameInfo[]> {
  await mkdir(outputDir, { recursive: true });

  const runner = new ScriptRunner();
  const fps = options.fps ?? 1;

  const raw = await runner.runScript<RawFrameInfo[]>(
    'extract_frames.py',
    [
      '--input', videoPath.replace(/\\/g, '/'),
      '--output', outputDir.replace(/\\/g, '/'),
      '--fps', String(fps),
    ],
    { timeoutMs: options.timeoutMs },
  );

  return raw.map((f) => ({
    path: f.path,
    timestamp: f.timestamp,
    frameNumber: f.frame_number,
    phash: f.phash,
    isDuplicate: f.is_duplicate,
  }));
}
