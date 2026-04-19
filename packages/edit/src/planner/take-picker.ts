import type { VUD, EditDecisionList, EditDecision, TranscriptWord, VUDSegment } from '@cutsense/core';

export interface TakeDecisionLog {
  segmentId: string;
  phrase: string;
  takes: Array<{
    start: number;
    end: number;
    audioConfidence: number;
    visualScore: number;
    combinedScore: number;
    kept: boolean;
  }>;
}

export interface TakePickerResult {
  edl: EditDecisionList;
  log: TakeDecisionLog[];
}

/**
 * Detects repeated lines within kept segments and keeps only the best take.
 *
 * Scoring: 70% Whisper per-word confidence (audio delivery quality) +
 * 30% VUD visual score (energy, blur/shake penalty). When both takes fall
 * within the same VUD segment (common for walking videos), visual scores
 * tie and last-take wins as a tiebreaker.
 *
 * Uses N-gram sliding window (N=6 words) with normalized string matching
 * to detect phrase repeats with >= 0.75 word-overlap ratio.
 */
export function pickBestTakes(
  vud: VUD,
  edl: EditDecisionList,
): TakePickerResult {
  const log: TakeDecisionLog[] = [];
  const newDecisions: EditDecision[] = [];

  for (const decision of edl.decisions) {
    if (decision.action === 'remove') {
      newDecisions.push(decision);
      continue;
    }

    const seg = vud.segments.find((s) => s.id === decision.segmentId);
    if (!seg) {
      newDecisions.push(decision);
      continue;
    }

    const windowStart = decision.trimStart ?? seg.startTime;
    const windowEnd = decision.trimEnd ?? seg.endTime;

    const words = seg.words.filter(
      (w) => w.end > windowStart && w.start < windowEnd,
    );

    if (words.length < 12) {
      // Too short to contain meaningful repeats
      newDecisions.push(decision);
      continue;
    }

    const repeatClusters = detectRepeats(words, 6, 0.75);

    if (repeatClusters.length === 0) {
      newDecisions.push(decision);
      continue;
    }

    // Build a sorted list of spans to REMOVE (losers)
    const removeSpans: Array<{ start: number; end: number }> = [];

    for (const cluster of repeatClusters) {
      const scored = cluster.map((span) => ({
        ...span,
        audioConfidence: meanConfidence(span.words),
        visualScore: visualScore(vud, span.start, span.end),
      }));

      // Combined score (0-1). In case of tie, later take wins (higher start).
      scored.sort((a, b) => {
        const scoreA = 0.7 * a.audioConfidence + 0.3 * a.visualScore;
        const scoreB = 0.7 * b.audioConfidence + 0.3 * b.visualScore;
        if (Math.abs(scoreA - scoreB) < 0.02) return a.start - b.start; // earlier = loser
        return scoreB - scoreA; // higher score wins
      });

      const winner = scored[0]!;
      const losers = scored.slice(1);

      log.push({
        segmentId: decision.segmentId,
        phrase: winner.words
          .slice(0, 5)
          .map((w) => w.text)
          .join(' '),
        takes: scored.map((s, i) => ({
          start: s.start,
          end: s.end,
          audioConfidence: s.audioConfidence,
          visualScore: s.visualScore,
          combinedScore: 0.7 * s.audioConfidence + 0.3 * s.visualScore,
          kept: i === 0,
        })),
      });

      for (const loser of losers) {
        removeSpans.push({ start: loser.start, end: loser.end });
      }
    }

    if (removeSpans.length === 0) {
      newDecisions.push(decision);
      continue;
    }

    // Merge overlapping remove spans
    const merged = mergeSpans(removeSpans);

    // Split original decision around the removed spans
    const subDecisions = splitAroundRemovals(decision, windowStart, windowEnd, merged);
    newDecisions.push(...subDecisions);
  }

  return { edl: { ...edl, decisions: newDecisions }, log };
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface TakeSpan {
  start: number;
  end: number;
  words: TranscriptWord[];
}

function normalizeWord(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u0080-\uFFFF]/g, '');
}

/**
 * Finds clusters of repeated phrase spans using N-gram overlap.
 * Returns arrays of same-phrase spans (each array = one repeated phrase).
 */
