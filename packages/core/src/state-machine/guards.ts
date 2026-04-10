/**
 * Stage gate acceptance criteria.
 *
 * Each stage has hard requirements that must pass before progressing.
 * These are the implementation contracts from PRD Section 12.
 */

import type { VUD } from '../types/vud.js';
import type { CutSenseTimeline } from '../types/timeline.js';

export interface GateResult {
  passed: boolean;
  issues: GateIssue[];
}

export interface GateIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  field?: string;
}

/**
 * VUD Gate - Section 12.1
 * A VUD is releasable to editing only if all checks pass.
 */
export function checkVUDGate(vud: VUD, transcriptCoverageThreshold = 0.98): GateResult {
  const issues: GateIssue[] = [];

  if (!vud.segments.length) {
    issues.push({ severity: 'error', code: 'VUD_NO_SEGMENTS', message: 'VUD has no segments' });
  }

  // Timestamps must be monotonic and non-overlapping
  for (let i = 1; i < vud.segments.length; i++) {
    const prev = vud.segments[i - 1]!;
    const curr = vud.segments[i]!;
    if (curr.startTime < prev.endTime) {
      issues.push({
        severity: 'error',
        code: 'VUD_OVERLAPPING_SEGMENTS',
        message: `Segments ${prev.id} and ${curr.id} overlap: ${prev.endTime} > ${curr.startTime}`,
        field: `segments[${i}].startTime`,
      });
    }
  }

  // Check transcript coverage
  const coveredDuration = vud.segments
    .filter((s) => s.transcript.trim().length > 0 || s.isSilent)
    .reduce((sum, s) => sum + s.duration, 0);
  const coverage = vud.duration > 0 ? coveredDuration / vud.duration : 0;
  if (coverage < transcriptCoverageThreshold) {
    issues.push({
      severity: 'warning',
      code: 'VUD_LOW_TRANSCRIPT_COVERAGE',
      message: `Transcript coverage ${(coverage * 100).toFixed(1)}% below threshold ${(transcriptCoverageThreshold * 100).toFixed(1)}%`,
    });
  }

  // Scene coverage
  const segmentCoverage = vud.segments.reduce((sum, s) => sum + s.duration, 0);
  if (vud.duration > 0 && segmentCoverage / vud.duration < 0.9) {
    issues.push({
      severity: 'warning',
      code: 'VUD_LOW_SCENE_COVERAGE',
      message: `Segments cover only ${(segmentCoverage / vud.duration * 100).toFixed(1)}% of video duration`,
    });
  }

  // Required metadata
  if (!vud.metadata.fps || !vud.metadata.width || !vud.metadata.height) {
    issues.push({
      severity: 'error',
      code: 'VUD_MISSING_METADATA',
      message: 'VUD is missing required technical metadata (fps, width, height)',
    });
  }

  // Entity extraction
  if (vud.segments.length > 5 && vud.entities.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'VUD_NO_ENTITIES',
      message: 'No entities extracted from a video with many segments',
    });
  }

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Edit Gate - Section 12.2
 * An edit plan is releasable to render only if all checks pass.
 */
export function checkEditGate(
  timeline: CutSenseTimeline,
  targetDurationSec?: number,
  durationTolerancePercent = 5,
): GateResult {
  const issues: GateIssue[] = [];

  if (!timeline.clips.length) {
    issues.push({ severity: 'error', code: 'EDIT_NO_CLIPS', message: 'Timeline has no clips' });
  }

  // Duration tolerance
  if (targetDurationSec) {
    const actualDuration = timeline.durationInFrames / timeline.fps;
    const tolerance = targetDurationSec * (durationTolerancePercent / 100);
    if (Math.abs(actualDuration - targetDurationSec) > tolerance) {
      issues.push({
        severity: 'warning',
        code: 'EDIT_DURATION_MISMATCH',
        message: `Duration ${actualDuration.toFixed(1)}s outside ${durationTolerancePercent}% tolerance of target ${targetDurationSec}s`,
      });
    }
  }

  // Composition must compile (basic check)
  const totalClipFrames = timeline.clips.reduce((sum, c) => sum + c.durationInFrames, 0);
  if (totalClipFrames <= 0) {
    issues.push({
      severity: 'error',
      code: 'EDIT_ZERO_DURATION',
      message: 'Total clip duration is zero',
    });
  }

  // Validate caption track if present
  if (timeline.captions?.track.length) {
    for (const chunk of timeline.captions.track) {
      if (chunk.endFrame <= chunk.startFrame) {
        issues.push({
          severity: 'error',
          code: 'EDIT_INVALID_CAPTION',
          message: `Caption "${chunk.text}" has invalid timing: end <= start`,
        });
        break;
      }
    }
  }

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}
