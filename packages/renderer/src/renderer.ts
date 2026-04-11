import { selectComposition, renderMedia } from '@remotion/renderer';
import type { CutSenseTimeline } from '@cutsense/core';
import { getBundle } from './bundler.js';

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

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'MainEdit',
    inputProps: timeline as Record<string, unknown>,
  });

  await renderMedia({
    composition,
    serveUrl: bundlePath,
    codec: options.codec ?? 'h264',
    outputLocation: outputPath,
    inputProps: timeline as Record<string, unknown>,
    concurrency: options.concurrency ?? 4,
    crf: options.crf ?? 18,
    onProgress: ({ renderedFrames, encodedFrames }) => {
      options.onProgress?.({
        renderedFrames,
        totalFrames: composition.durationInFrames,
        percent: Math.round((renderedFrames / composition.durationInFrames) * 100),
      });
    },
  });

  return outputPath;
}
