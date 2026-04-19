import type { VUD, AIProvider, EditDecisionList, EditDecision } from '@cutsense/core';

const OVER_BUDGET_TOLERANCE = 1.05; // 5% slack before we retry


function buildSegmentData(vud: VUD): string {
  return vud.segments
    .map((s) => {
      const parts = [
        `${s.id}: ${s.startTime.toFixed(1)}s-${s.endTime.toFixed(1)}s (${s.duration.toFixed(1)}s)`,
        `energy=${s.energy.toFixed(2)}`,
      ];
      if (s.transcript) parts.push(`audio="${s.transcript.slice(0, 120)}"`);
      if (s.textOnScreen) parts.push(`screen_text="${s.textOnScreen.slice(0, 200)}"`);
      if (s.visualDescription) parts.push(`visual="${s.visualDescription.slice(0, 150)}"`);
      if (s.sceneType) parts.push(`type=${s.sceneType}`);
      if (s.visualInterest) parts.push(`interest=${s.visualInterest}`);
      if (s.isSilent) parts.push('SILENT');
      return parts.join(' | ');
    })
    .join('\n');
}


function computeKeptDuration(vud: VUD, decisions: EditDecision[]): number {
  return decisions
    .filter((d) => d.action !== 'remove')
    .reduce((sum, d) => {
      const seg = vud.segments.find((s) => s.id === d.segmentId);
      if (!seg) return sum;
      const start = d.trimStart ?? seg.startTime;
      const end = d.trimEnd ?? seg.endTime;
      return sum + Math.max(0, end - start);
    }, 0);
}


