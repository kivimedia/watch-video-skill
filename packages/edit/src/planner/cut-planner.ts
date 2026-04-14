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
      if (s.transcript) parts.push(`"${s.transcript.slice(0, 120)}"`);
      if (s.visualDescription) parts.push(`visual="${s.visualDescription.slice(0, 200)}"`);
      if (s.sceneType) parts.push(`type=${s.sceneType}`);
      if (s.visualInterest) parts.push(`visual_interest=${s.visualInterest}`);
      if (s.topics.length) parts.push(`topics=[${s.topics.join(',')}]`);
      return parts.join(' | ');
    })
    .join('\n');

  const response = await provider.chat(
    [
      {
        role: 'system',
        content: `You are a professional video editor. Given a Video Understanding Document and user instructions, decide which segments to keep, trim, or remove.

Rules:
- Respect the user's instruction precisely - this is the highest priority
- When the instruction references a specific person, appearance, or visual element, use the "visual" field in each segment to determine which segments show that person/element. REMOVE all segments that do not match.
- Prefer high-energy, visually interesting segments
- If a target duration is given, get as close as possible
- Explain WHY each major segment was kept or removed
- Avoid cutting mid-word or mid-gesture when possible
- Consider narrative flow and pacing
- When in doubt about whether a segment matches the instruction, REMOVE it rather than keep it

Return ONLY valid JSON:
{
  "decisions": [
    {"segmentId": "seg_001", "action": "keep|trim|remove", "reason": "...", "trimStart": null, "trimEnd": null}
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
      (d: Record<string, unknown>) => ({
        segmentId: String(d.segmentId ?? ''),
        action: (d.action as EditDecision['action']) ?? 'keep',
        reason: String(d.reason ?? ''),
        trimStart: typeof d.trimStart === 'number' ? d.trimStart : undefined,
        trimEnd: typeof d.trimEnd === 'number' ? d.trimEnd : undefined,
        transitionBefore: d.transitionBefore as EditDecision['transitionBefore'],
      }),
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
