import { Command } from 'commander';
import chalk from 'chalk';
import { loadJSON, saveJSON, updateJob, getJob } from '@cutsense/storage';
import { createProvider } from '@cutsense/providers';
import { understand as runUnderstand } from '@cutsense/understand';
import { ProgressReporter } from '../utils/progress.js';
import type { IngestResult, ProviderName } from '@cutsense/core';

export const understandCommand = new Command('understand')
  .description('Run Layer 2: build Video Understanding Document (VUD) from ingest result')
  .argument('<job-id>', 'Job ID from ingest step')
  .option('--provider <name>', 'AI provider: anthropic|openai|gemini', 'anthropic')
  .option('--model <name>', 'Specific model override')
  .option('--more-ai', 'Enable MORE AI enhanced analysis', false)
  .action(async (jobId: string, opts) => {
    const progress = new ProgressReporter(5);

    try {
      progress.step('Loading ingest result', jobId);
      const ingestResult = await loadJSON<IngestResult>(jobId, 'transcript', 'ingest-result.json');

      progress.step('Creating AI provider', opts.provider);
      const provider = createProvider(opts.provider as ProviderName);

      progress.step('Building VUD');
      const vud = await runUnderstand(ingestResult, provider, {
        moreAI: opts.moreAi,
        onProgress: (step: string, detail?: string) => progress.info(`[understand] ${step}: ${detail ?? ''}`),
      });

      const job = await getJob(jobId);
      vud.sourceFile = job.sourcePath;
      await saveJSON(jobId, 'vud', 'vud.json', vud);

      progress.complete(
        `VUD complete: ${vud.segments.length} segments, ${vud.entities.length} entities, ` +
        `${vud.topics.length} topics. Language: ${vud.language}`,
      );
    } catch (err) {
      progress.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
