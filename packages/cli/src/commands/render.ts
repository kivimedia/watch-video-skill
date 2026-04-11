import { Command } from 'commander';
import chalk from 'chalk';
import { loadJSON, getArtifactPath } from '@cutsense/storage';
import { render } from '@cutsense/renderer';
import { ProgressReporter } from '../utils/progress.js';
import type { CutSenseTimeline } from '@cutsense/core';

export const renderCommand = new Command('render')
  .description('Render a Remotion timeline to MP4')
  .argument('<job-id>', 'Job ID with completed timeline')
  .option('--output <path>', 'Output file path (default: job output dir)')
  .option('--codec <codec>', 'Video codec: h264|h265|vp9', 'h264')
  .option('--preview', 'Open Remotion Studio for preview instead of rendering')
  .action(async (jobId: string, opts) => {
    const progress = new ProgressReporter(3);

    try {
      progress.step('Loading timeline', jobId);
      const timeline = await loadJSON<CutSenseTimeline>(jobId, 'edit', 'timeline.json');

      const outputPath = opts.output ?? getArtifactPath(jobId, 'output', 'output.mp4');

      progress.step('Rendering with Remotion', `${timeline.clips.length} clips`);
      await render(timeline, outputPath, {
        codec: opts.codec,
        onProgress: ({ percent }) => {
          if (percent % 10 === 0) progress.info(`Rendering: ${percent}%`);
        },
        onBundleProgress: (p: number) => {
          progress.info(`Bundling: ${(p * 100).toFixed(0)}%`);
        },
      });

      progress.complete(`Output: ${outputPath}`);
    } catch (err) {
      progress.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
