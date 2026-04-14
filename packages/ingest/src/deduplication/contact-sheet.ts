/**
 * Contact sheet generator - calls the contact_sheet.py sidecar script.
 */

import { dirname } from 'path';
import { mkdir } from 'fs/promises';
import { ScriptRunner } from '../sidecar/runner.js';

export interface ContactSheetOptions {
  /** Number of columns in the contact sheet grid. Defaults to 5. */
  cols?: number;
  /** Width of each thumbnail in pixels. Defaults to 240. */
  thumbWidth?: number;
  /** Maximum number of frames to include (0 = all). Evenly samples when capped. */
  maxFrames?: number;
  /** Max output size in KB. Defaults to 4000 (under Anthropic's 5MB limit). */
  maxSizeKb?: number;
  /** Timeout in ms. Defaults to ScriptRunner default (10 min). */
  timeoutMs?: number;
}

interface ContactSheetResult {
  contact_sheet_path: string;
}

/**
 * Generates a contact sheet (image grid) from a directory of extracted frames.
 *
 * @param framesDir - directory containing frame images
 * @param outputPath - where to write the contact sheet image
 * @param options - generation options
 * @returns absolute path to the generated contact sheet
 */
export async function generateContactSheet(
  framesDir: string,
  outputPath: string,
  options: ContactSheetOptions = {},
): Promise<string> {
  await mkdir(dirname(outputPath), { recursive: true });

  const runner = new ScriptRunner();
  const cols = options.cols ?? 5;
  const thumbWidth = options.thumbWidth ?? 240;

  const args = [
    '--frames-dir', framesDir.replace(/\\/g, '/'),
    '--output', outputPath.replace(/\\/g, '/'),
    '--cols', String(cols),
    '--thumb-width', String(thumbWidth),
  ];

  if (options.maxFrames !== undefined && options.maxFrames > 0) {
    args.push('--max-frames', String(options.maxFrames));
  }

  if (options.maxSizeKb !== undefined) {
    args.push('--max-size-kb', String(options.maxSizeKb));
  }

  const result = await runner.runScript<ContactSheetResult>(
    'contact_sheet.py',
    args,
    { timeoutMs: options.timeoutMs },
  );

  return result.contact_sheet_path;
}
