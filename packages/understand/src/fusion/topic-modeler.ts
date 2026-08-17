import type { Topic, VUDSegment, AIProvider } from '@cutsense/core';
import { salvageJson } from '../llm/json-salvage.js';

export async function extractTopics(
  segments: VUDSegment[],
  provider: AIProvider,
): Promise<Topic[]> {
  const segmentSummaries = segments
    .map((s, i) => `[${i}] (${s.startTime.toFixed(1)}s-${s.endTime.toFixed(1)}s) ${s.transcript.slice(0, 200)}`)
    .join('\n');

  const response = await provider.chat(
    [
      {
        role: 'system',
        content: `You are a topic modeling system for video content. Assign 1-3 concise topic tags to each segment. Then aggregate into a topic list.

Return ONLY valid JSON: {"topics": [{"id": "topic_<slug>", "label": "<Topic Name>", "segments": ["seg_001", ...]}]}

Use descriptive, searchable labels like "Product Demo", "Customer Testimonial", "Opening Remarks". Keep to 3-8 total topics.`,
      },
      { role: 'user', content: segmentSummaries },
    ],
    // The topic list is short, but the segment listing fed in is not, and the old 2048 cap
    // could be spent before the closing brace. Failing that parse returned [], which is
    // indistinguishable from a video with no discernible topics.
    { jsonMode: true, maxTokens: 8192 },
  );

  const { value: parsed, truncated } = salvageJson<{ topics?: unknown }>(response.content);

  if (parsed === null) {
    console.warn(
      `[topic-modeler] response did not parse (${response.content.length} chars). ` +
        `Returning no topics, which is a failure and not a topicless video.`,
    );
    return [];
  }
  if (truncated) {
    console.warn('[topic-modeler] response was truncated; recovered the complete topics only.');
  }

  const raw = (Array.isArray(parsed) ? parsed : (parsed.topics ?? [])) as Array<{
    id?: string;
    label?: string;
    segments?: string[];
  }>;

  return raw
    .filter((t) => t && typeof t.label === 'string' && t.label.length > 0)
    .map((t) => {
      const segIds = Array.isArray(t.segments) ? t.segments : [];
      return {
        id: t.id ?? `topic_${t.label!.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: t.label!,
        segments: segIds,
        totalDuration: segIds.reduce((sum: number, segId: string) => {
          const seg = segments.find((s) => s.id === segId);
          return sum + (seg ? seg.duration : 0);
        }, 0),
      };
    });
}
