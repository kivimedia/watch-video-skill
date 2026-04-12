/**
 * Transcription extractor - calls the transcribe.py sidecar script.
 */

import type { TranscriptResult, TranscriptWord } from '@cutsense/core';
import { ScriptRunner } from '../sidecar/runner.js';

export interface TranscribeOptions {
  /**
   * BCP-47 language code hint for Whisper (e.g. "en", "he").
   * Omit for auto-detection.
   */
  language?: string;
  /** Timeout in ms. Defaults to ScriptRunner default (10 min). */
  timeoutMs?: number;
}

interface RawTranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
}

interface RawTranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words: RawTranscriptWord[];
}

interface RawTranscriptResult {
  language: string;
  is_rtl: boolean;
  words: RawTranscriptWord[];
  segments: RawTranscriptSegment[];
  speakers: string[];
}

/**
 * Transcribes an audio file by calling the transcribe.py sidecar (Whisper).
 *
 * @param audioPath - absolute path to a WAV audio file
 * @param options - transcription options
 * @returns TranscriptResult from @cutsense/core
 */
export async function transcribe(
  audioPath: string,
  options: TranscribeOptions = {},
): Promise<TranscriptResult> {
  const runner = new ScriptRunner();

  const args = ['--audio', audioPath.replace(/\\/g, '/')];
  if (options.language) {
    args.push('--language', options.language);
  }

  const raw = await runner.runScript<RawTranscriptResult>(
    'transcribe.py',
    args,
    { timeoutMs: options.timeoutMs },
  );

  const mapWord = (w: RawTranscriptWord): TranscriptWord => ({
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
    speaker: w.speaker,
  });

  return {
    language: raw.language,
    isRTL: raw.is_rtl,
    words: raw.words.map(mapWord),
    segments: raw.segments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
      speaker: seg.speaker,
      words: seg.words.map(mapWord),
    })),
    speakers: raw.speakers,
  };
}
