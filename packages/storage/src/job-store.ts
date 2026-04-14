import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Job, JobState, JobConfig } from '@cutsense/core';

const CUTSENSE_ROOT = path.join(os.homedir(), '.cutsense', 'jobs');

const JOB_SUBDIRS = [
  'frames',
  'audio',
  'transcript',
  'scenes',
  'vud',
  'edit',
  'output',
] as const;

function generateJobId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `job_${datePart}_${random}`;
}

export function getJobDir(id: string): string {
  return path.join(CUTSENSE_ROOT, id);
}

async function ensureRoot(): Promise<void> {
  await fs.mkdir(CUTSENSE_ROOT, { recursive: true });
}

export async function createJob(sourcePath: string, config: JobConfig): Promise<Job> {
  await ensureRoot();

  const id = generateJobId();
  const jobDir = getJobDir(id);

  await fs.mkdir(jobDir, { recursive: true });

  for (const subdir of JOB_SUBDIRS) {
    await fs.mkdir(path.join(jobDir, subdir), { recursive: true });
  }

  const now = new Date().toISOString();
  const job: Job = {
    id,
    state: JobState.CREATED,
    sourcePath,
    sourceFileName: path.basename(sourcePath),
    jobDir,
    config,
    createdAt: now,
    updatedAt: now,
  };

  await fs.writeFile(
    path.join(jobDir, 'manifest.json'),
    JSON.stringify(job, null, 2),
    'utf-8',
  );

  return job;
}

export async function getJob(id: string): Promise<Job> {
  const manifestPath = path.join(getJobDir(id), 'manifest.json');

  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as Job;
  } catch (err) {
    throw new Error(`Job not found: ${id} (${manifestPath})`);
  }
}

export async function updateJob(id: string, partial: Partial<Job>): Promise<Job> {
  const existing = await getJob(id);

  const updated: Job = {
    ...existing,
    ...partial,
    id: existing.id,
    jobDir: existing.jobDir,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(getJobDir(id), 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(updated, null, 2), 'utf-8');

  return updated;
}

export async function deleteJob(id: string): Promise<void> {
  const dir = getJobDir(id);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function listJobs(): Promise<Job[]> {
  await ensureRoot();

  let entries: string[];
  try {
    entries = await fs.readdir(CUTSENSE_ROOT);
  } catch {
    return [];
  }

  const jobs: Job[] = [];

  for (const entry of entries) {
    const manifestPath = path.join(CUTSENSE_ROOT, entry, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      jobs.push(JSON.parse(raw) as Job);
    } catch {
      // Skip corrupted or incomplete job dirs
    }
  }

  return jobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
