import { selectComposition, renderMedia } from '@remotion/renderer';
import type { CutSenseTimeline } from '@cutsense/core';
import { getBundle } from './bundler.js';
import { copyFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';

export interface RenderOptions {
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9';
  crf?: number;
  concurrency?: number;
  onProgress?: (info: { renderedFrames: number; totalFrames: number; percent: number }) => void;
  onBundleProgress?: (progress: number) => void;
}

export async function render(
  timeline: CutSenseTimeline,
  outputPath: string,
  options: RenderOptions = {},
): Promise<string> {
  const bundlePath = await getBundle(options.onBundleProgress);

  // Copy source video into the Remotion bundle's public dir so it can be served.
  // Remotion's OffthreadVideo cannot load file:// URLs directly.
  const firstClipSrc = timeline.clips[0]?.src;
  let servedTimeline = timeline;
  if (firstClipSrc && !firstClipSrc.startsWith('http')) {
    const videoFileName = basename(firstClipSrc);
    const destPath = join(bundlePath, videoFileName);
    await copyFile(firstClipSrc, destPath);
    // Rewrite all clip srcs to use the served filename (relative to bundle root)
    servedTimeline = {
      ...timeline,
      clips: timeline.clips.map((c) => ({
        ...c,
        src: `./${videoFileName}`,
      })),
    };
  }

  const props = servedTimeline as unknown as Record<string, unknown>;

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'MainEdit',
    inputProps: props,
  });

  await renderMedia({
    composition,
    serveUrl: bundlePath,
    codec: options.codec ?? 'h264',
    outputLocation: outputPath,
    inputProps: props,
    concurrency: options.concurrency ?? 4,
    crf: options.crf ?? 18,
    onProgress: ({ renderedFrames }) => {
      options.onProgress?.({
        renderedFrames,
        totalFrames: composition.durationInFrames,
        percent: Math.round((renderedFrames / composition.durationInFrames) * 100),
      });
    },
  });

  return outputPath;
}
