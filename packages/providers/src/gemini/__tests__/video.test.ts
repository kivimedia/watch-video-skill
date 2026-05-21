import { describe, it, expect } from 'vitest';
import {
  classifyVideoRoute,
  VIDEO_INLINE_LIMIT_BYTES,
  VIDEO_UPLOAD_LIMIT_BYTES,
} from '../video.js';
import { buildPreprocessArgs } from '../preprocess.js';

describe('classifyVideoRoute', () => {
  it('routes YouTube URLs to youtube path regardless of size', () => {
    expect(classifyVideoRoute({ youtubeUrl: 'https://youtu.be/abc' })).toBe('youtube');
    expect(
      classifyVideoRoute({ youtubeUrl: 'https://youtu.be/abc', sizeBytes: 9_999_999_999 }),
    ).toBe('youtube');
  });

  it('inlines files at or under 20 MB', () => {
    expect(classifyVideoRoute({ sizeBytes: 0 })).toBe('inline');
    expect(classifyVideoRoute({ sizeBytes: VIDEO_INLINE_LIMIT_BYTES })).toBe('inline');
  });

  it('uploads files larger than 20 MB', () => {
    expect(classifyVideoRoute({ sizeBytes: VIDEO_INLINE_LIMIT_BYTES + 1 })).toBe('upload');
  });

  it('exposes the 20 GB Files API ceiling', () => {
    expect(VIDEO_UPLOAD_LIMIT_BYTES).toBe(20 * 1024 * 1024 * 1024);
  });
});

describe('buildPreprocessArgs', () => {
  it('defaults to 720p / 1fps and keeps audio', () => {
    const args = buildPreprocessArgs('in.mp4', 'out.mp4');
    expect(args).toContain('-vf');
    expect(args).toContain('scale=-2:720,fps=1');
    expect(args).toContain('libx264');
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
    expect(args).not.toContain('-an');
    expect(args[args.length - 1]).toBe('out.mp4');
  });

  it('honors 480p / 2fps overrides', () => {
    const args = buildPreprocessArgs('in.mp4', 'out.mp4', { height: 480, fps: 2 });
    expect(args).toContain('scale=-2:480,fps=2');
  });

  it('strips audio when asked', () => {
    const args = buildPreprocessArgs('in.mp4', 'out.mp4', { stripAudio: true });
    expect(args).toContain('-an');
    expect(args).not.toContain('aac');
  });

  it('passes the CRF override through', () => {
    const args = buildPreprocessArgs('in.mp4', 'out.mp4', { crf: 32 });
    const idx = args.indexOf('-crf');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('32');
  });
});
