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
        content: `You are a professional video editor creating polished demo/highlight videos. Given segments from a video and user instructions, decide which segments to keep, trim, or remove.

CRITICAL RULES:
1. Respect the user's instruction precisely - this is the highest priority.
2. PRESERVE NARRATIVE FLOW: For demo/tutorial videos, every question or prompt from the user MUST be followed by the system's response. Never show an answer without the question that triggered it. Never show a question without its answer.
3. The "screen_text" field shows what text is visible on screen (UI text, chat messages, bot responses). For screen recordings, this is often MORE important than the audio transcript. Use it to understand what the user typed/asked and what the system responded.
4. TRIM VALUES: If you use trimStart/trimEnd, they MUST be within the segment's time range. trimStart >= segment start time. trimEnd <= segment end time. If you don't need to trim, use null for both.
5. AGGRESSIVELY remove dead air: silent gaps, breath pauses longer than ~0.4s, loading screens, browser navigation that isn't part of the demo, idle scrolling. This is the difference between a tight cut and a flabby one.
6. MICRO-TRIM WITHIN KEPT SEGMENTS using trimStart/trimEnd. A segment doesn't have to be kept whole - shave the leading/trailing silence, the filler words ("um", "uh", "like", "you know", "so"), the restart after a stumble, and the tail after the sentence lands. For a 10s segment where the speaker pauses for 1.5s at the start, trimStart = seg.startTime + 1.5.
7. Keep segments where the user asks a question (via voice or text visible on screen) AND the segments where the system responds.
8. Prefer high-energy, visually interesting segments.
9. TARGET DURATION IS A HARD CAP. If a target duration is given, the SUM of kept segment durations (after any trimStart/trimEnd) MUST be <= target. Under-budget is fine; over-budget is a failure. Before emitting JSON, mentally sum the kept durations and verify. If over, drop the lowest-value segments or trim harder - do not stretch the budget.
10. Avoid cutting mid-word or mid-sentence (use word-level timing in the transcript to choose trim points on sentence boundaries).
11. For screen recordings: keep the full question-answer cycle even if individual segments are low energy.

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
      const tightenResponse = await provider.chat(
        [
          {
            role: 'system',
            content: `You are re-planning the edit. The previous plan was over budget and will be rejected. Apply the same rules as before, but tighten the result.`,
          },
          {
            role: 'user',
            content: `Previous plan kept ${actualDuration.toFixed(1)}s against a hard target of ${targetDurationSec}s. That's ${overageSec.toFixed(1)}s over. Tighten it by ~${overageSec.toFixed(1)}s: drop ONE weak middle segment, or shave trimStart/trimEnd on kept segments (breath pauses, filler, tails).

HARD CONSTRAINTS on the new plan:
- Total kept duration MUST be <= ${targetDurationSec}s (hard cap)
- Total kept duration MUST be >= ${Math.round(targetDurationSec * 0.75)}s (don't strip the video to nothing)
- Keep the hook (first meaningful segment) and the payoff (final takeaway)
- Keep at least ${Math.max(3, Math.floor(vud.segments.length * 0.3))} segments - don't collapse the arc

Original instruction: "${instruction}"
Total video duration: ${vud.duration.toFixed(1)} seconds

Segments:
${segmentData}

Return ONLY valid JSON in the same shape as before.`,
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
