import type { Entity, VUDSegment, AIProvider } from '@cutsense/core';

export async function extractEntities(
  segments: VUDSegment[],
  provider: AIProvider,
): Promise<Entity[]> {
  const fullText = segments.map((s, i) => `[Segment ${i}] ${s.transcript}`).join('\n');

  const response = await provider.chat(
    [
      {
        role: 'system',
        content: `You are an entity extraction system. Extract all named entities (people, places, products, organizations, concepts) from the video transcript segments below. Return ONLY valid JSON array.

Each entity: {"id": "entity_<slug>", "name": "<name>", "type": "person|place|product|organization|concept", "role": "<role if known>", "mentions": [<segment indices>]}

Be thorough. Track recurring entities across segments. Use consistent IDs.`,
      },
      { role: 'user', content: fullText },
    ],
    { jsonMode: true, maxTokens: 2048 },
  );

  try {
    const parsed = JSON.parse(response.content);
    const raw: Array<{ id: string; name: string; type: string; role?: string; mentions: number[] }> =
      Array.isArray(parsed) ? parsed : parsed.entities ?? [];

    return raw.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type as Entity['type'],
      role: e.role,
      mentions: e.mentions,
      totalScreenTime: e.mentions.reduce((sum, idx) => {
        const seg = segments[idx];
        return sum + (seg ? seg.duration : 0);
      }, 0),
    }));
  } catch {
    return [];
  }
}
