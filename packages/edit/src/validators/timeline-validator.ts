import type { CutSenseTimeline } from '@cutsense/core';

export interface TimelineValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTimeline(timeline: CutSenseTimeline): TimelineValidationResult {
  const errors: string[] = [];

  if (!timeline.clips.length) {
    errors.push('Timeline has no clips');
  }

  if (timeline.fps <= 0 || timeline.fps > 120) {
    errors.push(`Invalid fps: ${timeline.fps}`);
  }

  if (timeline.durationInFrames <= 0) {
    errors.push(`Invalid durationInFrames: ${timeline.durationInFrames}`);
  }

  if (timeline.width <= 0 || timeline.height <= 0) {
    errors.push(`Invalid dimensions: ${timeline.width}x${timeline.height}`);
  }

  for (const clip of timeline.clips) {
    if (clip.durationInFrames <= 0) {
      errors.push(`Clip ${clip.id}: non-positive duration`);
    }
    if (clip.startFrom < 0) {
      errors.push(`Clip ${clip.id}: negative startFrom`);
    }
    if (!clip.src) {
      errors.push(`Clip ${clip.id}: missing src`);
    }
  }

  if (timeline.captions?.track) {
    for (const chunk of timeline.captions.track) {
      if (chunk.endFrame <= chunk.startFrame) {
        errors.push(`Caption "${chunk.text.slice(0, 20)}": endFrame <= startFrame`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
