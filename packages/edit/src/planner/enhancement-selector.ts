/**
 * Enhancement selector - decides which segments should be upgraded
 * from standard Remotion clips to Revideo-enhanced inserts.
 *
 * Default rule: Use Remotion unless there is a clear reason to escalate.
 *
 * Candidates for enhancement:
 * - Educational emphasis
 * - Precision zoom on a subject/object/screen area
 * - Motion-led explanation
 * - Animated annotation or callout
 * - Polished reveal of a concept or feature
 * - Chart/graph/diagram animation
 * - Premium visual treatment
 *
 * Stays standard:
 * - Talking-head editing
 * - Podcast clipping
 * - Ordinary b-roll
 * - Standard captioned short-form
 * - Simple transitions
 */

import type {
  VUD,
  EditDecisionList,
  EnhancementDecision,
  EnhancementType,
  EnhancementDecisionReason,
  AIProvider,
} from '@cutsense/core';

export interface EnhancementSelectorOptions {
  /** Force all kept segments to standard (no enhancement) */
  forceStandard?: boolean;
  /** Force specific segments to be enhanced */
  forceEnhancedSegments?: string[];
  /** Max segments to enhance (budget control) */
  maxEnhancedSegments?: number;
}

export async function selectEnhancements(
  vud: VUD,
  edl: EditDecisionList,
  provider: AIProvider,
  options: EnhancementSelectorOptions = {},
): Promise<EnhancementDecision[]> {
  if (options.forceStandard) {
    return edl.decisions
      .filter((d) => d.action !== 'remove')
      .map((d) => ({
        segmentId: d.segmentId,
        level: 'standard' as const,
        reason: 'not_needed' as const,
        confidence: 1.0,
      }));
  }

  const keptDecisions = edl.decisions.filter((d) => d.action !== 'remove');
  const decisions: EnhancementDecision[] = [];

  // First pass: rule-based detection
  for (const decision of keptDecisions) {
    const seg = vud.segments.find((s) => s.id === decision.segmentId);
    if (!seg) {
      decisions.push({
        segmentId: decision.segmentId,
        level: 'standard',
        reason: 'not_needed',
        confidence: 1.0,
      });
      continue;
    }

    // Check if user explicitly requested enhancement for this segment
    if (options.forceEnhancedSegments?.includes(seg.id)) {
      decisions.push({
        segmentId: seg.id,
        level: 'enhancement_required',
        reason: 'user_requested',
        enhancementType: 'custom',
        confidence: 1.0,
      });
      continue;
    }

    const result = evaluateSegment(seg, vud);
    decisions.push(result);
  }

  // Apply max enhanced segments limit
  if (options.maxEnhancedSegments !== undefined) {
    const enhanced = decisions.filter((d) => d.level !== 'standard');
    if (enhanced.length > options.maxEnhancedSegments) {
      // Sort by confidence desc, keep only top N
      enhanced.sort((a, b) => b.confidence - a.confidence);
      const toDowngrade = enhanced.slice(options.maxEnhancedSegments);
      for (const d of toDowngrade) {
        d.level = 'standard';
        d.reason = 'not_needed';
      }
    }
  }

  return decisions;
}

function evaluateSegment(
  seg: { id: string; sceneType?: string; visualDescription?: string; textOnScreen?: string; transcript: string; energy: number; visualInterest?: number },
  vud: VUD,
): EnhancementDecision {
  // Screen recording with text on screen = candidate for zoom callout
  if (seg.sceneType === 'screenrec' && seg.textOnScreen) {
    return {
      segmentId: seg.id,
      level: 'enhancement_candidate',
      reason: 'precision_zoom',
      enhancementType: 'educational_zoom_callout',
      confidence: 0.8,
    };
  }

  // Visual description mentions diagram, chart, graph = chart animation
  const visualLower = (seg.visualDescription ?? '').toLowerCase();
  if (/\b(diagram|chart|graph|infographic|flowchart|table)\b/.test(visualLower)) {
    return {
      segmentId: seg.id,
      level: 'enhancement_candidate',
      reason: 'chart_animation',
      enhancementType: 'chart_animation',
      confidence: 0.7,
    };
  }

  // Product demo with high visual interest = feature spotlight
  if (seg.sceneType === 'action' && (seg.visualInterest ?? 0) >= 4) {
    return {
      segmentId: seg.id,
      level: 'enhancement_candidate',
      reason: 'premium_treatment',
      enhancementType: 'feature_spotlight',
      confidence: 0.6,
    };
  }

  // Educational content with concept words = concept reveal
  const transcriptLower = seg.transcript.toLowerCase();
  if (/\b(let me explain|here's how|the key is|importantly|notice that|pay attention)\b/.test(transcriptLower)) {
    return {
      segmentId: seg.id,
      level: 'enhancement_candidate',
      reason: 'educational_emphasis',
      enhancementType: 'animated_annotation',
      confidence: 0.5,
    };
  }

  // Default: standard
  return {
    segmentId: seg.id,
    level: 'standard',
    reason: 'not_needed',
    confidence: 1.0,
  };
}

/**
 * LLM-assisted enhancement selection for when rule-based isn't enough.
 * Uses the AI provider to analyze segments and suggest enhancements.
 */
export async function selectEnhancementsWithLLM(
  vud: VUD,
  edl: EditDecisionList,
  provider: AIProvider,
): Promise<EnhancementDecision[]> {
  const keptSegments = edl.decisions
    .filter((d) => d.action !== 'remove')
    .map((d) => {
      const seg = vud.segments.find((s) => s.id === d.segmentId);
      return seg
        ? `${seg.id}: type=${seg.sceneType ?? 'unknown'} interest=${seg.visualInterest ?? '?'} "${seg.transcript.slice(0, 80)}" visual="${(seg.visualDescription ?? '').slice(0, 80)}"`
        : null;
    })
    .filter(Boolean)
    .join('\n');

  const response = await provider.chat(
    [
      {
        role: 'system',
        content: `You are a video enhancement advisor. Given segments from an edited video, decide which segments would benefit from premium motion graphics enhancement (animated zooms, callouts, diagram reveals, spotlight effects).

Most segments should remain "standard". Only flag segments that would genuinely benefit from animation.

Return ONLY valid JSON array:
[{"segmentId": "seg_001", "level": "standard|enhancement_candidate|enhancement_required", "reason": "not_needed|educational_emphasis|precision_zoom|motion_explanation|animated_callout|concept_reveal|chart_animation|premium_treatment", "enhancementType": "educational_zoom_callout|animated_annotation|diagram_reveal|chart_animation|feature_spotlight|object_emphasis|precision_zoom|motion_explanation|null", "confidence": 0.0-1.0}]`,
      },
      { role: 'user', content: `Segments:\n${keptSegments}` },
    ],
    { jsonMode: true, maxTokens: 2048 },
  );

  try {
    const parsed = JSON.parse(response.content);
    const items = Array.isArray(parsed) ? parsed : [];
    return items.map((d: Record<string, unknown>) => ({
      segmentId: String(d.segmentId ?? ''),
      level: (d.level as EnhancementDecision['level']) ?? 'standard',
      reason: (d.reason as EnhancementDecisionReason) ?? 'not_needed',
      enhancementType: d.enhancementType as EnhancementType | undefined,
      confidence: Number(d.confidence ?? 0.5),
    }));
  } catch {
    return [];
  }
}
