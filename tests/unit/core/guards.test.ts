import { describe, it, expect } from 'vitest';
import { checkVUDGate, checkEditGate, type VUD, type CutSenseTimeline } from '@cutsense/core';

function makeMinimalVUD(overrides?: Partial<VUD>): VUD {
  return {
    version: '1.0',
    jobId: 'test',
    sourceFile: '/tmp/test.mp4',
    duration: 60,
    language: 'en',
    isRTL: false,
    metadata: { width: 1920, height: 1080, fps: 30, codec: 'h264', bitrate: 5000000, hasAudio: true },
    segments: [
      {
        id: 'seg_000', startTime: 0, endTime: 30, duration: 30,
        transcript: 'Hello world this is a test segment with some text',
        words: [], topics: [], entities: [], energy: 0.5,
        isSilent: false, isBlurry: false, isDuplicate: false,
      },
      {
        id: 'seg_001', startTime: 30, endTime: 60, duration: 30,
        transcript: 'Second segment with more text content here',
        words: [], topics: [], entities: [], energy: 0.7,
        isSilent: false, isBlurry: false, isDuplicate: false,
      },
    ],
    entities: [{ id: 'e1', name: 'Speaker', type: 'person', mentions: [0, 1], totalScreenTime: 60 }],
    topics: [{ id: 't1', label: 'Test Topic', segments: ['seg_000'], totalDuration: 30 }],
    energyCurve: [{ time: 0, energy: 0.5, driver: 'speech_rate' }],
    summary: 'Test video.',
    keyMoments: [],
    ...overrides,
  };
}

describe('Stage Gates', () => {
  describe('checkVUDGate', () => {
    it('should pass for a valid VUD', () => {
      const result = checkVUDGate(makeMinimalVUD());
      expect(result.passed).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('should fail for VUD with no segments', () => {
      const result = checkVUDGate(makeMinimalVUD({ segments: [] }));
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.code === 'VUD_NO_SEGMENTS')).toBe(true);
    });

    it('should fail for overlapping segments', () => {
      const vud = makeMinimalVUD({
        segments: [
          { id: 's1', startTime: 0, endTime: 40, duration: 40, transcript: 'a', words: [], topics: [], entities: [], energy: 0.5, isSilent: false, isBlurry: false, isDuplicate: false },
          { id: 's2', startTime: 30, endTime: 60, duration: 30, transcript: 'b', words: [], topics: [], entities: [], energy: 0.5, isSilent: false, isBlurry: false, isDuplicate: false },
        ],
      });
      const result = checkVUDGate(vud);
      expect(result.issues.some((i) => i.code === 'VUD_OVERLAPPING_SEGMENTS')).toBe(true);
    });

    it('should fail for missing metadata', () => {
      const result = checkVUDGate(makeMinimalVUD({ metadata: { width: 0, height: 0, fps: 0, codec: '', bitrate: 0, hasAudio: false } }));
      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.code === 'VUD_MISSING_METADATA')).toBe(true);
    });
  });

  describe('checkEditGate', () => {
    it('should pass for valid timeline', () => {
      const timeline: CutSenseTimeline = {
        version: '1.0', jobId: 'test', fps: 30, durationInFrames: 900,
        width: 1920, height: 1080,
        clips: [{ id: 'c1', src: '/test.mp4', startFrom: 0, durationInFrames: 900 }],
      };
      const result = checkEditGate(timeline);
      expect(result.passed).toBe(true);
    });

    it('should fail for empty clips', () => {
      const timeline: CutSenseTimeline = {
        version: '1.0', jobId: 'test', fps: 30, durationInFrames: 0,
        width: 1920, height: 1080, clips: [],
      };
      const result = checkEditGate(timeline);
      expect(result.passed).toBe(false);
    });

    it('should warn when duration exceeds target tolerance', () => {
      const timeline: CutSenseTimeline = {
        version: '1.0', jobId: 'test', fps: 30, durationInFrames: 3600,
        width: 1920, height: 1080,
        clips: [{ id: 'c1', src: '/test.mp4', startFrom: 0, durationInFrames: 3600 }],
      };
      const result = checkEditGate(timeline, 60, 5);
      expect(result.issues.some((i) => i.code === 'EDIT_DURATION_MISMATCH')).toBe(true);
    });
  });
});
