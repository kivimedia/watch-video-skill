/**
 * Base provider - abstract class implementing shared logic.
 */

import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  VisionMessage,
  ProviderName,
} from '@cutsense/core';

export abstract class BaseProvider implements AIProvider {
  abstract name: ProviderName;

  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  abstract chatWithVision(
    messages: VisionMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;

  async stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    // Default: fall back to non-streaming chat
    const response = await this.chat(messages, options);
    onChunk(response.content);
    return response;
  }

  abstract estimateCost(inputTokens: number, outputTokens: number, model?: string): number;

  protected buildCostUSD(
    inputTokens: number,
    outputTokens: number,
    inputPer1k: number,
    outputPer1k: number,
  ): number {
    return (inputTokens / 1000) * inputPer1k + (outputTokens / 1000) * outputPer1k;
  }
}

export function encodeImageToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

export async function readImageAsBase64(filePath: string): Promise<string> {
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(filePath);
  return encodeImageToBase64(buffer);
}

export function getMediaType(
  filePath: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const ext = filePath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}
