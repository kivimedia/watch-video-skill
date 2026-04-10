/**
 * Video metadata extractor using ffprobe.
 */

import { spawn } from 'child_process';
import type { VideoMetadata } from '@cutsense/core';

interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
}

interface FfprobeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  bit_rate?: string;
  channels?: number;
  sample_rate?: string;
}

interface FfprobeOutput {
  format: FfprobeFormat;
  streams: FfprobeStream[];
}

/** Parses a fraction string like "30000/1001" into a floating-point FPS. */
function parseFps(r_frame_rate: string): number {
  const [num, den] = r_frame_rate.split('/').map(Number);
  if (!den || den === 0) return num ?? 0;
  return num / den;
}

/**
 * Runs ffprobe on the given video file and returns a VideoMetadata object.
 */
export async function extractMetadata(videoPath: string): Promise<VideoMetadata> {
  const ffprobePath = videoPath.replace(/\\/g, '/');

  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      'ffprobe',
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        ffprobePath,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: process.platform === 'win32',
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
      } else {
        resolve(stdout);
      }
    });
  });

  const probe: FfprobeOutput = JSON.parse(output);

  const videoStream = probe.streams.find((s) => s.codec_type === 'video');
  const audioStream = probe.streams.find((s) => s.codec_type === 'audio');

  if (!videoStream) {
    throw new Error(`No video stream found in "${videoPath}"`);
  }

  const fps = videoStream.r_frame_rate ? parseFps(videoStream.r_frame_rate) : 0;
  const bitrate = parseInt(probe.format.bit_rate ?? videoStream.bit_rate ?? '0', 10);

  const metadata: VideoMetadata = {
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps,
    codec: videoStream.codec_name,
    bitrate,
    hasAudio: audioStream !== undefined,
    audioCodec: audioStream?.codec_name,
    audioChannels: audioStream?.channels,
    audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
  };

  return metadata;
}
