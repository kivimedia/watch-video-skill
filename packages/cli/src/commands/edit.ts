import { Command } from 'commander';
import chalk from 'chalk';
import { loadJSON, saveJSON } from '@cutsense/storage';
import { createProvider } from '@cutsense/providers';
import { edit as runEdit } from '@cutsense/edit';
import { ProgressReporter } from '../utils/progress.js';
import type { VUD, ProviderName } from '@cutsense/core';

export const editCommand = new Command('edit')
  .description('Run Layer 3: generate edit decisions and Remotion timeline from VUD')
  .argument('<job-id>', 'Job ID with completed VUD')
  .requiredOption('--prompt <instruction>', 'Edit instruction')
  .option('--provider <name>', 'AI provider', 'anthropic')
  .option('--duration <seconds>', 'Target output duration', parseFloat)
  .option('--captions <style>', 'Caption style: none|standard|jumbo', 'standard')
  .action(async (jobId: string, opts) => {
    const progress = new ProgressReporter(4);

    try {
      progress.step('Loading VUD', jobId);
      const vud = await loadJSON<VUD>(jobId, 'vud', 'vud.json');

      progress.step('Generating edit decisions');
      const provider = createProvider(opts.provider as ProviderName);
      const timeline = await runEdit(vud, opts.prompt, provider, {
        targetDuration: opts.duration,
        captionStyle: opts.captions,
        onProgress: (step, detail) => progress.info(`[edit] ${step}: ${detail ?? ''}`),
      });

      await saveJSON(jobId, 'edit', 'timeline.json', timeline);

      progress.complete(
        `Timeline: ${timeline.clips.length} clips, ` +
        `${(timeline.durationInFrames / timeline.fps).toFixed(1)}s. ` +
        `Captions: ${timeline.captions?.style ?? 'none'}`,
      );
    } catch (err) {
      progress.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
