import { Command } from 'commander';
import chalk from 'chalk';
import { listJobs, deleteJob, getJobDir } from '@cutsense/storage';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const CLEANABLE_STATES = new Set([
  'render_done',
  'ingest_done',
  'understand_done',
  'edit_done',
  'ingest_failed',
  'understand_failed',
  'edit_failed',
  'render_failed',
  'cancelled',
  'created',
]);

async function getDirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await getDirSize(fullPath);
      } else {
        const info = await stat(fullPath);
        total += info.size;
      }
    }
  } catch {
    // Skip unreadable dirs
  }
  return total;
}

export const cleanCommand = new Command('clean')
  .description('Remove completed, failed, or specific job artifacts')
  .argument('[job-id]', 'Specific job ID to delete (omit for batch clean)')
  .option('--keep-latest <n>', 'Keep the N most recent jobs', parseInt)
  .option('--failed-only', 'Only remove failed/cancelled jobs', false)
  .option('--all', 'Remove all jobs (no state filter)', false)
  .option('--dry-run', 'Show what would be deleted without deleting', false)
  .action(async (jobId?: string, opts?: { keepLatest?: number; failedOnly?: boolean; all?: boolean; dryRun?: boolean }) => {
    try {
      if (jobId) {
        const dir = getJobDir(jobId);
        const size = await getDirSize(dir);
        const sizeMB = (size / 1024 / 1024).toFixed(1);

        if (opts?.dryRun) {
          console.log(`Would delete: ${jobId} (${sizeMB} MB)`);
          return;
        }
        await deleteJob(jobId);
        console.log(chalk.green(`Deleted job ${jobId} (freed ${sizeMB} MB)`));
        return;
      }

      const jobs = await listJobs();
      if (jobs.length === 0) {
        console.log('No jobs to clean.');
        return;
      }

      let toDelete = jobs.filter((j) => {
        if (opts?.all) return true;
        if (opts?.failedOnly) {
          return j.state.endsWith('_failed') || j.state === 'cancelled';
        }
        return CLEANABLE_STATES.has(j.state);
      });

      // Apply --keep-latest (jobs are sorted newest first from listJobs)
      if (opts?.keepLatest !== undefined && opts.keepLatest > 0) {
        toDelete = toDelete.slice(opts.keepLatest);
      }

      if (toDelete.length === 0) {
        console.log('Nothing to clean.');
        return;
      }

      let totalFreed = 0;

      for (const job of toDelete) {
        const size = await getDirSize(job.jobDir);
        const sizeMB = (size / 1024 / 1024).toFixed(1);

        if (opts?.dryRun) {
          console.log(`  ${chalk.dim(job.id)} ${chalk.yellow(job.state.padEnd(18))} ${job.sourceFileName} ${chalk.cyan(sizeMB + ' MB')}`);
        } else {
          await deleteJob(job.id);
          console.log(`  ${chalk.red('deleted')} ${job.id} (${sizeMB} MB)`);
        }
        totalFreed += size;
      }

      const totalMB = (totalFreed / 1024 / 1024).toFixed(1);
      if (opts?.dryRun) {
        console.log(chalk.bold(`\nWould delete ${toDelete.length} job(s), freeing ~${totalMB} MB`));
      } else {
        console.log(chalk.bold(`\nDeleted ${toDelete.length} job(s), freed ~${totalMB} MB`));
      }
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });
