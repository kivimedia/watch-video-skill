import type { VUD, EditDecisionList, CutSenseTimeline, TimelineClip, CaptionConfig } from '@cutsense/core';
import { getSpeechIslands } from '../planner/silence-trimmer.js';

export function buildTimeline(
  vud: VUD,
  edl: EditDecisionList,
  captions?: CaptionConfig,
  silenceThresholdSec?: number,
): CutSenseTimeline {
  const fps = vud.metadata.fps || 30;
  const clips: TimelineClip[] = [];
  let totalFrames = 0;
  let clipIndex = 0;

  for (const decision of edl.decisions) {
    if (decision.action === 'remove') continue;

    const seg = vud.segments.find((s) => s.id === decision.segmentId);
    if (!seg) continue;

    let startTime = decision.trimStart ?? seg.startTime;
    let endTime = decision.trimEnd ?? seg.endTime;

    startTime = Math.max(startTime, seg.startTime);
    endTime = Math.min(endTime, seg.endTime);

    if (endTime <= startTime) {
      startTime = seg.startTime;
      endTime = seg.endTime;
    }

    if (endTime - startTime <= 0) continue;

    const words = seg.words.filter((w) => w.start >= startTime && w.end <= endTime);
    const threshold = silenceThresholdSec ?? 0;
    const islands = getSpeechIslands(words, startTime, endTime, threshold);

    const transitionType = decision.transitionBefore ?? edl.transitionDefault;

    for (const island of islands) {
      const durationSec = island.endSec - island.startSec;
      if (durationSec <= 0) continue;
      const durationInFrames = Math.round(durationSec * fps);
      if (durationInFrames <= 0) continue;

      clips.push({
        id: `clip_${String(clipIndex++).padStart(3, '0')}`,
        src: vud.sourceFile,
        startFrom: Math.round(island.startSec * fps),
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
