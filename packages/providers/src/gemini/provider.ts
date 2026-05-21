/**
 * Google Gemini provider adapter.
 *
 * Uses the official `@google/genai` SDK (Google Gen AI). The legacy
 * `@google/generative-ai` package is no longer used.
 */

import { GoogleGenAI } from '@google/genai';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  VisionMessage,
  VisionContent,
} from '@cutsense/core';
import { BaseProvider } from '../base.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
  'gemini-2.5-flash': { input: 0.0003, output: 0.0025 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
};

const DEFAULT_MODEL = 'gemini-2.5-pro';

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export class GeminiProvider extends BaseProvider {
  name = 'gemini' as const;
  protected client: GoogleGenAI;

  constructor(apiKey?: string) {
    super();
    this.client = new GoogleGenAI({
      apiKey: apiKey ?? process.env.GOOGLE_AI_API_KEY ?? '',
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const modelName = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages.filter((m) => m.role !== 'system');

    const contents = conversation.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await this.client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemMsg?.content,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
        responseMimeType: options?.jsonMode ? 'application/json' : undefined,
        stopSequences: options?.stopSequences,
      },
    });

    return this.toChatResponse(response, modelName);
  }

  async chatWithVision(
    messages: VisionMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const modelName = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages.filter((m) => m.role !== 'system');

    const contents = conversation.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: this.buildParts(m.content),
    }));

    const response = await this.client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction:
          typeof systemMsg?.content === 'string' ? systemMsg.content : undefined,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
        responseMimeType: options?.jsonMode ? 'application/json' : undefined,
        stopSequences: options?.stopSequences,
      },
    });

    return this.toChatResponse(response, modelName);
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = PRICING[model ?? DEFAULT_MODEL] ?? PRICING[DEFAULT_MODEL]!;
    return this.buildCostUSD(inputTokens, outputTokens, pricing.input, pricing.output);
  }

  protected toChatResponse(
    response: { text?: string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } },
    modelName: string,
  ): ChatResponse {
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      content: response.text ?? '',
      inputTokens,
      outputTokens,
      model: modelName,
      costUSD: this.estimateCost(inputTokens, outputTokens, modelName),
      finishReason: 'stop',
    };
  }

  private buildParts(content: string | VisionContent[]): Part[] {
    if (typeof content === 'string') return [{ text: content }];
    return content.map((block): Part => {
      if (block.type === 'text') return { text: block.text };
      return {
        inlineData: {
          mimeType: block.source.mediaType,
          data: block.source.data,
        },
      };
    });
  }
}
