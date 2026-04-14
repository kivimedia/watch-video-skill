/**
 * Adaptive frame sampling - intelligently adjusts frame density based on
 * speech activity and visual change detection.
 *
 * Phase 1: Speech-aware density
 *   - During speech: keep frames at 5s intervals (people are doing things)
 *   - During silence: keep frames at 15s intervals
 *
 * Phase 2: Visual change refinement
 *   - Compare consecutive kept frames by pHash Hamming distance
 *   - If visually different: un-flag intermediate frames to capture transitions
 *   - Dramatic changes get more intermediate frames
 *
 * This runs AFTER transcript is available but BEFORE visual analysis.
 * All frames already exist on disk - we just toggle isDuplicate flags.
 */

import type { FrameInfo, TranscriptResult } from '@cutsense/core';

// Density intervals (seconds)
const SPEECH_INTERVAL = 5;
const SILENT_INTERVAL = 15;

// pHash Hamming distance thresholds
const SAME_THRESHOLD = 10;      // <= 10: same visual, no refinement
const MODERATE_THRESHOLD = 25;  // 10-25: moderate change, add 1 frame
                                // > 25: dramatic change, add up to 3 frames

// Merge speech words into intervals if gap <= this many seconds
const SPEECH_GAP_TOLERANCE = 1.5;

interface SpeechInterval {
  start: number;
  end: number;
}

/**
 * Compute Hamming distance between two pHash hex strings (64-bit hashes).
 */
function pHashDistance(a: string, b: string): number {
  const diff = BigInt('0x' + a) ^ BigInt('0x' + b);
  return popcount64(diff);
}

/**
 * Count set bits in a 64-bit BigInt.
 */
function popcount64(n: bigint): number {
  let count = 0;
  let v = n;
  while (v > 0n) {
    v &= v - 1n; // clear lowest set bit
    count++;
  }
  return count;
}

/**
 * Build merged speech intervals from transcript words.
 * Adjacent words within SPEECH_GAP_TOLERANCE seconds are merged.
 */
function buildSpeechIntervals(words: TranscriptResult['words']): SpeechInterval[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.start - b.start);
  const intervals: SpeechInterval[] = [{ start: sorted[0].start, end: sorted[0].end }];

  for (let i = 1; i < sorted.length; i++) {
    const last = intervals[intervals.length - 1];
    if (sorted[i].start <= last.end + SPEECH_GAP_TOLERANCE) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      intervals.push({ start: sorted[i].start, end: sorted[i].end });
    }
  }

  return intervals;
}

/**
 * Binary search: is timestamp t inside any speech interval?
 */
function isSpeechAt(t: number, intervals: SpeechInterval[]): boolean {
  let lo = 0;
  let hi = intervals.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const iv = intervals[mid];
    if (t < iv.start) {
      hi = mid - 1;
    } else if (t > iv.end) {
      lo = mid + 1;
    } else {
      return true;
    }
  }

  return false;
}

/**
 * Phase 1: Adjust frame density based on speech activity.
 * Un-flags duplicate frames to achieve:
 *   - 5s intervals during speech
 *   - 15s intervals during silence
 */
function applySpeechDensity(
  frames: FrameInfo[],
  speechIntervals: SpeechInterval[],
): number {
  let unflaggedCount = 0;
  let lastKeptSpeech = -999;
  let lastKeptSilent = -999;

  for (const frame of frames) {
    if (!frame.isDuplicate) {
      // Already kept - update tracking
      if (isSpeechAt(frame.timestamp, speechIntervals)) {
        lastKeptSpeech = frame.timestamp;
      } else {
        lastKeptSilent = frame.timestamp;
      }
      continue;
    }

    const inSpeech = isSpeechAt(frame.timestamp, speechIntervals);

    if (inSpeech) {
      if (frame.timestamp - lastKeptSpeech >= SPEECH_INTERVAL) {
        frame.isDuplicate = false;
        lastKeptSpeech = frame.timestamp;
        unflaggedCount++;
      }
    } else {
      if (frame.timestamp - lastKeptSilent >= SILENT_INTERVAL) {
        frame.isDuplicate = false;
        lastKeptSilent = frame.timestamp;
        unflaggedCount++;
      }
    }
  }

  return unflaggedCount;
}

/**
 * Phase 2: Detect visual changes between consecutive kept frames
 * and un-flag intermediate frames to capture transitions.
 */
function applyVisualRefinement(frames: FrameInfo[]): number {
  // Build ordered list of kept frame indices
  const keptIndices: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (!frames[i].isDuplicate) {
      keptIndices.push(i);
    }
  }

  let unflaggedCount = 0;

  for (let k = 0; k < keptIndices.length - 1; k++) {
    const idxA = keptIndices[k];
    const idxB = keptIndices[k + 1];
    const frameA = frames[idxA];
    const frameB = frames[idxB];

    // Skip if either hash is missing
    if (!frameA.phash || !frameB.phash) continue;

    const distance = pHashDistance(frameA.phash, frameB.phash);

    if (distance <= SAME_THRESHOLD) continue; // visually identical, no refinement

    // Collect intermediate duplicate frames between A and B
    const intermediates: number[] = [];
    for (let i = idxA + 1; i < idxB; i++) {
      if (frames[i].isDuplicate && frames[i].phash) {
        intermediates.push(i);
      }
    }

    if (intermediates.length === 0) continue;

    // Decide how many to un-flag based on change magnitude
    let pickCount: number;
    if (distance <= MODERATE_THRESHOLD) {
      pickCount = 1; // moderate change: 1 intermediate
    } else {
      pickCount = Math.min(3, intermediates.length); // dramatic change: up to 3
    }

    // Pick evenly spaced indices
    const picks: number[] = [];
    if (pickCount === 1) {
      picks.push(intermediates[Math.floor(intermediates.length / 2)]);
    } else {
      for (let p = 0; p < pickCount; p++) {
        const idx = Math.round((p * (intermediates.length - 1)) / (pickCount - 1));
        picks.push(intermediates[idx]);
      }
    }

    for (const idx of picks) {
      frames[idx].isDuplicate = false;
      unflaggedCount++;
    }
  }

  return unflaggedCount;
}

/**
 * Apply adaptive frame sampling to the frame array.
 * Mutates isDuplicate flags in-place based on speech activity and visual changes.
 *
 * @returns summary stats for logging
 */
export function applyAdaptiveSampling(
  frames: FrameInfo[],
  transcript: TranscriptResult,
): { phase1Unflagged: number; phase2Unflagged: number; totalKept: number } {
  const speechIntervals = buildSpeechIntervals(transcript.words);

  // Phase 1: speech-aware density
  const phase1 = applySpeechDensity(frames, speechIntervals);

  // Phase 2: visual change refinement (runs on the updated set from Phase 1)
  const phase2 = applyVisualRefinement(frames);

  const totalKept = frames.filter((f) => !f.isDuplicate).length;

  return { phase1Unflagged: phase1, phase2Unflagged: phase2, totalKept };
}