export async function planCuts(
  vud: VUD,
  instruction: string,
  provider: AIProvider,
  targetDurationSec?: number,
): Promise<EditDecisionList> {
  const segmentData = buildSegmentData(vud);

  const response = await provider.chat(
    [
      {
        role: 'system',
        content: `You are a professional video editor creating polished walking-monologue videos. Given segments from a video and user instructions, decide which segments to keep, trim, or remove.

CRITICAL RULES:
1. Respect the user's instruction precisely - this is the highest priority.
2. SENTENCE INTEGRITY IS NON-NEGOTIABLE. Never remove a segment that contains the middle of a sentence while keeping the segments on either side of it. Every kept segment must either (a) contain a complete sentence, or (b) connect cleanly to the adjacent kept segment with no missing words in between. If you keep segment A ending mid-sentence and segment B starting with the next sentence, that is a bad cut. Read the audio transcripts of adjacent kept segments aloud in your head - they must flow as natural speech.
3. TRIM ONLY AT SENTENCE BOUNDARIES. When using trimStart/trimEnd, only trim to a point where a complete sentence ends (period, question mark, exclamation mark in the transcript). Never trim to a comma, mid-phrase, or mid-sentence. If you cannot find a clean sentence boundary to trim to, keep the whole segment or remove it entirely.
4. PRESERVE NARRATIVE FLOW: every story beat must be complete. If you keep the setup, keep the payoff. If you keep a claim, keep the evidence or example that follows it.
5. The "screen_text" field shows what text is visible on screen (UI text, chat messages, bot responses). For screen recordings, this is often MORE important than the audio transcript.
6. TRIM VALUES: If you use trimStart/trimEnd, they MUST be within the segment's time range. trimStart >= segment start time. trimEnd <= segment end time. If you don't need to trim, use null for both.
7. Remove dead air between kept segments - but the post-processing pipeline handles silence removal automatically. Your job is to choose WHICH complete sentences and story beats to keep, not to micro-trim within sentences.
8. MICRO-TRIM at sentence edges only: shave leading silence before the first sentence starts, and trailing silence after the last sentence ends. Use trimStart = seg.startTime + (silence before first word) and trimEnd = seg.endTime - (silence after last word). Do NOT trim into sentence content.
9. Prefer high-energy, complete thought segments.
10. TARGET DURATION IS A HARD CAP. The SUM of kept segment durations (after any trimStart/trimEnd) MUST be <= target. Under-budget is fine; over-budget is a failure. Drop whole story beats (complete sentences) to meet the budget - never achieve budget by cutting inside a sentence.
11. Before finalizing: read the transcript of your kept segments in order. If any transition between adjacent segments sounds like a missing word or broken thought, fix it by either keeping the bridging segment or cutting both sides of the break.
12. THE ENDING MUST BE A PAYOFF, NOT A SETUP. The last kept segment must end on a strong, conclusive statement - a claim, a insight, a call to action, or a punchy closer. NEVER end on a sentence that introduces something ("let me give you an example", "here's what I mean", "as I wrap up", "one more thing", "speaking of which", "for instance") - those are bridges to content that was cut and they leave the viewer hanging. If the last segment ends on a bridge phrase, trim it off or choose an earlier segment that ends stronger.

Return ONLY valid JSON (no markdown, no prose):
{
  "decisions": [
    {"segmentId": "seg_001", "action": "keep|trim|remove", "reason": "brief reason", "trimStart": null, "trimEnd": null}
  ],
  "captionMode": "none|standard|jumbo|jumbo-then-standard",
  "transitionDefault": "cut|fade|mixed"
}`,
      },
      {
        role: 'user',
        content: `User instruction: "${instruction}"
${targetDurationSec ? `Target duration: ${targetDurationSec} seconds` : ''}
Total video duration: ${vud.duration.toFixed(1)} seconds

Entities: ${vud.entities.map((e) => `${e.name} (${e.type})`).join(', ') || 'none'}
Topics: ${vud.topics.map((t) => t.label).join(', ') || 'none'}

Segments:
${segmentData}`,
      },
    ],
    { jsonMode: true, maxTokens: 16384 },
  );

  try {
    // LLM may wrap JSON in prose - extract the first JSON object
    let jsonStr = response.content.trim();
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // JSON may be truncated - try to repair by closing open arrays/objects
      let repaired = jsonStr;
      // Close any open "reason" string
      const lastQuote = repaired.lastIndexOf('"');
      const afterLast = repaired.slice(lastQuote + 1).trim();
      if (!afterLast.includes('}')) {
        repaired = repaired.slice(0, lastQuote + 1) + '}]}';
      }
      // Count open braces/brackets and close them
      const opens = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
      const braces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
      repaired += ']'.repeat(Math.max(0, opens)) + '}'.repeat(Math.max(0, braces));
      parsed = JSON.parse(repaired);
      console.error(`[cut-planner] Repaired truncated JSON (${vud.segments.length} segments, recovered ${(parsed.decisions ?? []).length} decisions)`);
    }

    const decisions: EditDecision[] = (parsed.decisions ?? []).map(
      (d: Record<string, unknown>) => {
        const segId = String(d.segmentId ?? '');
        const seg = vud.segments.find((s) => s.id === segId);

        let trimStart = typeof d.trimStart === 'number' ? d.trimStart : undefined;
        let trimEnd = typeof d.trimEnd === 'number' ? d.trimEnd : undefined;

        // Post-process: clamp trim values to segment boundaries
        if (seg) {
          if (trimStart !== undefined) trimStart = Math.max(trimStart, seg.startTime);
          if (trimEnd !== undefined) trimEnd = Math.min(trimEnd, seg.endTime);
          if (trimStart !== undefined && trimEnd !== undefined && trimEnd <= trimStart) {
            // Invalid trim range - use full segment
            trimStart = undefined;
            trimEnd = undefined;
          }
        }

        return {
          segmentId: segId,
          action: (d.action as EditDecision['action']) ?? 'keep',
          reason: String(d.reason ?? ''),
          trimStart,
          trimEnd,
          transitionBefore: d.transitionBefore as EditDecision['transitionBefore'],
        };
      },
    );

    let finalDecisions = decisions;
    let actualDuration = computeKeptDuration(vud, finalDecisions);

    // Second pass: if we're meaningfully over the target, re-prompt the
    // LLM with the overage as a hint. The model almost always has room to
    // trim filler/dead air when told it missed the budget.
    if (
      targetDurationSec !== undefined &&
      targetDurationSec > 0 &&
      actualDuration > targetDurationSec * OVER_BUDGET_TOLERANCE
    ) {
      const overageSec = actualDuration - targetDurationSec;
      const minSegments = Math.max(3, Math.floor(vud.segments.length * 0.3));

      // Build segment data from ONLY the first-pass kept segments so the model
      // tightens the existing selection rather than re-planning from scratch.
      // Sending the full segment list caused the model to drop everything.
      const keptSegmentData = decisions
        .filter((d) => d.action !== 'remove')
        .map((d) => {
          const seg = vud.segments.find((s) => s.id === d.segmentId);
          if (!seg) return null;
          const effectiveStart = d.trimStart ?? seg.startTime;
          const effectiveEnd = d.trimEnd ?? seg.endTime;
          const parts = [
            `${seg.id}: ${effectiveStart.toFixed(1)}s-${effectiveEnd.toFixed(1)}s (${(effectiveEnd - effectiveStart).toFixed(1)}s) [first-pass: ${d.action}]`,
            `energy=${seg.energy.toFixed(2)}`,
          ];
          if (seg.transcript) parts.push(`audio="${seg.transcript.slice(0, 120)}"`);
          if (seg.textOnScreen) parts.push(`screen_text="${seg.textOnScreen.slice(0, 200)}"`);
          if (seg.visualDescription) parts.push(`visual="${seg.visualDescription.slice(0, 150)}"`);
          if (seg.sceneType) parts.push(`type=${seg.sceneType}`);
          if (seg.visualInterest) parts.push(`interest=${seg.visualInterest}`);
          if (seg.isSilent) parts.push('SILENT');
          return parts.join(' | ');
        })
        .filter(Boolean)
        .join('\n');

      const tightenResponse = await provider.chat(
        [
          {
            role: 'system',
            content: `You are re-planning the edit. The previous plan was over budget and will be rejected. Apply the same rules as before:
- SENTENCE INTEGRITY IS NON-NEGOTIABLE. Never cut mid-sentence. Only trim at sentence boundaries (. ! ?).
- PRESERVE NARRATIVE FLOW. If you keep a setup, keep its payoff.
- THE ENDING MUST BE A PAYOFF. Never end on a bridge phrase.
- You MUST keep at least ${minSegments} segments. Removing all segments or collapsing to 1-2 clips is never acceptable.`,
          },
          {
            role: 'user',
            content: `The first pass kept ${actualDuration.toFixed(1)}s against a hard target of ${targetDurationSec}s. That's ${overageSec.toFixed(1)}s over budget. Tighten it by ~${overageSec.toFixed(1)}s: drop ONE weak middle segment from the kept list, or shave trimStart/trimEnd on existing kept segments (breath pauses, filler, tails).

HARD CONSTRAINTS:
- Total kept duration MUST be <= ${targetDurationSec}s (hard cap)
- Total kept duration MUST be >= ${Math.round(targetDurationSec * 0.75)}s (don't strip the video to nothing)
- Keep the hook (first kept segment) and the payoff (final kept segment)
- You MUST return at least ${minSegments} segments with action "keep" or "trim" - returning fewer is a failure
- Only segments listed below exist in the first-pass plan. Do NOT introduce segment IDs not in this list.

Original instruction: "${instruction}"

FIRST-PASS KEPT SEGMENTS (work only from this list):
${keptSegmentData}

Return ONLY valid JSON in the same shape as before. Include ALL kept segments in your response (even unchanged ones).`,
          },
        ],
        { jsonMode: true, maxTokens: 16384 },
      );

      try {
        let tightJson = tightenResponse.content.trim();
        const ts = tightJson.indexOf('{');
        const te = tightJson.lastIndexOf('}');
        if (ts >= 0 && te > ts) tightJson = tightJson.slice(ts, te + 1);
        const tightParsed = JSON.parse(tightJson);
        const tightDecisions: EditDecision[] = (tightParsed.decisions ?? []).map(
          (d: Record<string, unknown>) => {
            const segId = String(d.segmentId ?? '');
            const seg = vud.segments.find((s) => s.id === segId);
            let trimStart = typeof d.trimStart === 'number' ? d.trimStart : undefined;
            let trimEnd = typeof d.trimEnd === 'number' ? d.trimEnd : undefined;
            if (seg) {
              if (trimStart !== undefined) trimStart = Math.max(trimStart, seg.startTime);
              if (trimEnd !== undefined) trimEnd = Math.min(trimEnd, seg.endTime);
              if (trimStart !== undefined && trimEnd !== undefined && trimEnd <= trimStart) {
                trimStart = undefined;
                trimEnd = undefined;
              }
            }
            return {
              segmentId: segId,
              action: (d.action as EditDecision['action']) ?? 'keep',
              reason: String(d.reason ?? ''),
              trimStart,
              trimEnd,
              transitionBefore: d.transitionBefore as EditDecision['transitionBefore'],
            };
          },
        );
        const tightDuration = computeKeptDuration(vud, tightDecisions);
        const tightKept = tightDecisions.filter((d) => d.action !== 'remove').length;
        const minAcceptable = targetDurationSec * 0.6;
        // Only adopt the tighter plan if:
        // - it kept at least one segment (zero clips is a bad output, not tightening)
        // - it didn't over-correct below 60% of the target (prevents "shaved to nothing")
        // - and it actually got closer to the target than the first pass
        if (
          tightKept > 0 &&
          tightDuration >= minAcceptable &&
          tightDuration < actualDuration
        ) {
          finalDecisions = tightDecisions;
          actualDuration = tightDuration;
          console.error(`[cut-planner] Retried for budget: ${overageSec.toFixed(1)}s over target -> tightened to ${tightDuration.toFixed(1)}s (${tightKept} clips)`);
        } else {
          console.error(`[cut-planner] Retry rejected (${tightKept} clips, ${tightDuration.toFixed(1)}s; keeping first pass at ${actualDuration.toFixed(1)}s)`);
        }
      } catch (retryErr) {
        console.error(`[cut-planner] Retry parse failed, keeping first pass: ${retryErr}`);
      }
    }

    return {
      jobId: vud.jobId,
      targetDurationSec: targetDurationSec ?? vud.duration,
      actualDurationSec: actualDuration,
      decisions: finalDecisions,
      captionMode: parsed.captionMode ?? 'none',
      transitionDefault: parsed.transitionDefault ?? 'cut',
    };
  } catch (err) {
    // Fallback: keep all segments
    console.error(`[cut-planner] Failed to parse LLM response: ${err}. Keeping all segments.`);
    return {
      jobId: vud.jobId,
      targetDurationSec: targetDurationSec ?? vud.duration,
      actualDurationSec: vud.duration,
      decisions: vud.segments.map((s) => ({
        segmentId: s.id,
        action: 'keep' as const,
        reason: 'Fallback: LLM output could not be parsed',
      })),
      captionMode: 'none',
      transitionDefault: 'cut',
    };
  }
}
