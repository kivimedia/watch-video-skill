import { describe, it, expect } from 'vitest';
import { salvageJson } from './json-salvage.js';

describe('salvageJson', () => {
  it('parses clean JSON without claiming truncation', () => {
    const { value, truncated } = salvageJson<{ a: number }>('{"a":1}');
    expect(value).toEqual({ a: 1 });
    expect(truncated).toBe(false);
  });

  it('parses a clean array', () => {
    const { value } = salvageJson<number[]>('[1,2,3]');
    expect(value).toEqual([1, 2, 3]);
  });

  it('strips ```json fences', () => {
    const { value } = salvageJson<{ ok: boolean }>('```json\n{"ok":true}\n```');
    expect(value).toEqual({ ok: true });
  });

  it('ignores prose before the payload', () => {
    const { value } = salvageJson<{ ok: boolean }>('Sure, here you go:\n{"ok":true}');
    expect(value).toEqual({ ok: true });
  });

  // The regression this file exists for. A batch of scene descriptions ran past the output
  // token cap, JSON.parse threw, and an empty catch discarded every scene in the batch.
  it('recovers the complete objects from an array truncated mid-object', () => {
    const raw =
      '[{"sceneId":"scene_001","description":"Git installer wizard"},' +
      '{"sceneId":"scene_002","description":"PowerShell window"},' +
      '{"sceneId":"scene_003","descrip';
    const { value, truncated } = salvageJson<Array<{ sceneId: string }>>(raw);
    expect(truncated).toBe(true);
    expect(value).toHaveLength(2);
    expect(value?.[1]?.sceneId).toBe('scene_002');
  });

  it('drops a dangling comma left by the cut', () => {
    const raw = '[{"id":1},{"id":2},';
    const { value, truncated } = salvageJson<Array<{ id: number }>>(raw);
    expect(truncated).toBe(true);
    expect(value).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('recovers a top-level object truncated inside a nested array', () => {
    const raw = '{"topics":[{"id":"topic_a","label":"Install"},{"id":"topic_b","lab';
    const { value, truncated } = salvageJson<{ topics: Array<{ id: string }> }>(raw);
    expect(truncated).toBe(true);
    expect(value?.topics).toHaveLength(1);
    expect(value?.topics[0]?.id).toBe('topic_a');
  });

  it('is not fooled by braces inside strings', () => {
    const raw = '[{"description":"shows a { brace and a ] bracket"},{"description":"tru';
    const { value, truncated } = salvageJson<Array<{ description: string }>>(raw);
    expect(truncated).toBe(true);
    expect(value).toHaveLength(1);
    expect(value?.[0]?.description).toBe('shows a { brace and a ] bracket');
  });

  it('handles escaped quotes inside strings', () => {
    const raw = '[{"description":"he said \\"finish\\" twice"},{"description":"cut';
    const { value } = salvageJson<Array<{ description: string }>>(raw);
    expect(value).toHaveLength(1);
    expect(value?.[0]?.description).toBe('he said "finish" twice');
  });

  // Callers must be able to distinguish "nothing usable" from "an empty answer", because
  // returning [] for both is exactly what hid this bug for so long.
  it('returns null when there is no JSON at all', () => {
    expect(salvageJson('I cannot help with that.').value).toBeNull();
    expect(salvageJson('').value).toBeNull();
  });

  it('returns null when nothing complete can be salvaged', () => {
    expect(salvageJson('[{"sceneId":"scene_00').value).toBeNull();
  });
});
