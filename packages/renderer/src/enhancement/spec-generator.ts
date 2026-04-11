/**
 * Generate Scene Enhancement Specs from VUD segments + enhancement decisions.
 *
 * A spec is the contract between the editing layer and Revideo.
 * It defines exactly what Revideo should render for each enhanced segment.
 */

import type {
  VUD,
  EnhancementDecision,
  SceneEnhancementSpec,
  AudioStrategy,
  CameraBehavior,
} from '@cutsense/core';

export function generateEnhancementSpecs(
  vud: VUD,
  decisions: EnhancementDecision[],
): SceneEnhancementSpec[] {
  const specs: SceneEnhancementSpec[] = [];
  let specIndex = 0;

  for (const decision of decisions) {
    if (decision.level === 'standard') continue;

    const seg = vud.segments.find((s) => s.id === decision.segmentId);
    if (!seg) continue;

    const spec: SceneEnhancementSpec = {
      sceneId: `enh_${String(specIndex++).padStart(3, '0')}`,
      sourceSegmentId: seg.id,
      timelineStartSec: seg.startTime,
      timelineEndSec: seg.endTime,
      sourceMediaRef: vud.sourceFile,
      enhancementType: decision.enhancementType ?? 'custom',
      targetSubject: inferTargetSubject(seg, vud),
      cameraBehavior: inferCameraBehavior(decision),
      overlayText: inferOverlayText(seg),
      assets: [],
      expectedOutputDurationSec: seg.duration,
      audioStrategy: inferAudioStrategy(decision),
      replacementMode: 'replace_segment',
    };

    specs.push(spec);
  }

  return specs;
}

function inferTargetSubject(
  seg: { textOnScreen?: string; visualDescription?: string; entities: string[] },
  vud: VUD,
): string | undefined {
  // If there's text on screen, that's likely the target
  if (seg.textOnScreen) return seg.textOnScreen;

  // If there's a primary entity, use that
  if (seg.entities.length > 0) {
    const entity = vud.entities.find((e) => e.id === seg.entities[0]);
    if (entity) return entity.name;
  }

  return undefined;
}

function inferCameraBehavior(decision: EnhancementDecision): CameraBehavior {
  switch (decision.enhancementType) {
    case 'educational_zoom_callout':
    case 'precision_zoom':
      return 'zoom_in_hold_zoom_out';
    case 'feature_spotlight':
    case 'object_emphasis':
      return 'steady_zoom_in';
    case 'animated_annotation':
    case 'diagram_reveal':
      return 'static_with_overlay';
    default:
      return 'static_with_overlay';
  }
}

function inferOverlayText(
  seg: { textOnScreen?: string; transcript: string },
): string[] | undefined {
  if (seg.textOnScreen) return [seg.textOnScreen];

  // Extract key phrases from transcript for callout
  const words = seg.transcript.split(' ');
  if (words.length > 3 && words.length <= 10) {
    return [seg.transcript];
  }

  return undefined;
}

function inferAudioStrategy(decision: EnhancementDecision): AudioStrategy {
  // Overlays with text should duck audio
  if (
    decision.enhancementType === 'animated_annotation' ||
    decision.enhancementType === 'diagram_reveal'
  ) {
    return 'duck_under_overlay';
  }

  return 'preserve_original';
}
