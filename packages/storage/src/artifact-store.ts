import fs from 'fs/promises';
import path from 'path';
import { getJobDir } from './job-store.js';

export type ArtifactCategory =
  | 'frames'
  | 'audio'
  | 'transcript'
  | 'scenes'
  | 'vud'
  | 'edit'
  | 'output';

export function getArtifactPath(
  jobId: string,
  category: ArtifactCategory,
  filename: string,
): string {
  return path.join(getJobDir(jobId), category, filename);
}

export async function saveArtifact(
  jobId: string,
  category: ArtifactCategory,
  filename: string,
  data: Buffer | string,
): Promise<string> {
  const filePath = getArtifactPath(jobId, category, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
  return filePath;
}

export async function loadArtifact(
  jobId: string,
  category: ArtifactCategory,
  filename: string,
): Promise<Buffer> {
  const filePath = getArtifactPath(jobId, category, filename);
  try {
    return await fs.readFile(filePath);
  } catch {
    throw new Error(
      `Artifact not found: ${category}/${filename} for job ${jobId} (${filePath})`,
    );
  }
}

export async function saveJSON<T>(
  jobId: string,
  category: ArtifactCategory,
  filename: string,
  data: T,
): Promise<string> {
  return saveArtifact(jobId, category, filename, JSON.stringify(data, null, 2));
}

export async function loadJSON<T>(
  jobId: string,
  category: ArtifactCategory,
  filename: string,
): Promise<T> {
  const buf = await loadArtifact(jobId, category, filename);
  return JSON.parse(buf.toString('utf-8')) as T;
}
