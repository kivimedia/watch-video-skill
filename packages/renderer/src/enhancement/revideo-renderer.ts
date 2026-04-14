/**
 * Revideo enhancement renderer.
 *
 * Renders individual enhanced scenes as standalone video assets.
 * These assets are later inserted into the Remotion master timeline.
 *
 * Uses Revideo (@revideo/renderer) for standalone animations (title cards,
 * lower thirds) and enhanced FFmpeg filters for source-video effects
 * (zoom callouts, spotlight, voice pulse).
 */

import type { SceneEnhancementSpec, InsertRenderResult } from '@cutsense/core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { renderTitleCard, isRevideoAvailable } from '../revideo/render.js';

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
    mkdirSync(dirname(outputPath), { recursive: true });

    // Route to Revideo for standalone animations, FFmpeg for source-video effects
    const useRevideo = isRevideoAvailable() && isRevideoEnhancement(spec.enhancementType);

    if (useRevideo) {
      await renderWithRevideo(spec, outputPath, options);
    } else {
      await renderWithFFmpeg(spec, outputPath);
    }

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
 * Determine if an enhancement type should use Revideo (standalone animations)
 * vs FFmpeg (source-video manipulation).
 */
function isRevideoEnhancement(type: string): boolean {
  // Title cards and lower thirds are standalone - perfect for Revideo
  return ['animated_annotation', 'custom'].includes(type);
}

/**
 * Revideo-based enhancement rendering.
 * Creates standalone animated segments using @revideo/renderer.
 */
async function renderWithRevideo(
  spec: SceneEnhancementSpec,
  outputPath: string,
  options: RevideoRenderOptions,
): Promise<void> {
  const title = spec.overlayText?.[0] ?? 'Untitled';
  const subtitle = spec.overlayText?.[1] ?? '';

  const result = await renderTitleCard(
    title,
    subtitle,
    spec.expectedOutputDurationSec,
    {
      outputDir: dirname(outputPath),
      onProgress: (pct) => options.onProgress?.(spec.sceneId, pct),
    },
  );

  // Move rendered file to expected output path if different
  if (result !== outputPath) {
    const { renameSync } = await import('node:fs');
    renameSync(result, outputPath);
  }
}

/**
 * FFmpeg-based enhancement rendering.
 * Creates enhanced video segments using FFmpeg filters for effects
 * that need source video access (zoom, spotlight, voice pulse).
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
  const vfParts: string[] = [];

  // Camera behavior
  switch (spec.cameraBehavior) {
    case 'zoom_in_hold_zoom_out': {
      const dur = spec.expectedOutputDurationSec;
      const zoomIn = dur * 0.25;
      const holdEnd = dur * 0.75;
      const zoomExpr = `if(lt(t,${zoomIn}),1+0.4*t/${zoomIn},if(lt(t,${holdEnd}),1.4,1.4-0.4*(t-${holdEnd})/${dur - holdEnd}))`;
      vfParts.push(`zoompan=z='${zoomExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1328x1028:fps=30`);
      break;
    }
    case 'steady_zoom_in': {
      const dur = spec.expectedOutputDurationSec;
      vfParts.push(`zoompan=z='1+0.4*on/(${dur}*30)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1328x1028:fps=30`);
      break;
    }
    case 'static_with_overlay': {
      // Lower third: semi-transparent bar with text at bottom
      if (spec.overlayText?.length) {
        const text = spec.overlayText[0]!.replace(/'/g, "\u2018").replace(/:/g, '\\:');
        // Dark bar at bottom
        vfParts.push(`drawbox=x=0:y=ih-90:w=500:h=60:color=black@0.8:t=fill`);
        // Accent line
        vfParts.push(`drawbox=x=0:y=ih-90:w=4:h=60:color=0x3b82f6:t=fill`);
        // Text
        vfParts.push(`drawtext=text='${text}':fontsize=24:fontcolor=white:x=20:y=ih-72:fontfile=C\\\\:/Windows/Fonts/segoeui.ttf`);
      }
      break;
    }
    default:
      break;
  }

  // Enhancement type specific effects
  switch (spec.enhancementType) {
    case 'feature_spotlight': {
      // Vignette effect - darken edges, bright center
      vfParts.push(`vignette=PI/4`);
      break;
    }
    case 'educational_zoom_callout': {
      // If no zoom camera behavior already set, add a gentle zoom
      if (!spec.cameraBehavior || spec.cameraBehavior === 'custom') {
        const dur = spec.expectedOutputDurationSec;
        vfParts.push(`zoompan=z='1+0.2*on/(${dur}*30)':d=1:x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':s=1328x1028:fps=30`);
      }
      break;
    }
    case 'object_emphasis': {
      // Subtle brightness/contrast boost
      vfParts.push(`eq=brightness=0.05:contrast=1.1`);
      break;
    }
    default:
      break;
  }

  if (vfParts.length > 0) {
    filters.push('-vf', vfParts.join(','));
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
