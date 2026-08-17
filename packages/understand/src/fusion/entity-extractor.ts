import type { Entity, VUDSegment, AIProvider } from '@cutsense/core';
import { salvageJson } from '../llm/json-salvage.js';

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
    // 8192, not 2048: the prompt says "be thorough" over every segment, and a long
    // transcript overran the old cap mid-array. The parse then threw into an empty catch
    // that returned [], which reads exactly like a video containing no entities at all.
    { jsonMode: true, maxTokens: 8192 },
  );

  const { value: parsed, truncated } = salvageJson<
    { entities?: unknown } | unknown[]
  >(response.content);

  if (parsed === null) {
    console.warn(
      `[entity-extractor] response did not parse (${response.content.length} chars). ` +
        `Returning no entities, which is a failure and not an empty video.`,
    );
    return [];
  }
  if (truncated) {
    console.warn('[entity-extractor] response was truncated; recovered the complete entries only.');
  }

  const raw = (Array.isArray(parsed)
    ? parsed
    : ((parsed as { entities?: unknown }).entities ?? [])) as Array<{
    id?: string;
    name?: string;
    type?: string;
    role?: string;
    mentions?: number[];
  }>;

  return raw
    .filter((e) => e && typeof e.name === 'string' && e.name.length > 0)
    .map((e) => {
      const mentions = Array.isArray(e.mentions) ? e.mentions : [];
      return {
        id: e.id ?? `entity_${e.name!.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name: e.name!,
        type: e.type as Entity['type'],
        role: e.role,
        mentions,
        totalScreenTime: mentions.reduce((sum, idx) => {
          const seg = segments[idx];
          return sum + (seg ? seg.duration : 0);
        }, 0),
      };
    });
}
