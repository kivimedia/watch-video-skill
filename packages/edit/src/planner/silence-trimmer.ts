import type { TranscriptWord } from '@cutsense/core';

export interface SpeechIsland {
  startSec: number;
  endSec: number;
  words: TranscriptWord[];
  /** Accumulated output time (seconds) before this island starts, within the segment. */
  outputOffsetSec: number;
}

/**
 * 100ms of audio after a word's Whisper-reported end time that we keep to
 * avoid chopping the phonetic tail of the last word in an island.
 */
const TRAILING_PAD_SEC = 0.1;

/**
 * Classify a gap boundary based on the punctuation of the preceding word.
 *
 * - sentence  (.!?) → cut at base threshold
 * - clause    (,;:) → cut at 1.5× threshold
 * - mid-word  (none) → cut at 2.5× threshold (avoids cutting inside a thought)
 */
function gapMultiplier(lastWord: TranscriptWord): number {
  const t = lastWord.text.trimEnd();
  if (/[.!?]$/.test(t)) return 1.0;
  if (/[,;:]$/.test(t)) return 2.0;
  return 4.0;
}

/**
 * Splits word-level timestamps into contiguous speech islands by removing
 * silence gaps. Gaps at sentence boundaries use `thresholdSec` exactly;
 * mid-sentence gaps require up to 2.5× that threshold to be removed.
 *
 * A 100ms trailing pad is added to each island's end so the phonetic tail
 * of the last word is preserved and cuts don't sound truncated.
 *
 * When thresholdSec <= 0 the full range is returned as one island (no-op).
 */
export function getSpeechIslands(
  words: TranscriptWord[],
  segStart: number,
  segEnd: number,
  thresholdSec: number,
): SpeechIsland[] {
  if (thresholdSec <= 0 || words.length === 0) {
    return [{ startSec: segStart, endSec: segEnd, words, outputOffsetSec: 0 }];
  }

  const islands: SpeechIsland[] = [];
  let islandWords: TranscriptWord[] = [];
  let islandStart = segStart;
  let outputOffset = 0;
  let prevWordEnd = segStart;

  for (const word of words) {
    const gap = word.start - prevWordEnd;

    if (islandWords.length > 0) {
      const lastWord = islandWords[islandWords.length - 1]!;
      const effectiveThreshold = thresholdSec * gapMultiplier(lastWord);

      if (gap >= effectiveThreshold) {
        // Close the current island. Add trailing pad so the last word's
        // phonetic tail isn't chopped, clamped to segment end.
        const islandEnd = Math.min(prevWordEnd + TRAILING_PAD_SEC, segEnd);
        islands.push({ startSec: islandStart, endSec: islandEnd, words: islandWords, outputOffsetSec: outputOffset });
        outputOffset += islandEnd - islandStart;
        islandWords = [];
        islandStart = word.start;
      }
    } else {
      // First word in a new island - snap start to word start (skip leading silence).
      islandStart = word.start;
    }

    islandWords.push(word);
    prevWordEnd = word.end;
  }

  if (islandWords.length > 0) {
    const islandEnd = Math.min(prevWordEnd + TRAILING_PAD_SEC, segEnd);
    islands.push({ startSec: islandStart, endSec: islandEnd, words: islandWords, outputOffsetSec: outputOffset });
  }

  if (islands.length === 0) {
    return [{ startSec: segStart, endSec: segEnd, words: [], outputOffsetSec: 0 }];
  }

  return islands;
}

/** Total output duration of a set of islands (sum of island lengths). */
export function islandsTotalDuration(islands: SpeechIsland[]): number {
  return islands.reduce((sum, island) => sum + (island.endSec - island.startSec), 0);
}
