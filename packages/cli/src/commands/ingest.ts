import { Command } from 'commander';
import chalk from 'chalk';
import { createJob } from '@cutsense/storage';
import { IngestOrchestrator } from '@cutsense/ingest';
import { saveJSON } from '@cutsense/storage';
import { ProgressReporter } from '../utils/progress.js';

export const ingestCommand = new Command('ingest')
  .description('Run Layer 1: extract frames, audio, transcript, scenes from video')
  .argument('<video>', 'Path to video file')
  .option('--language <lang>', 'Force language (default: auto)')
  .option('--fps <n>', 'Frame extraction rate', parseFloat, 1)
  .option('--no-transcript', 'Skip transcription')
  .option('--job-id <id>', 'Resume existing job')
  .action(async (videoPath: string, opts) => {
    const progress = new ProgressReporter(4);

    try {
      progress.step('Creating job', videoPath);
      const job = await createJob(videoPath, { language: opts.language });
      console.log(chalk.dim(`Job ID: ${job.id}`));

      progress.step('Running ingest pipeline');
      const orchestrator = new IngestOrchestrator();
      const result = await orchestrator.ingest(videoPath, job.id, {
        language: opts.language,
        fps: opts.fps,
        noTranscript: !opts.transcript,
      });

      await saveJSON(job.id, 'transcript', 'ingest-result.json', result);

      progress.complete(
        `Ingest done: ${result.frames.length} frames, ${result.scenes.length} scenes, ` +
        `${result.transcript.words.length} words. Job: ${job.id}`,
      );
    } catch (err) {
      progress.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
