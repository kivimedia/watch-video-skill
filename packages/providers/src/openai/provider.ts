/**
 * OpenAI GPT-4o provider adapter.
 */

import OpenAI from 'openai';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  VisionMessage,
  VisionContent,
} from '@cutsense/core';
import { BaseProvider } from '../base.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
};

const DEFAULT_MODEL = 'gpt-4o';

export class OpenAIProvider extends BaseProvider {
  name = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey?: string) {
    super();
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model ?? DEFAULT_MODEL;

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      response_format: options?.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0]!;
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    return {
      content: choice.message.content ?? '',
      inputTokens,
      outputTokens,
      model,
      costUSD: this.estimateCost(inputTokens, outputTokens, model),
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'max_tokens',
    };
  }

  async chatWithVision(
    messages: VisionMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model ?? DEFAULT_MODEL;

    const openaiMessages = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: this.convertVisionContent(m.content),
    }));

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      messages: openaiMessages as OpenAI.ChatCompletionMessageParam[],
    });

    const choice = response.choices[0]!;
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    return {
      content: choice.message.content ?? '',
      inputTokens,
      outputTokens,
      model,
      costUSD: this.estimateCost(inputTokens, outputTokens, model),
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'max_tokens',
    };
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = PRICING[model ?? DEFAULT_MODEL] ?? PRICING[DEFAULT_MODEL]!;
    return this.buildCostUSD(inputTokens, outputTokens, pricing.input, pricing.output);
  }

  private convertVisionContent(
    content: string | VisionContent[],
  ): string | OpenAI.ChatCompletionContentPart[] {
    if (typeof content === 'string') return content;

    return content.map((block): OpenAI.ChatCompletionContentPart => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      return {
        type: 'image_url',
        image_url: {
          url:
            block.source.type === 'url'
              ? block.source.data
              : `data:${block.source.mediaType};base64,${block.source.data}`,
        },
      };
    });
  }
}
