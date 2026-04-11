import { describe, it, expect } from 'vitest';
import { buildTimeline } from '@cutsense/edit';
import type { VUD, EditDecisionList } from '@cutsense/core';

function makeVUD(): VUD {
  return {
    version: '1.0', jobId: 'test', sourceFile: '/tmp/test.mp4',
    duration: 90, language: 'en', isRTL: false,
    metadata: { width: 1920, height: 1080, fps: 30, codec: 'h264', bitrate: 5000000, hasAudio: true },
    segments: [
      { id: 'seg_000', startTime: 0, endTime: 30, duration: 30, transcript: 'First', words: [], topics: [], entities: [], energy: 0.5, isSilent: false, isBlurry: false, isDuplicate: false },
      { id: 'seg_001', startTime: 30, endTime: 60, duration: 30, transcript: 'Second', words: [], topics: [], entities: [], energy: 0.8, isSilent: false, isBlurry: false, isDuplicate: false },
      { id: 'seg_002', startTime: 60, endTime: 90, duration: 30, transcript: 'Third', words: [], topics: [], entities: [], energy: 0.3, isSilent: false, isBlurry: false, isDuplicate: false },
    ],
    entities: [], topics: [], energyCurve: [], summary: 'Test', keyMoments: [],
  };
}

describe('Timeline Builder', () => {
  it('should build timeline from kept segments', () => {
    const edl: EditDecisionList = {
      jobId: 'test', targetDurationSec: 60, actualDurationSec: 60,
      decisions: [
        { segmentId: 'seg_000', action: 'keep', reason: 'good' },
        { segmentId: 'seg_001', action: 'keep', reason: 'great' },
        { segmentId: 'seg_002', action: 'remove', reason: 'boring' },
      ],
      captionMode: 'none', transitionDefault: 'cut',
    };

    const timeline = buildTimeline(makeVUD(), edl);
    expect(timeline.clips).toHaveLength(2);
    expect(timeline.durationInFrames).toBe(1800); // 60s * 30fps
    expect(timeline.fps).toBe(30);
  });

  it('should set originalSegmentId on clips', () => {
    const edl: EditDecisionList = {
      jobId: 'test', targetDurationSec: 30, actualDurationSec: 30,
      decisions: [{ segmentId: 'seg_001', action: 'keep', reason: 'test' }],
      captionMode: 'none', transitionDefault: 'cut',
    };

    const timeline = buildTimeline(makeVUD(), edl);
    expect(timeline.clips[0]!.originalSegmentId).toBe('seg_001');
  });

  it('should calculate correct startFrom in frames', () => {
    const edl: EditDecisionList = {
      jobId: 'test', targetDurationSec: 30, actualDurationSec: 30,
      decisions: [{ segmentId: 'seg_001', action: 'keep', reason: 'test' }],
      captionMode: 'none', transitionDefault: 'cut',
    };

    const timeline = buildTimeline(makeVUD(), edl);
    expect(timeline.clips[0]!.startFrom).toBe(900); // 30s * 30fps
    expect(timeline.clips[0]!.durationInFrames).toBe(900);
  });

  it('should handle trimmed segments', () => {
    const edl: EditDecisionList = {
      jobId: 'test', targetDurationSec: 15, actualDurationSec: 15,
      decisions: [{ segmentId: 'seg_000', action: 'trim', reason: 'tighten', trimStart: 5, trimEnd: 20 }],
      captionMode: 'none', transitionDefault: 'cut',
    };

    const timeline = buildTimeline(makeVUD(), edl);
    expect(timeline.clips[0]!.startFrom).toBe(150); // 5s * 30fps
    expect(timeline.clips[0]!.durationInFrames).toBe(450); // 15s * 30fps
  });

  it('should produce empty timeline when all removed', () => {
    const edl: EditDecisionList = {
      jobId: 'test', targetDurationSec: 0, actualDurationSec: 0,
      decisions: [
        { segmentId: 'seg_000', action: 'remove', reason: 'cut' },
        { segmentId: 'seg_001', action: 'remove', reason: 'cut' },
      ],
      captionMode: 'none', transitionDefault: 'cut',
    };

    const timeline = buildTimeline(makeVUD(), edl);
    expect(timeline.clips).toHaveLength(0);
    expect(timeline.durationInFrames).toBe(0);
  });
});
