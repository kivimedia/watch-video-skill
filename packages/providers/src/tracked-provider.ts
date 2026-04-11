/**
 * Cost-tracking wrapper around any AIProvider.
 * Intercepts all calls and feeds costs into a CostTracker.
 */

import type { AIProvider, ChatMessage, ChatOptions, ChatResponse, VisionMessage } from '@cutsense/core';
import { CostTracker } from '@cutsense/core';

export class TrackedProvider implements AIProvider {
  public readonly name: string;

  constructor(
    private inner: AIProvider,
    private tracker: CostTracker,
    private stage: string = 'unknown',
  ) {
    this.name = inner.name;
  }

  withStage(stage: string): TrackedProvider {
    return new TrackedProvider(this.inner, this.tracker, stage);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.inner.chat(messages, options);
    this.record(response);
    return response;
  }

  async chatWithVision(messages: VisionMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.inner.chatWithVision(messages, options);
    this.record(response);
    return response;
  }

  async stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const response = await this.inner.stream(messages, onChunk, options);
    this.record(response);
    return response;
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    return this.inner.estimateCost(inputTokens, outputTokens, model);
  }

  private record(response: ChatResponse): void {
    this.tracker.record({
      provider: this.name,
      model: response.model,
      stage: this.stage,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUSD: response.costUSD,
    });
  }
}
