import { describe, it, expect } from 'vitest';
import { CostTracker } from '@cutsense/core';

describe('CostTracker', () => {
  it('should start with zero costs', () => {
    const tracker = new CostTracker();
    expect(tracker.totalCost).toBe(0);
    expect(tracker.totalInputTokens).toBe(0);
    expect(tracker.totalOutputTokens).toBe(0);
  });

  it('should accumulate costs', () => {
    const tracker = new CostTracker();
    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'understand', inputTokens: 1000, outputTokens: 500, costUSD: 0.05 });
    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'edit', inputTokens: 2000, outputTokens: 1000, costUSD: 0.10 });

    expect(tracker.totalCost).toBeCloseTo(0.15);
    expect(tracker.totalInputTokens).toBe(3000);
    expect(tracker.totalOutputTokens).toBe(1500);
  });

  it('should track costs by stage', () => {
    const tracker = new CostTracker();
    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'understand', inputTokens: 1000, outputTokens: 500, costUSD: 0.05 });
    tracker.record({ provider: 'anthropic', model: 'haiku', stage: 'understand', inputTokens: 500, outputTokens: 200, costUSD: 0.01 });
    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'edit', inputTokens: 2000, outputTokens: 1000, costUSD: 0.10 });

    const byStage = tracker.costByStage();
    expect(byStage['understand']).toBeCloseTo(0.06);
    expect(byStage['edit']).toBeCloseTo(0.10);
  });

  it('should track costs by provider', () => {
    const tracker = new CostTracker();
    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'understand', inputTokens: 1000, outputTokens: 500, costUSD: 0.05 });
    tracker.record({ provider: 'openai', model: 'gpt-4o', stage: 'edit', inputTokens: 2000, outputTokens: 1000, costUSD: 0.10 });

    const byProvider = tracker.costByProvider();
    expect(byProvider['anthropic']).toBeCloseTo(0.05);
    expect(byProvider['openai']).toBeCloseTo(0.10);
  });

  it('should detect budget limits', () => {
    const tracker = new CostTracker(1.0);
    expect(tracker.isOverBudget).toBe(false);
    expect(tracker.isNearBudget).toBe(false);

    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'test', inputTokens: 0, outputTokens: 0, costUSD: 0.85 });
    expect(tracker.isNearBudget).toBe(true);
    expect(tracker.isOverBudget).toBe(false);

    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'test', inputTokens: 0, outputTokens: 0, costUSD: 0.20 });
    expect(tracker.isOverBudget).toBe(true);
    expect(tracker.budgetRemainingUSD).toBeLessThan(0);
  });

  it('should produce a valid manifest', () => {
    const tracker = new CostTracker();
    tracker.record({ provider: 'anthropic', model: 'sonnet', stage: 'understand', inputTokens: 1000, outputTokens: 500, costUSD: 0.05 });

    const manifest = tracker.toManifest();
    expect(manifest.currency).toBe('USD');
    expect(manifest.total).toBeCloseTo(0.05);
    expect(manifest.byStage['understand']).toBeCloseTo(0.05);
    expect(manifest.byProvider['anthropic']).toBeCloseTo(0.05);
  });
});
