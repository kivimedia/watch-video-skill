/**
 * IngestOrchestrator - coordinates all extractors to produce an IngestResult.
 *
 * Execution order is optimised for parallelism:
 *   Phase A (parallel): metadata, audio extraction, frame extraction
 *   Phase B (after audio ready): LUFS measurement, transcription
 *   Phase C (after frames ready): scene detection, contact sheet
 */

import { join } from 'path';
import { mkdir } from 'fs/promises';
import { getJobDir } from '@cutsense/storage';
import type { IngestResult, IngestOptions } from '@cutsense/core';
import { extractMetadata } from './extractors/metadata.js';
import { extractAudio } from './extractors/audio.js';
import { extractFrames } from './extractors/frames.js';
import { measureLUFS } from './extractors/lufs.js';
import { transcribe } from './extractors/transcript.js';
import { detectScenes } from './extractors/scenes.js';
import { generateContactSheet } from './deduplication/contact-sheet.js';

export interface IngestProgressCallback {
  (step: string, detail?: string): void;
}

export interface OrchestratorOptions extends IngestOptions {
  /** Called on each step transition. */
  onProgress?: IngestProgressCallback;
  /** Timeout per sidecar script in ms. Defaults to 10 minutes. */
  scriptTimeoutMs?: number;
}

export class IngestOrchestrator {
  /**
   * Runs the full ingest pipeline on a video file.
   *
   * @param sourcePath - absolute path to the source video
   * @param jobId - unique job identifier (used to locate the working directory)
   * @param options - pipeline configuration
   */
  async ingest(
    sourcePath: string,
    jobId: string,
    options: OrchestratorOptions = {},
  ): Promise<IngestResult> {
    const progress = options.onProgress ?? (() => undefined);
    const jobDir = await getJobDir(jobId);
    const framesDir = join(jobDir, 'frames');
    const audioDir = join(jobDir, 'audio');
    const contactSheetsDir = join(jobDir, 'contact-sheets');

    await mkdir(jobDir, { recursive: true });

    // ---------------------------------------------------------------
    // Phase A: metadata + audio extraction + frame extraction (parallel)
    // ---------------------------------------------------------------
    progress('phase-a:start', 'metadata, audio, frames');

    const [metadata, audioPath, frames] = await Promise.all([
      (async () => {
        progress('metadata:start');
        const m = await extractMetadata(sourcePath);
        progress('metadata:done');
        return m;
      })(),

      (async () => {
        progress('audio:start');
        const p = await extractAudio(sourcePath, audioDir);
        progress('audio:done', p);
        return p;
      })(),

      (async () => {
        progress('frames:start');
        const f = await extractFrames(sourcePath, framesDir, {
          fps: options.fps,
          timeoutMs: options.scriptTimeoutMs,
        });
        progress('frames:done', `${f.length} frames`);
        return f;
      })(),
    ]);

    // ---------------------------------------------------------------
    // Phase B: LUFS + transcription (depend on audio)
    // ---------------------------------------------------------------
    progress('phase-b:start', 'LUFS, transcript');

    const [lufs, transcript] = await Promise.all([
      (async () => {
        progress('lufs:start');
        const l = await measureLUFS(audioPath);
        progress('lufs:done');
        return l;
      })(),

      options.noTranscript
        ? Promise.resolve(undefined)
        : (async () => {
            progress('transcript:start');
            const t = await transcribe(audioPath, {
              language: options.language,
              timeoutMs: options.scriptTimeoutMs,
            });
            progress('transcript:done', `${t.words.length} words`);
            return t;
          })(),
    ]);

    // ---------------------------------------------------------------
    // Phase C: scenes + contact sheet (depend on frames)
    // ---------------------------------------------------------------
    progress('phase-c:start', 'scenes, contact sheet');

    const contactSheetPath = join(contactSheetsDir, 'sheet.jpg');

    const [scenes, contactSheetResult] = await Promise.all([
      (async () => {
        progress('scenes:start');
        const s = await detectScenes(sourcePath, {
          threshold: options.sceneThreshold,
          timeoutMs: options.scriptTimeoutMs,
        });
        progress('scenes:done', `${s.length} scenes`);
        return s;
      })(),

      (async () => {
        progress('contact-sheet:start');
        const p = await generateContactSheet(framesDir, contactSheetPath, {
          cols: options.contactSheetCols,
          timeoutMs: options.scriptTimeoutMs,
        });
        progress('contact-sheet:done', p);
        return p;
      })(),
    ]);

    progress('ingest:done');

    // Attach LUFS data to metadata
    const enrichedMetadata = { ...metadata, lufs };

    const result: IngestResult = {
      jobId,
      metadata: enrichedMetadata,
      frames,
      scenes,
      transcript: transcript ?? {
        language: 'unknown',
        isRTL: false,
        words: [],
        segments: [],
        speakers: [],
      },
      lufs,
      contactSheets: [contactSheetResult],
    };

    return result;
  }
}
