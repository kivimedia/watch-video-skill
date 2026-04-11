import { Command } from 'commander';
import chalk from 'chalk';
import { listJobs, getJob } from '@cutsense/storage';

const STATE_COLORS: Record<string, (s: string) => string> = {
  created: chalk.gray,
  ingesting: chalk.yellow,
  ingest_done: chalk.blue,
  understanding: chalk.yellow,
  understand_done: chalk.blue,
  editing: chalk.yellow,
  edit_done: chalk.blue,
  rendering: chalk.yellow,
  render_done: chalk.green,
  ingest_failed: chalk.red,
  understand_failed: chalk.red,
  edit_failed: chalk.red,
  render_failed: chalk.red,
  cancelled: chalk.gray,
};

export const statusCommand = new Command('status')
  .description('Show job status')
  .argument('[job-id]', 'Specific job ID (omit for job list)')
  .action(async (jobId?: string) => {
    try {
      if (jobId) {
        const job = await getJob(jobId);
        const colorFn = STATE_COLORS[job.state] ?? chalk.white;
        console.log(`Job:     ${job.id}`);
        console.log(`State:   ${colorFn(job.state)}`);
        console.log(`Source:  ${job.sourceFileName}`);
        console.log(`Dir:     ${job.jobDir}`);
        console.log(`Created: ${job.createdAt}`);
        console.log(`Updated: ${job.updatedAt}`);
        if (job.error) console.log(`Error:   ${chalk.red(job.error)}`);
      } else {
        const jobs = await listJobs();
        if (jobs.length === 0) {
          console.log('No jobs found. Run `cutsense run <video> --prompt "..."` to create one.');
          return;
        }

        console.log(chalk.bold('Jobs:\n'));
        for (const job of jobs) {
          const colorFn = STATE_COLORS[job.state] ?? chalk.white;
          const age = timeSince(job.createdAt);
          console.log(
            `  ${chalk.dim(job.id)} ${colorFn(job.state.padEnd(18))} ${job.sourceFileName} ${chalk.dim(age)}`,
          );
        }
      }
    } catch (err) {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
