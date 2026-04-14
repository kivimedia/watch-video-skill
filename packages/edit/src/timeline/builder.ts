import type { VUD, EditDecisionList, CutSenseTimeline, TimelineClip, CaptionConfig } from '@cutsense/core';

export function buildTimeline(
  vud: VUD,
  edl: EditDecisionList,
  captions?: CaptionConfig,
): CutSenseTimeline {
  const fps = vud.metadata.fps || 30;
  const clips: TimelineClip[] = [];
  let totalFrames = 0;
  let clipIndex = 0;

  for (const decision of edl.decisions) {
    if (decision.action === 'remove') continue;

    const seg = vud.segments.find((s) => s.id === decision.segmentId);
    if (!seg) continue;

    // Clamp trim values to segment boundaries and ensure positive duration
    let startTime = decision.trimStart ?? seg.startTime;
    let endTime = decision.trimEnd ?? seg.endTime;

    // Guard: trim values must be within segment bounds
    startTime = Math.max(startTime, seg.startTime);
    endTime = Math.min(endTime, seg.endTime);

    // Guard: ensure positive duration
    if (endTime <= startTime) {
      // Fallback to full segment
      startTime = seg.startTime;
      endTime = seg.endTime;
    }

    const durationSec = endTime - startTime;
    if (durationSec <= 0) continue; // Skip zero-length clips

    const durationInFrames = Math.round(durationSec * fps);
    if (durationInFrames <= 0) continue;

    const startFrom = Math.round(startTime * fps);

    const transitionType = decision.transitionBefore ?? edl.transitionDefault;

    clips.push({
      id: `clip_${String(clipIndex++).padStart(3, '0')}`,
      src: vud.sourceFile,
      startFrom,
      durationInFrames,
      volume: 1,
      originalSegmentId: seg.id,
      transition: {
        type: transitionType === 'mixed' ? (clipIndex % 2 === 0 ? 'fade' : 'cut') : transitionType,
        durationInFrames: transitionType === 'fade' || transitionType === 'mixed' ? Math.round(fps * 0.5) : undefined,
      },
    });

    totalFrames += durationInFrames;
  }

  return {
    version: '1.0',
    jobId: vud.jobId,
    fps,
    durationInFrames: totalFrames,
    width: vud.metadata.width,
    height: vud.metadata.height,
    clips,
    captions,
  };
}
