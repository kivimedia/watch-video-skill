import type { TranscriptWord } from '@cutsense/core';

export interface SpeechIsland {
  startSec: number;
  endSec: number;
  words: TranscriptWord[];
  /** Accumulated output time (seconds) before this island starts, within the segment. */
  outputOffsetSec: number;
}

/**
 * Splits word-level timestamps into contiguous speech islands by removing
 * silence gaps >= thresholdSec. Used by both the timeline builder and caption
 * planner so that clip boundaries and caption frames stay in sync.
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

    if (islandWords.length > 0 && gap >= thresholdSec) {
      // Close the current island at the last word's end.
      const islandEnd = prevWordEnd;
      islands.push({ startSec: islandStart, endSec: islandEnd, words: islandWords, outputOffsetSec: outputOffset });
      outputOffset += islandEnd - islandStart;
      islandWords = [];
      islandStart = word.start;
    } else if (islandWords.length === 0) {
      // First word in a new island - snap start to word start (skip leading silence).
      islandStart = word.start;
    }

    islandWords.push(word);
    prevWordEnd = word.end;
  }

  if (islandWords.length > 0) {
    islands.push({ startSec: islandStart, endSec: prevWordEnd, words: islandWords, outputOffsetSec: outputOffset });
  }

  if (islands.length === 0) {
    // No words at all - keep the original range untouched.
    return [{ startSec: segStart, endSec: segEnd, words: [], outputOffsetSec: 0 }];
  }

  return islands;
}

/** Total output duration of a set of islands (sum of island lengths). */
export function islandsTotalDuration(islands: SpeechIsland[]): number {
  return islands.reduce((sum, island) => sum + (island.endSec - island.startSec), 0);
}
