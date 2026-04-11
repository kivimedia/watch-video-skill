/**
 * Revideo enhancement renderer.
 *
 * Renders individual enhanced scenes as standalone video assets.
 * These assets are later inserted into the Remotion master timeline.
 *
 * NOTE: Revideo is an optional dependency. If not installed, this
 * module gracefully falls back to standard rendering.
 */

import type { SceneEnhancementSpec, InsertRenderResult } from '@cutsense/core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface RevideoRenderOptions {
  outputDir: string;
  timeout?: number;
  onProgress?: (sceneId: string, percent: number) => void;
}

/**
 * Render a single enhanced scene using Revideo.
 *
 * For v1, this uses FFmpeg to create enhanced versions (zoom, overlay)
 * since Revideo requires a separate project setup. The architecture
 * is designed so that a full Revideo implementation can be dropped in
 * without changing the interface.
 */
export async function renderEnhancedScene(
  spec: SceneEnhancementSpec,
  options: RevideoRenderOptions,
): Promise<InsertRenderResult> {
  const startTime = Date.now();
  const outputPath = resolve(options.outputDir, `${spec.sceneId}.mp4`);

  try {
    options.onProgress?.(spec.sceneId, 0);

    // For v1: use FFmpeg-based enhancement (zoom, crop, overlay text)
    // This provides immediate value while the full Revideo integration
    // is built out in Phase 3
    await renderWithFFmpeg(spec, outputPath);

    options.onProgress?.(spec.sceneId, 100);

    return {
      sceneId: spec.sceneId,
      success: true,
      outputPath,
      outputDurationSec: spec.expectedOutputDurationSec,
      renderTimeMs: Date.now() - startTime,
      fallbackToStandard: false,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    return {
      sceneId: spec.sceneId,
      success: false,
      error: errorMsg,
      renderTimeMs: Date.now() - startTime,
      fallbackToStandard: true,
    };
  }
}

/**
 * Batch render all enhanced scenes.
 * Returns results for each, with fallback flags on failure.
 */
export async function renderAllEnhancedScenes(
  specs: SceneEnhancementSpec[],
  options: RevideoRenderOptions,
): Promise<InsertRenderResult[]> {
  const results: InsertRenderResult[] = [];

  // Render sequentially to avoid resource contention
  for (const spec of specs) {
    const result = await renderEnhancedScene(spec, options);
    results.push(result);
  }

  return results;
}

/**
 * FFmpeg-based enhancement rendering (v1 implementation).
 * Creates enhanced video segments using FFmpeg filters.
 */
async function renderWithFFmpeg(
  spec: SceneEnhancementSpec,
  outputPath: string,
): Promise<void> {
  const startSec = spec.timelineStartSec;
  const duration = spec.expectedOutputDurationSec;

  // Build filter chain based on enhancement type
  const filters = buildFFmpegFilters(spec);

  const args = [
    '-y',
    '-ss', String(startSec),
    '-t', String(duration),
    '-i', spec.sourceMediaRef,
    ...filters,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputPath,
  ];

  await runFFmpeg(args);
}

function buildFFmpegFilters(spec: SceneEnhancementSpec): string[] {
  const filters: string[] = [];

  switch (spec.cameraBehavior) {
    case 'zoom_in_hold_zoom_out': {
      // Ken Burns style zoom: 1x -> 1.3x -> 1x over the duration
      const dur = spec.expectedOutputDurationSec;
      const zoomExpr = `if(lt(t,${dur * 0.3}),1+0.3*t/${dur * 0.3},if(lt(t,${dur * 0.7}),1.3,1.3-0.3*(t-${dur * 0.7})/${dur * 0.3}))`;
      filters.push('-vf', `zoompan=z='${zoomExpr}':d=1:s=1920x1080:fps=30`);
      break;
    }
    case 'steady_zoom_in': {
      const dur = spec.expectedOutputDurationSec;
      filters.push('-vf', `zoompan=z='1+0.3*on/(${dur}*30)':d=1:s=1920x1080:fps=30`);
      break;
    }
    case 'static_with_overlay': {
      // Add text overlay if available
      if (spec.overlayText?.length) {
        const text = spec.overlayText[0]!.replace(/'/g, "\\'");
        filters.push(
          '-vf',
          `drawtext=text='${text}':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-tw)/2:y=h-80`,
        );
      }
      break;
    }
    default:
      // No special filter
      break;
  }

  // Audio strategy
  if (spec.audioStrategy === 'duck_under_overlay') {
    filters.push('-af', 'volume=0.4');
  } else if (spec.audioStrategy === 'mute_original') {
    filters.push('-an');
  }

  return filters;
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', reject);
  });
}
