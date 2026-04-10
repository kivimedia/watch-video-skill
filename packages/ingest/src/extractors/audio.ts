/**
 * Audio extractor - pulls a 16 kHz mono PCM WAV from a video file.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Extracts audio from a video file as a 16 kHz mono PCM WAV.
 *
 * @param videoPath - absolute path to the source video
 * @param outputDir - directory where the WAV file will be written
 * @returns absolute path to the output WAV file
 */
export async function extractAudio(
  videoPath: string,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  // Use forward slashes for FFmpeg compatibility on Windows
  const inputPath = videoPath.replace(/\\/g, '/');
  const outputPath = join(outputDir, 'audio.wav');
  const outputPathFfmpeg = outputPath.replace(/\\/g, '/');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-y',           // overwrite without prompting
        '-i', inputPath,
        '-vn',          // no video
        '-acodec', 'pcm_s16le',
        '-ar', '16000', // 16 kHz sample rate
        '-ac', '1',     // mono
        outputPathFfmpeg,
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: process.platform === 'win32',
      },
    );

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg for audio extraction: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg audio extraction failed (exit ${code}).\n` +
              `stderr: ${stderr.slice(-1000)}`,
          ),
        );
      }
    });
  });

  return outputPath;
}
