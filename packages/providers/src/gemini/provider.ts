/**
 * Google Gemini provider adapter.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  VisionMessage,
  VisionContent,
} from '@cutsense/core';
import { BaseProvider } from '../base.js';

const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
};

const DEFAULT_MODEL = 'gemini-1.5-pro';

export class GeminiProvider extends BaseProvider {
  name = 'gemini' as const;
  private genAI: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey ?? process.env.GOOGLE_AI_API_KEY ?? '');
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const modelName = options?.model ?? DEFAULT_MODEL;
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const history = userMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history,
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
    });

    const lastMsg = userMessages[userMessages.length - 1];
    const result = await chat.sendMessage(lastMsg?.content ?? '');
    const response = result.response;

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      content: response.text(),
      inputTokens,
      outputTokens,
      model: modelName,
      costUSD: this.estimateCost(inputTokens, outputTokens, modelName),
      finishReason: 'stop',
    };
  }

  async chatWithVision(
    messages: VisionMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const modelName = options?.model ?? DEFAULT_MODEL;
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const parts = this.buildParts(messages);

    const result = await model.generateContent(parts);
    const response = result.response;

    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      content: response.text(),
      inputTokens,
      outputTokens,
      model: modelName,
      costUSD: this.estimateCost(inputTokens, outputTokens, modelName),
      finishReason: 'stop',
    };
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = PRICING[model ?? DEFAULT_MODEL] ?? PRICING[DEFAULT_MODEL]!;
    return this.buildCostUSD(inputTokens, outputTokens, pricing.input, pricing.output);
  }

  private buildParts(
    messages: VisionMessage[],
  ): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else {
        for (const block of msg.content as VisionContent[]) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else {
            parts.push({
              inlineData: {
                mimeType: block.source.mediaType,
                data: block.source.data,
              },
            });
          }
        }
      }
    }

    return parts;
  }
}
