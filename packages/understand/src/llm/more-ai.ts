import type { VUD, MoreAIAnalysis, AIProvider } from '@cutsense/core';

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
    { jsonMode: true, maxTokens: 4096 },
  );

  try {
    const parsed = JSON.parse(response.content);
    return {
      sentiment: parsed.sentiment ?? [],
      bRollOpportunities: parsed.bRollOpportunities ?? [],
      pacingRecommendations: parsed.pacingRecommendations ?? [],
      editorialNotes: parsed.editorialNotes ?? '',
    };
  } catch {
    return {
      sentiment: [],
      bRollOpportunities: [],
      pacingRecommendations: [],
      editorialNotes: 'MORE AI analysis could not be parsed.',
    };
  }
}
