import type { VUD, EditDecisionList, EditDecision } from '@cutsense/core';

/**
 * Cuts silence gaps >= minGapMs from kept segments by splitting each decision
 * into sub-decisions that cover only the speech spans. The timeline builder
 * and caption planner both support multiple decisions sharing the same segmentId,
 * so this is composable with take-picker and the LLM cut decisions.
 */
export function planSilenceCuts(
  vud: VUD,
  edl: EditDecisionList,
  minGapMs: number,
): EditDecisionList {
  const minGapSec = minGapMs / 1000;
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

    // Only words within the current keep window
    const words = seg.words.filter(
      (w) => w.end > windowStart && w.start < windowEnd,
    );

    if (words.length === 0) {
      newDecisions.push(decision);
      continue;
    }

    // Find all inter-word gaps >= minGapSec
    const gaps: Array<{ gapStart: number; gapEnd: number }> = [];
    for (let i = 0; i < words.length - 1; i++) {
      const gapStart = words[i]!.end;
      const gapEnd = words[i + 1]!.start;
      if (gapEnd - gapStart >= minGapSec) {
        gaps.push({ gapStart, gapEnd });
      }
    }

    if (gaps.length === 0) {
      newDecisions.push(decision);
      continue;
    }

    // Split into speech spans around the gaps
    const spans: Array<{ start: number; end: number }> = [];
    let spanStart = windowStart;

    for (const { gapStart, gapEnd } of gaps) {
      // Keep a 50ms tail into the gap so cuts feel natural (not clipped)
      const spanEnd = Math.min(gapStart + 0.05, gapEnd);
      if (spanEnd > spanStart) {
        spans.push({ start: spanStart, end: spanEnd });
      }
      // Resume 50ms before next speech
      spanStart = Math.max(gapEnd - 0.05, spanStart);
    }

    // Final span: from last gap end to window end
    if (windowEnd > spanStart) {
      spans.push({ start: spanStart, end: windowEnd });
    }

    for (const span of spans) {
      newDecisions.push({
        segmentId: decision.segmentId,
        action: 'keep',
        reason: decision.reason,
        trimStart: span.start,
        trimEnd: span.end,
        transitionBefore: decision.transitionBefore,
      });
    }
  }

  return { ...edl, decisions: newDecisions };
}
