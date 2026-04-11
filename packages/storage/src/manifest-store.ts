import fs from 'fs/promises';
import path from 'path';
import { RunManifest } from '@cutsense/core';
import { getJobDir } from './job-store.js';

function manifestPath(jobId: string): string {
  return path.join(getJobDir(jobId), 'run-manifest.json');
}

export async function saveManifest(jobId: string, manifest: RunManifest): Promise<void> {
  const filePath = manifestPath(jobId);
  await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function loadManifest(jobId: string): Promise<RunManifest> {
  const filePath = manifestPath(jobId);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as RunManifest;
  } catch {
    throw new Error(`Manifest not found for job ${jobId} (${filePath})`);
  }
}

export async function updateManifest(
  jobId: string,
  partial: Partial<RunManifest>,
): Promise<RunManifest> {
  const existing = await loadManifest(jobId);
  const updated: RunManifest = { ...existing, ...partial };
  await saveManifest(jobId, updated);
  return updated;
}
