import type { Topic, VUDSegment, AIProvider } from '@cutsense/core';

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
    { jsonMode: true, maxTokens: 2048 },
  );

  try {
    const parsed = JSON.parse(response.content);
    const raw = parsed.topics ?? [];

    return raw.map((t: { id: string; label: string; segments: string[] }) => ({
      id: t.id,
      label: t.label,
      segments: t.segments,
      totalDuration: t.segments.reduce((sum: number, segId: string) => {
        const seg = segments.find((s) => s.id === segId);
        return sum + (seg ? seg.duration : 0);
      }, 0),
    }));
  } catch {
    return [];
  }
}
