/**
 * Model router - picks the cheapest capable model for each task.
 *
 * Implements the routing principles from PRD Section 14:
 * - Use cheapest model that can reliably perform the step
 * - Reserve premium for fusion, editorial, disputed review
 * - Escalate selectively, not globally
 */

import {
  type ModelConfig,
  type ModelTier,
  type ProviderName,
  DEFAULT_MODELS,
} from '../types/providers.js';

export type TaskType =
  | 'frame_labeling'
  | 'scene_classification'
  | 'entity_extraction'
  | 'visual_analysis'
  | 'vud_fusion'
  | 'editorial_reasoning'
  | 'cut_planning'
  | 'caption_generation'
  | 'review'
  | 'repair';

const TASK_TIER_MAP: Record<TaskType, ModelTier> = {
  frame_labeling: 'fast',
  scene_classification: 'fast',
  entity_extraction: 'standard',
  visual_analysis: 'standard',
  vud_fusion: 'premium',
  editorial_reasoning: 'premium',
  cut_planning: 'premium',
  caption_generation: 'fast',
  review: 'standard',
  repair: 'standard',
};

const MORE_AI_TIER_MAP: Record<TaskType, ModelTier> = {
  frame_labeling: 'standard',
  scene_classification: 'standard',
  entity_extraction: 'premium',
  visual_analysis: 'premium',
  vud_fusion: 'premium',
  editorial_reasoning: 'premium',
  cut_planning: 'premium',
  caption_generation: 'standard',
  review: 'premium',
  repair: 'premium',
};

export interface RouterConfig {
  defaultProvider: ProviderName;
  moreAI: boolean;
  overrides?: Partial<Record<TaskType, { provider: ProviderName; tier: ModelTier }>>;
}

export function routeModel(task: TaskType, config: RouterConfig): ModelConfig {
  const override = config.overrides?.[task];
  if (override) {
    return DEFAULT_MODELS[override.provider][override.tier];
  }

  const tierMap = config.moreAI ? MORE_AI_TIER_MAP : TASK_TIER_MAP;
  const tier = tierMap[task];
  return DEFAULT_MODELS[config.defaultProvider][tier];
}

export function estimateTaskCost(
  task: TaskType,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  config: RouterConfig,
): number {
  const model = routeModel(task, config);
  return (
    (estimatedInputTokens / 1000) * model.inputCostPer1kTokens +
    (estimatedOutputTokens / 1000) * model.outputCostPer1kTokens
  );
}
