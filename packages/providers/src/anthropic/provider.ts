/**
 * Anthropic Claude provider adapter.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  VisionMessage,
  VisionContent,
} from '@cutsense/core';
import { BaseProvider } from '../base.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
  'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
};

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey?: string) {
    super();
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system: systemMsg?.content,
      messages: userMessages,
    });

    const content =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    return {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model,
      costUSD: this.estimateCost(
        response.usage.input_tokens,
        response.usage.output_tokens,
        model,
      ),
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'max_tokens',
    };
  }

  async chatWithVision(
    messages: VisionMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === 'system');

    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: this.convertVisionContent(m.content),
      }));

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system: typeof systemMsg?.content === 'string' ? systemMsg.content : undefined,
      messages: userMessages,
    });

    const content =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    return {
      content,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model,
      costUSD: this.estimateCost(
        response.usage.input_tokens,
        response.usage.output_tokens,
        model,
      ),
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'max_tokens',
    };
  }

  async stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = this.client.messages.stream({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system: systemMsg?.content,
      messages: userMessages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onChunk(event.delta.text);
        fullContent += event.delta.text;
      }
      if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      }
    }

    const finalMessage = await stream.finalMessage();
    inputTokens = finalMessage.usage.input_tokens;
    outputTokens = finalMessage.usage.output_tokens;

    return {
      content: fullContent,
      inputTokens,
      outputTokens,
      model,
      costUSD: this.estimateCost(inputTokens, outputTokens, model),
      finishReason:
        finalMessage.stop_reason === 'end_turn' ? 'stop' : 'max_tokens',
    };
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = PRICING[model ?? DEFAULT_MODEL] ?? PRICING[DEFAULT_MODEL]!;
    return this.buildCostUSD(inputTokens, outputTokens, pricing.input, pricing.output);
  }

  private convertVisionContent(
    content: string | VisionContent[],
  ): string | Anthropic.ContentBlockParam[] {
    if (typeof content === 'string') return content;

    return content.map((block): Anthropic.ContentBlockParam => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.source.mediaType,
          data: block.source.data,
        },
      };
    });
  }
}
