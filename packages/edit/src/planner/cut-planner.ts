import type { VUD, AIProvider, EditDecisionList, EditDecision } from '@cutsense/core';

export async function planCuts(
  vud: VUD,
  instruction: string,
  provider: AIProvider,
  targetDurationSec?: number,
): Promise<EditDecisionList> {
  const segmentData = vud.segments
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
5. Remove dead air (silent segments with no visual change), loading screens, browser navigation that isn't part of the demo, and idle scrolling.
6. Keep segments where the user asks a question (via voice or text visible on screen) AND the segments where the system responds.
7. Prefer high-energy, visually interesting segments.
8. If a target duration is given, get as close as possible.
9. Avoid cutting mid-word or mid-sentence.
10. For screen recordings: keep the full question-answer cycle even if individual segments are low energy.

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

    const keptSegments = decisions.filter((d) => d.action !== 'remove');
    const actualDuration = keptSegments.reduce((sum, d) => {
      const seg = vud.segments.find((s) => s.id === d.segmentId);
      if (!seg) return sum;
      const start = d.trimStart ?? seg.startTime;
      const end = d.trimEnd ?? seg.endTime;
      return sum + (end - start);
    }, 0);

    return {
      jobId: vud.jobId,
      targetDurationSec: targetDurationSec ?? vud.duration,
      actualDurationSec: actualDuration,
      decisions,
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
