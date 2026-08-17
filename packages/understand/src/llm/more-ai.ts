import type { VUD, MoreAIAnalysis, AIProvider } from '@cutsense/core';
import { salvageJson } from './json-salvage.js';

export async function enhanceVUD(vud: VUD, provider: AIProvider): Promise<MoreAIAnalysis> {
  const segmentData = vud.segments
    .map((s) => `[${s.id}] ${s.startTime.toFixed(1)}s: energy=${s.energy.toFixed(2)} "${s.transcript.slice(0, 100)}"`)
    .join('\n');

  const response = await provider.chat(
    [
      {
        role: 'system',
        content: `You are an advanced video analysis system in MORE AI mode. Provide deeper editorial intelligence.

Return ONLY valid JSON:
{
  "sentiment": [{"time": <seconds>, "sentiment": <-1 to 1>, "label": "<emotion>"}],
  "bRollOpportunities": [{"afterSegmentId": "<id>", "suggestedContent": "<description>", "reason": "<why>"}],
  "pacingRecommendations": ["<suggestion>", ...],
  "editorialNotes": "<overall editorial advice>"
}`,
      },
      {
        role: 'user',
        content: `Video: ${vud.duration.toFixed(1)}s, ${vud.language}, ${vud.segments.length} segments
Entities: ${vud.entities.map((e) => e.name).join(', ')}
Topics: ${vud.topics.map((t) => t.label).join(', ')}

Segments:
${segmentData}`,
      },
    ],
    // The sentiment array is asked for per moment across every segment, so on a long video
    // this was the first thing to overrun 4096 and truncate the object before its closing
    // brace. The old empty catch then reported "could not be parsed" for both a genuine
    // refusal and a token overrun, which are very different problems.
    { jsonMode: true, maxTokens: 16384 },
  );

  const { value: parsed, truncated } = salvageJson<{
    sentiment?: MoreAIAnalysis['sentiment'];
    bRollOpportunities?: MoreAIAnalysis['bRollOpportunities'];
    pacingRecommendations?: MoreAIAnalysis['pacingRecommendations'];
    editorialNotes?: string;
  }>(response.content);

  if (parsed === null) {
    console.warn(`[more-ai] response did not parse (${response.content.length} chars).`);
    return {
      sentiment: [],
      bRollOpportunities: [],
      pacingRecommendations: [],
      editorialNotes: 'MORE AI analysis could not be parsed.',
    };
  }
  if (truncated) {
    console.warn('[more-ai] response was truncated; recovered the complete entries only.');
  }

  return {
    sentiment: parsed.sentiment ?? [],
    bRollOpportunities: parsed.bRollOpportunities ?? [],
    pacingRecommendations: parsed.pacingRecommendations ?? [],
    editorialNotes:
      parsed.editorialNotes ?? (truncated ? 'Partial analysis: the response was truncated.' : ''),
  };
}
