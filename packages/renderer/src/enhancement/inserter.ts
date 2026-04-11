/**
 * Insert Revideo-rendered assets back into the Remotion master timeline.
 *
 * This is where the hybrid architecture comes together: enhanced segments
 * replace their original clips in the timeline, preserving timing integrity.
 */

import type {
  CutSenseTimeline,
  TimelineClip,
  SceneEnhancementSpec,
  InsertRenderResult,
  EnhancementManifest,
} from '@cutsense/core';

/**
 * Apply enhancement inserts to a Remotion timeline.
 *
 * For each successful enhancement render, replaces the original clip
 * with the enhanced asset. Failed enhancements fall back to the
 * original standard clip (graceful degradation).
 */
export function applyEnhancementInserts(
  timeline: CutSenseTimeline,
  specs: SceneEnhancementSpec[],
  results: InsertRenderResult[],
): CutSenseTimeline {
  const updatedClips: TimelineClip[] = [];
  let enhancedCount = 0;

  for (const clip of timeline.clips) {
    // Find if this clip has an enhancement
    const spec = specs.find((s) => s.sourceSegmentId === clip.originalSegmentId);
    const result = spec
      ? results.find((r) => r.sceneId === spec.sceneId)
      : undefined;

    if (spec && result?.success && result.outputPath) {
      // Enhancement succeeded - use the enhanced asset
      const enhancedClip: TimelineClip = {
        ...clip,
        src: result.outputPath,
        startFrom: 0, // Enhanced asset starts from beginning
        durationInFrames: result.outputDurationSec
          ? Math.round(result.outputDurationSec * timeline.fps)
          : clip.durationInFrames,
        isEnhanced: true,
        enhancedAssetPath: result.outputPath,
        originalSegmentId: clip.originalSegmentId,
      };

      // Apply audio strategy
      if (spec.audioStrategy === 'mute_original') {
        enhancedClip.volume = 0;
      } else if (spec.audioStrategy === 'duck_under_overlay') {
        enhancedClip.volume = 0.4;
      }

      updatedClips.push(enhancedClip);
      enhancedCount++;
    } else {
      // No enhancement or enhancement failed - keep original clip
      updatedClips.push(clip);
    }
  }

  // Recalculate total duration
  const totalFrames = updatedClips.reduce((sum, c) => sum + c.durationInFrames, 0);

  return {
    ...timeline,
    clips: updatedClips,
    durationInFrames: totalFrames,
    editMode: enhancedCount > 0 ? 'enhanced' : 'standard',
    enhancedSegmentCount: enhancedCount,
  };
}

/**
 * Build an enhancement manifest for dashboard reporting.
 */
export function buildEnhancementManifest(
  jobId: string,
  totalSegments: number,
  specs: SceneEnhancementSpec[],
  results: InsertRenderResult[],
): EnhancementManifest {
  const successCount = results.filter((r) => r.success).length;
  const fallbackCount = results.filter((r) => r.fallbackToStandard).length;
  const totalRenderTime = results.reduce((sum, r) => sum + (r.renderTimeMs ?? 0), 0);

  let status: EnhancementManifest['status'] = 'complete';
  if (results.length === 0) status = 'pending';
  else if (fallbackCount === results.length) status = 'failed';
  else if (fallbackCount > 0) status = 'degraded';

  return {
    jobId,
    mode: specs.length > 0 ? 'enhanced' : 'standard',
    totalSegments,
    enhancedSegments: successCount,
    specs,
    results,
    totalEnhancementCostUSD: 0, // TODO: track Revideo compute cost
    totalEnhancementRenderTimeMs: totalRenderTime,
    fallbackCount,
    status,
  };
}
