import { Command } from 'commander';
import chalk from 'chalk';
import { createJob } from '@cutsense/storage';
import { createProvider } from '@cutsense/providers';
import { JobOrchestrator } from '@cutsense/agent';
import { ProgressReporter } from '../utils/progress.js';
import type { ProviderName } from '@cutsense/core';

export const runCommand = new Command('run')
  .description('Run the full CutSense pipeline: ingest -> understand -> edit -> render')
  .argument('<video>', 'Path to video file')
  .requiredOption('--prompt <instruction>', 'Edit instruction (e.g. "Cut to 2 minutes, keep highlights")')
  .option('--provider <name>', 'AI provider: anthropic|openai|gemini', 'anthropic')
  .option('--model <name>', 'Specific model override')
  .option('--more-ai', 'Enable MORE AI enhanced analysis', false)
  .option('--duration <seconds>', 'Target output duration in seconds', parseFloat)
  .option('--captions <style>', 'Caption style: none|standard|jumbo', 'standard')
  .option('--language <lang>', 'Force language (default: auto)')
  .option('--enhance', 'Enable hybrid rendering with Revideo scene enhancements', false)
  .option('--max-enhanced <n>', 'Max segments to enhance', parseInt)
  .option('--output <path>', 'Output file path')
  .action(async (videoPath: string, opts) => {
    const progress = new ProgressReporter(opts.enhance ? 10 : 8);

    try {
      progress.step('Creating job', videoPath);
      const job = await createJob(videoPath, {
        provider: opts.provider,
        model: opts.model,
        moreAI: opts.moreAi,
        targetDuration: opts.duration,
        captionStyle: opts.captions,
        language: opts.language,
        userInstruction: opts.prompt,
      });

      console.log(chalk.dim(`Job ID: ${job.id}`));
      console.log(chalk.dim(`Job dir: ${job.jobDir}`));

      const provider = createProvider(opts.provider as ProviderName, undefined);

      const orchestrator = new JobOrchestrator({
        provider,
        moreAI: opts.moreAi,
        userInstruction: opts.prompt,
        targetDuration: opts.duration,
        captionStyle: opts.captions,
        enableEnhancement: opts.enhance,
        maxEnhancedSegments: opts.maxEnhanced,
        ingestOptions: { language: opts.language },
        onProgress: (stage, step, detail) => {
          progress.step(`[${stage}] ${step}`, detail);
        },
      });

      const finalJob = await orchestrator.run(job.id);

      if (finalJob.state === 'render_done') {
        progress.complete(`Output ready: ${job.jobDir}/output/output.mp4`);
      } else {
        progress.warn(`Pipeline stopped at state: ${finalJob.state}`);
        if (finalJob.error) progress.error(finalJob.error);
      }
    } catch (err) {
      progress.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
