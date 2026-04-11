import { describe, it, expect } from 'vitest';
import { routeModel, estimateTaskCost, type RouterConfig } from '@cutsense/core';

describe('Model Router', () => {
  const standardConfig: RouterConfig = { defaultProvider: 'anthropic', moreAI: false };
  const moreAIConfig: RouterConfig = { defaultProvider: 'anthropic', moreAI: true };

  describe('routeModel', () => {
    it('should route frame_labeling to fast tier', () => {
      const model = routeModel('frame_labeling', standardConfig);
      expect(model.tier).toBe('fast');
    });

    it('should route vud_fusion to premium tier', () => {
      const model = routeModel('vud_fusion', standardConfig);
      expect(model.tier).toBe('premium');
    });

    it('should route editorial_reasoning to premium', () => {
      const model = routeModel('editorial_reasoning', standardConfig);
      expect(model.tier).toBe('premium');
    });

    it('should upgrade tiers in MORE AI mode', () => {
      const standard = routeModel('frame_labeling', standardConfig);
      const moreAI = routeModel('frame_labeling', moreAIConfig);
      expect(standard.tier).toBe('fast');
      expect(moreAI.tier).toBe('standard');
    });

    it('should respect overrides', () => {
      const config: RouterConfig = {
        defaultProvider: 'anthropic',
        moreAI: false,
        overrides: { frame_labeling: { provider: 'gemini', tier: 'fast' } },
      };
      const model = routeModel('frame_labeling', config);
      expect(model.provider).toBe('gemini');
    });

    it('should use Opus for premium Anthropic tier', () => {
      const model = routeModel('vud_fusion', standardConfig);
      expect(model.model).toContain('opus');
    });
  });

  describe('estimateTaskCost', () => {
    it('should estimate non-zero cost for real tokens', () => {
      const cost = estimateTaskCost('vud_fusion', 10000, 2000, standardConfig);
      expect(cost).toBeGreaterThan(0);
    });

    it('should estimate zero cost for zero tokens', () => {
      const cost = estimateTaskCost('frame_labeling', 0, 0, standardConfig);
      expect(cost).toBe(0);
    });
  });
});