function detectRepeats(
  words: TranscriptWord[],
  ngramSize: number,
  minOverlap: number,
): TakeSpan[][] {
  const normalized = words.map((w) => normalizeWord(w.text));
  const clusters: TakeSpan[][] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i <= words.length - ngramSize; i++) {
    if (usedIndices.has(i)) continue;

    const queryNgram = normalized.slice(i, i + ngramSize);

    for (let j = i + ngramSize; j <= words.length - ngramSize; j++) {
      if (usedIndices.has(j)) continue;

      const candidateNgram = normalized.slice(j, j + ngramSize);
      const overlap = ngramOverlap(queryNgram, candidateNgram);

      if (overlap >= minOverlap) {
        // Expand both spans forward to capture the full phrase
        const spanA = expandSpan(words, normalized, i, ngramSize);
        const spanB = expandSpan(words, normalized, j, ngramSize);

        if (spanA && spanB) {
          // Mark all indices as used
          for (let k = spanA.startIdx; k <= spanA.endIdx; k++) usedIndices.add(k);
          for (let k = spanB.startIdx; k <= spanB.endIdx; k++) usedIndices.add(k);

          clusters.push([
            { start: words[spanA.startIdx]!.start, end: words[spanA.endIdx]!.end, words: words.slice(spanA.startIdx, spanA.endIdx + 1) },
            { start: words[spanB.startIdx]!.start, end: words[spanB.endIdx]!.end, words: words.slice(spanB.startIdx, spanB.endIdx + 1) },
          ]);
          break; // Only match first pair per anchor
        }
      }
    }
  }

  return clusters;
}

function ngramOverlap(a: string[], b: string[]): number {
  let matches = 0;
  const bSet = new Set(b);
  for (const token of a) {
    if (token && bSet.has(token)) matches++;
  }
  return matches / a.length;
}

interface ExpandedSpan {
  startIdx: number;
  endIdx: number;
}

/**
 * Expands from anchor index forward/backward while words keep matching,
 * up to a max expansion of ngramSize * 2 to capture the full phrase.
 */
function expandSpan(
  words: TranscriptWord[],
  normalized: string[],
  startIdx: number,
  ngramSize: number,
): ExpandedSpan | null {
  const endIdx = Math.min(startIdx + ngramSize - 1, words.length - 1);
  if (!words[startIdx] || !words[endIdx]) return null;
  return { startIdx, endIdx };
}

function meanConfidence(words: TranscriptWord[]): number {
  const withConf = words.filter((w) => w.confidence !== undefined);
  if (withConf.length === 0) return 0.7; // Default if Whisper didn't emit confidence
  return withConf.reduce((s, w) => s + w.confidence!, 0) / withConf.length;
}

function visualScore(vud: VUD, start: number, end: number): number {
  // Find VUD segments that overlap the take's time range
  const overlapping = vud.segments.filter(
    (s: VUDSegment) => s.endTime > start && s.startTime < end,
  );

  if (overlapping.length === 0) return 0.5;

  // Score based on visual quality indicators available in VUDSegment:
  // - isSilent: penalty (no speech)
  // - isBlurry: penalty (bad frame quality)
  // - cameraMotion: penalty for unstable motion (handheld/shake)
  // - energy: direct score (higher = more engaged)
  let totalScore = 0;
  for (const seg of overlapping) {
    let segScore = 0.5;
    if (typeof seg.energy === 'number') segScore = Math.min(1, seg.energy);
    if (seg.isBlurry) segScore *= 0.6;
    if (seg.isSilent) segScore *= 0.4;
    const motion = (seg.cameraMotion ?? '').toLowerCase();
    if (motion.includes('shake') || motion.includes('unstable')) segScore *= 0.7;
    totalScore += segScore;
  }

  return totalScore / overlapping.length;
}

function mergeSpans(
  spans: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]!;
    const curr = sorted[i]!;
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

/**
 * Splits one keep-decision into sub-decisions that skip the removed spans.
 */
function splitAroundRemovals(
  decision: EditDecision,
  windowStart: number,
  windowEnd: number,
  removeSpans: Array<{ start: number; end: number }>,
): EditDecision[] {
  const result: EditDecision[] = [];
  let cursor = windowStart;

  for (const span of removeSpans) {
    if (span.start > cursor) {
      result.push({
        segmentId: decision.segmentId,
        action: 'keep',
        reason: decision.reason,
        trimStart: cursor,
        trimEnd: span.start,
        transitionBefore: decision.transitionBefore,
      });
    }
    cursor = span.end;
  }

  if (cursor < windowEnd) {
    result.push({
      segmentId: decision.segmentId,
      action: 'keep',
      reason: decision.reason,
      trimStart: cursor,
      trimEnd: windowEnd,
      transitionBefore: decision.transitionBefore,
    });
  }

  // If nothing was actually removable (all spans outside window), keep original
  if (result.length === 0) {
    result.push(decision);
  }

  return result;
}
