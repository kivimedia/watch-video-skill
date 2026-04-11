// @cutsense/providers - Multi-provider AI adapters

import type { AIProvider, ProviderName } from '@cutsense/core';
import { AnthropicProvider } from './anthropic/provider.js';
import { OpenAIProvider } from './openai/provider.js';
import { GeminiProvider } from './gemini/provider.js';

export { BaseProvider, readImageAsBase64, getMediaType, encodeImageToBase64 } from './base.js';
export { AnthropicProvider } from './anthropic/provider.js';
export { OpenAIProvider } from './openai/provider.js';
export { GeminiProvider } from './gemini/provider.js';
export { TrackedProvider } from './tracked-provider.js';

export function createProvider(
  provider: ProviderName,
  apiKey?: string,
): AIProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'local':
      throw new Error('Local provider not yet implemented');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
