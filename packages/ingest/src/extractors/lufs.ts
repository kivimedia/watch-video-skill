/**
 * LUFS measurement extractor using FFmpeg's loudnorm filter.
 */

import { spawn } from 'child_process';
import type { LUFSData } from '@cutsense/core';

interface LoudnormJson {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  [key: string]: string;
}

/**
 * Measures the loudness of an audio file using FFmpeg's loudnorm filter.
 * FFmpeg prints the loudnorm JSON to stderr, so we parse stderr.
 *
 * @param audioPath - absolute path to a WAV audio file
 * @returns LUFSData from @cutsense/core
 */
export async function measureLUFS(audioPath: string): Promise<LUFSData> {
  const inputPath = audioPath.replace(/\\/g, '/');

  const stderr = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-i', inputPath,
        '-af', 'loudnorm=print_format=json',
        '-f', 'null',
        '-',
      ],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: process.platform === 'win32',
      },
    );

    let stderrOutput = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg for LUFS measurement: ${err.message}`));
    });

    child.on('close', (code) => {
      // ffmpeg exits 0 but we still get the loudnorm JSON in stderr
      // A non-zero code here would indicate a bad input file
      if (code !== 0 && !stderrOutput.includes('input_i')) {
        reject(
          new Error(
            `FFmpeg LUFS measurement failed (exit ${code}).\n` +
              `stderr: ${stderrOutput.slice(-1000)}`,
          ),
        );
      } else {
        resolve(stderrOutput);
      }
    });
  });

  // Extract the JSON block from stderr
  const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(
      'Could not find loudnorm JSON in ffmpeg stderr output.\n' +
        `stderr: ${stderr.slice(-1000)}`,
    );
  }

  let loudnorm: LoudnormJson;
  try {
    loudnorm = JSON.parse(jsonMatch[0]) as LoudnormJson;
  } catch {
    throw new Error(`Failed to parse loudnorm JSON: ${jsonMatch[0]}`);
  }

  return {
    inputI: parseFloat(loudnorm.input_i),
    inputTP: parseFloat(loudnorm.input_tp),
    inputLRA: parseFloat(loudnorm.input_lra),
    inputThresh: parseFloat(loudnorm.input_thresh),
  };
}
