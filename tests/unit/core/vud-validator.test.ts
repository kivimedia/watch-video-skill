import { describe, it, expect } from 'vitest';
import { validateVUD } from '@cutsense/understand';
import type { VUD } from '@cutsense/core';

function makeValidVUD(): VUD {
  return {
    version: '1.0', jobId: 'test', sourceFile: '/test.mp4', duration: 60,
    language: 'en', isRTL: false,
    metadata: { width: 1920, height: 1080, fps: 30, codec: 'h264', bitrate: 5000000, hasAudio: true },
    segments: [
      { id: 'seg_000', startTime: 0, endTime: 30, duration: 30, transcript: 'Hello', words: [], topics: [], entities: [], energy: 0.5, isSilent: false, isBlurry: false, isDuplicate: false },
      { id: 'seg_001', startTime: 30, endTime: 60, duration: 30, transcript: 'World', words: [], topics: [], entities: [], energy: 0.7, isSilent: false, isBlurry: false, isDuplicate: false },
    ],
    entities: [], topics: [], energyCurve: [], summary: 'Test', keyMoments: [],
  };
}

describe('VUD Validator', () => {
  it('should validate a correct VUD', () => {
    const result = validateVUD(makeValidVUD());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail on wrong version', () => {
    const vud = makeValidVUD();
    (vud as any).version = '2.0';
    const result = validateVUD(vud);
    expect(result.valid).toBe(false);
  });

  it('should fail on missing jobId', () => {
    const vud = makeValidVUD();
    vud.jobId = '';
    const result = validateVUD(vud);
    expect(result.valid).toBe(false);
  });

  it('should fail on negative duration', () => {
    const vud = makeValidVUD();
    vud.duration = -1;
    const result = validateVUD(vud);
    expect(result.valid).toBe(false);
  });

  it('should fail on segment with endTime <= startTime', () => {
    const vud = makeValidVUD();
    vud.segments[0]!.endTime = vud.segments[0]!.startTime;
    vud.segments[0]!.duration = 0;
    const result = validateVUD(vud);
    expect(result.valid).toBe(false);
  });

  it('should detect overlapping segments', () => {
    const vud = makeValidVUD();
    vud.segments[1]!.startTime = 20; // overlaps with seg_000 endTime=30
    const result = validateVUD(vud);
    expect(result.errors.some((e) => e.includes('overlap'))).toBe(true);
  });
});
