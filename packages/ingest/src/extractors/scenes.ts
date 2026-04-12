/**
 * Scene detector - calls the detect_scenes.py sidecar script.
 */

import type { SceneInfo } from '@cutsense/core';
import { ScriptRunner } from '../sidecar/runner.js';

export interface SceneDetectionOptions {
  /**
   * Content-detection threshold (0.0 - 1.0).
   * Lower values = more scene cuts detected. Defaults to 0.3.
   */
  threshold?: number;
  /** Timeout in ms. Defaults to ScriptRunner default (10 min). */
  timeoutMs?: number;
}

interface RawSceneInfo {
  id: string;
  start_time: number;
  end_time: number;
  start_frame: number;
  end_frame: number;
  duration: number;
}

/**
 * Detects scene boundaries in a video by calling the detect_scenes.py sidecar.
 *
 * @param videoPath - absolute path to the source video
 * @param options - detection options
 * @returns array of SceneInfo objects
 */
export async function detectScenes(
  videoPath: string,
  options: SceneDetectionOptions = {},
): Promise<SceneInfo[]> {
  const runner = new ScriptRunner();
  const threshold = options.threshold ?? 0.3;

  const result = await runner.runScript<{ scenes: RawSceneInfo[] }>(
    'detect_scenes.py',
    [
      '--input', videoPath.replace(/\\/g, '/'),
      '--threshold', String(threshold),
    ],
    { timeoutMs: options.timeoutMs },
  );

  const raw = result.scenes ?? [];
  return raw.map((s) => ({
    id: s.id,
    startTime: s.start_time,
    endTime: s.end_time,
    startFrame: s.start_frame,
    endFrame: s.end_frame,
    duration: s.duration,
  }));
}
