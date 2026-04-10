/**
 * AI Provider abstraction layer.
 *
 * CutSense is provider-agnostic. This interface defines how any LLM
 * (Claude, GPT-4o, Gemini, local models) integrates with the pipeline.
 */

export interface AIProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  chatWithVision(
    messages: VisionMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;
  stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse>;
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VisionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionContent[];
}

export type VisionContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource };

export interface ImageSource {
  type: 'base64' | 'url';
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  stopSequences?: string[];
}

export interface ChatResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  costUSD: number;
  finishReason: 'stop' | 'max_tokens' | 'error';
}

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'local';

export type ModelTier = 'premium' | 'standard' | 'fast';

export interface ModelConfig {
  provider: ProviderName;
  model: string;
  tier: ModelTier;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  maxContextTokens: number;
  supportsVision: boolean;
  supportsJson: boolean;
}

export const DEFAULT_MODELS: Record<ProviderName, Record<ModelTier, ModelConfig>> = {
  anthropic: {
    premium: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      tier: 'premium',
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      maxContextTokens: 200000,
      supportsVision: true,
      supportsJson: true,
    },
    standard: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      tier: 'standard',
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      maxContextTokens: 200000,
      supportsVision: true,
      supportsJson: true,
    },
    fast: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      tier: 'fast',
      inputCostPer1kTokens: 0.0008,
      outputCostPer1kTokens: 0.004,
      maxContextTokens: 200000,
      supportsVision: true,
      supportsJson: true,
    },
  },
  openai: {
    premium: {
      provider: 'openai',
      model: 'gpt-4o',
      tier: 'premium',
      inputCostPer1kTokens: 0.0025,
      outputCostPer1kTokens: 0.01,
      maxContextTokens: 128000,
      supportsVision: true,
      supportsJson: true,
    },
    standard: {
      provider: 'openai',
      model: 'gpt-4o',
      tier: 'standard',
      inputCostPer1kTokens: 0.0025,
      outputCostPer1kTokens: 0.01,
      maxContextTokens: 128000,
      supportsVision: true,
      supportsJson: true,
    },
    fast: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      tier: 'fast',
      inputCostPer1kTokens: 0.00015,
      outputCostPer1kTokens: 0.0006,
      maxContextTokens: 128000,
      supportsVision: true,
      supportsJson: true,
    },
  },
  gemini: {
    premium: {
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      tier: 'premium',
      inputCostPer1kTokens: 0.00125,
      outputCostPer1kTokens: 0.005,
      maxContextTokens: 2000000,
      supportsVision: true,
      supportsJson: true,
    },
    standard: {
      provider: 'gemini',
      model: 'gemini-1.5-pro',
      tier: 'standard',
      inputCostPer1kTokens: 0.00125,
      outputCostPer1kTokens: 0.005,
      maxContextTokens: 2000000,
      supportsVision: true,
      supportsJson: true,
    },
    fast: {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      tier: 'fast',
      inputCostPer1kTokens: 0.000075,
      outputCostPer1kTokens: 0.0003,
      maxContextTokens: 1000000,
      supportsVision: true,
      supportsJson: true,
    },
  },
  local: {
    premium: {
      provider: 'local',
      model: 'local-default',
      tier: 'premium',
      inputCostPer1kTokens: 0,
      outputCostPer1kTokens: 0,
      maxContextTokens: 32000,
      supportsVision: true,
      supportsJson: false,
    },
    standard: {
      provider: 'local',
      model: 'local-default',
      tier: 'standard',
      inputCostPer1kTokens: 0,
      outputCostPer1kTokens: 0,
      maxContextTokens: 32000,
      supportsVision: true,
      supportsJson: false,
    },
    fast: {
      provider: 'local',
      model: 'local-default',
      tier: 'fast',
      inputCostPer1kTokens: 0,
      outputCostPer1kTokens: 0,
      maxContextTokens: 32000,
      supportsVision: true,
      supportsJson: false,
    },
  },
};
