/**
 * Cost tracking utility.
 *
 * Tracks token usage and costs per provider/model/stage.
 * Part of the cost governance system (PRD Section 14).
 */

import type { CostManifest } from '../types/job.js';

export interface CostEntry {
  provider: string;
  model: string;
  stage: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: string;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private budgetUSD: number;

  constructor(budgetUSD = Infinity) {
    this.budgetUSD = budgetUSD;
  }

  record(entry: Omit<CostEntry, 'timestamp'>): void {
    this.entries.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  get totalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.costUSD, 0);
  }

  get totalInputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.inputTokens, 0);
  }

  get totalOutputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.outputTokens, 0);
  }

  get isNearBudget(): boolean {
    return this.budgetUSD !== Infinity && this.totalCost >= this.budgetUSD * 0.8;
  }

  get isOverBudget(): boolean {
    return this.budgetUSD !== Infinity && this.totalCost >= this.budgetUSD;
  }

  get budgetRemainingUSD(): number {
    return this.budgetUSD === Infinity ? Infinity : this.budgetUSD - this.totalCost;
  }

  costByStage(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.stage] = (result[entry.stage] ?? 0) + entry.costUSD;
    }
    return result;
  }

  costByProvider(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.provider] = (result[entry.provider] ?? 0) + entry.costUSD;
    }
    return result;
  }

  toManifest(): CostManifest {
    return {
      currency: 'USD',
      total: this.totalCost,
      byStage: this.costByStage(),
      byProvider: this.costByProvider(),
    };
  }

  getEntries(): readonly CostEntry[] {
    return this.entries;
  }
}
