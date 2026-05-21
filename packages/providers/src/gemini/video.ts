/**
 * Gemini multimodal video processor.
 *
 * Routes video inputs based on source and size:
 *   - YouTube URLs           → passed as fileData with a public URI
 *   - Local files ≤ 20 MB    → embedded inline as base64
 *   - Local files > 20 MB    → uploaded via client.files.upload(), polled
 *                              until ACTIVE, then referenced by file.uri
 *
 * Always wraps generation in try/finally so uploaded files are deleted —
 * the Files API otherwise retains them for 48 hours.
 *
 * Use `analyzeVideoStructured` to receive JSON conforming to a caller-provided
 * schema (timestamps, OCR, summaries). Helpers below cover the common shapes.
 */

import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { GoogleGenAI, createPartFromUri, createUserContent, type Part } from '@google/genai';
import type { ChatResponse } from '@cutsense/core';
import { preprocessVideo, type PreprocessOptions } from './preprocess.js';

const INLINE_LIMIT_BYTES = 20 * 1024 * 1024;
const UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024 * 1024;
const DEFAULT_POLL_MS = 5_000;
const DEFAULT_POLL_TIMEOUT_MS = 10 * 60 * 1000;

export type GeminiVideoModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | (string & {});

export interface VideoSource {
  /** Local filesystem path. Mutually exclusive with `youtubeUrl` / `inlineData`. */
  path?: string;
  /** Public YouTube URL. Gemini ingests these directly. */
  youtubeUrl?: string;
  /** Pre-encoded inline payload, for callers that already hold bytes in memory. */
  inlineData?: { mimeType: string; data: string };
}

export interface AnalyzeOptions {
  model?: GeminiVideoModel;
  /** Run FFmpeg downscaling/fps reduction before sending. Local paths only. */
  preprocess?: PreprocessOptions | boolean;
  /** Polling cadence for upload state checks. */
  pollIntervalMs?: number;
  /** Hard cap for the upload-state polling loop. */
  pollTimeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StructuredAnalyzeOptions<T> extends AnalyzeOptions {
  /** JSON schema describing the expected structured response. */
  responseSchema: Record<string, unknown>;
  /** Optional runtime parser/validator. Default: JSON.parse only. */
  parse?: (raw: string) => T;
}

export interface TimestampedEvent {
  timestamp: string;
  event: string;
}

export interface SceneSummaryEntry {
  startTimestamp: string;
  endTimestamp: string;
  summary: string;
  speakers?: string[];
}

export interface ScreenTextEntry {
  timestamp: string;
  text: string;
}

export class GeminiVideoProcessor {
  private client: GoogleGenAI;
  private defaultModel: GeminiVideoModel;

  constructor(apiKey?: string, defaultModel: GeminiVideoModel = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({
      apiKey: apiKey ?? process.env.GOOGLE_AI_API_KEY ?? '',
    });
    this.defaultModel = defaultModel;
  }

  /**
   * Send a free-form prompt against a video. Returns the raw text response
   * plus token accounting suitable for cost tracking.
   */
  async analyzeVideo(
    source: VideoSource,
    prompt: string,
    options: AnalyzeOptions = {},
  ): Promise<ChatResponse> {
    return this.runAnalysis(source, prompt, options);
  }

  /**
   * Send a prompt and request a JSON response matching `responseSchema`. The
   * raw text is parsed with `options.parse` (default `JSON.parse`) and surfaced
   * alongside the chat response.
   */
  async analyzeVideoStructured<T>(
    source: VideoSource,
    prompt: string,
    options: StructuredAnalyzeOptions<T>,
  ): Promise<{ response: ChatResponse; data: T }> {
    const response = await this.runAnalysis(source, prompt, options, {
      responseMimeType: 'application/json',
      responseSchema: options.responseSchema,
    });
    const parse = options.parse ?? ((raw: string) => JSON.parse(raw) as T);
    return { response, data: parse(response.content) };
  }

  /** Extract a list of `{timestamp, event}` markers. */
  async extractTimestamps(
    source: VideoSource,
    instruction = 'List the salient events in this video.',
    options: AnalyzeOptions = {},
  ): Promise<{ response: ChatResponse; events: TimestampedEvent[] }> {
    const { response, data } = await this.analyzeVideoStructured<TimestampedEvent[]>(
      source,
      `${instruction}\nReturn a JSON array of objects with keys "timestamp" (MM:SS or HH:MM:SS) and "event" (short description).`,
      {
        ...options,
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              timestamp: { type: 'STRING' },
              event: { type: 'STRING' },
            },
            required: ['timestamp', 'event'],
          },
        },
      },
    );
    return { response, events: data };
  }

  /** OCR text-on-screen at each timestamp it appears. */
  async extractScreenText(
    source: VideoSource,
    options: AnalyzeOptions = {},
  ): Promise<{ response: ChatResponse; entries: ScreenTextEntry[] }> {
    const { response, data } = await this.analyzeVideoStructured<ScreenTextEntry[]>(
      source,
      'Transcribe every distinct piece of text shown on screen. Return a JSON array of objects with keys "timestamp" (when the text first appears) and "text" (the on-screen text exactly as written).',
      {
        ...options,
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              timestamp: { type: 'STRING' },
              text: { type: 'STRING' },
            },
            required: ['timestamp', 'text'],
          },
        },
      },
    );
    return { response, entries: data };
  }

  /** Combined audio + visual scene-by-scene summary. */
  async summarizeScenes(
    source: VideoSource,
    options: AnalyzeOptions = {},
  ): Promise<{ response: ChatResponse; scenes: SceneSummaryEntry[] }> {
    const { response, data } = await this.analyzeVideoStructured<SceneSummaryEntry[]>(
      source,
      'Segment this video into scenes. For each scene, summarize what is happening visually AND what is said. Return a JSON array of objects with keys "startTimestamp", "endTimestamp", "summary", and "speakers" (array of speaker labels if discernible).',
      {
        ...options,
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              startTimestamp: { type: 'STRING' },
              endTimestamp: { type: 'STRING' },
              summary: { type: 'STRING' },
              speakers: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['startTimestamp', 'endTimestamp', 'summary'],
          },
        },
      },
    );
    return { response, scenes: data };
  }

  private async runAnalysis(
    source: VideoSource,
    prompt: string,
    options: AnalyzeOptions,
    extraConfig: Record<string, unknown> = {},
  ): Promise<ChatResponse> {
    const model = options.model ?? this.defaultModel;
    const { part, cleanup } = await this.resolveSource(source, options);

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: createUserContent([part, prompt]),
        config: {
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          ...extraConfig,
        },
      });

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
      return {
        content: response.text ?? '',
        inputTokens,
        outputTokens,
        model,
        costUSD: 0,
        finishReason: 'stop',
      };
    } catch (err) {
      throw wrapGenerateError(err);
    } finally {
      await cleanup().catch(() => undefined);
    }
  }

  private async resolveSource(
    source: VideoSource,
    options: AnalyzeOptions,
  ): Promise<{ part: Part; cleanup: () => Promise<void> }> {
    if (source.youtubeUrl) {
      return {
        part: { fileData: { fileUri: source.youtubeUrl } },
        cleanup: async () => undefined,
      };
    }

    if (source.inlineData) {
      return {
        part: { inlineData: source.inlineData },
        cleanup: async () => undefined,
      };
    }

    if (!source.path) {
      throw new Error('VideoSource requires one of: path, youtubeUrl, inlineData');
    }

    const effectivePath = await maybePreprocess(source.path, options.preprocess);
    const { size } = await stat(effectivePath);

    if (size > UPLOAD_LIMIT_BYTES) {
      throw new Error(
        `Video ${effectivePath} is ${size} bytes — exceeds Gemini 20GB Files API limit`,
      );
    }

    if (size <= INLINE_LIMIT_BYTES) {
      const data = (await readFile(effectivePath)).toString('base64');
      return {
        part: { inlineData: { mimeType: mimeTypeFor(effectivePath), data } },
        cleanup: async () => undefined,
      };
    }

    const file = await this.uploadAndWait(effectivePath, options);
    return {
      part: createPartFromUri(file.uri!, file.mimeType ?? mimeTypeFor(effectivePath)),
      cleanup: async () => {
        if (file.name) {
          await this.client.files.delete({ name: file.name });
        }
      },
    };
  }

  private async uploadAndWait(
    path: string,
    options: AnalyzeOptions,
  ): Promise<{ name?: string; uri?: string; mimeType?: string; state?: string }> {
    const uploaded = await this.client.files.upload({
      file: path,
      config: { mimeType: mimeTypeFor(path) },
    });

    const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_MS;
    const pollTimeout = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    const deadline = Date.now() + pollTimeout;

    let file = uploaded;
    while (file.state === 'PROCESSING') {
      if (Date.now() > deadline) {
        if (file.name) await this.client.files.delete({ name: file.name }).catch(() => undefined);
        throw new Error(`Gemini file processing timed out after ${pollTimeout}ms`);
      }
      await sleep(pollInterval);
      if (!file.name) break;
      file = await this.client.files.get({ name: file.name });
    }

    if (file.state === 'FAILED') {
      if (file.name) await this.client.files.delete({ name: file.name }).catch(() => undefined);
      throw new Error('Gemini file processing failed');
    }

    return file;
  }
}

async function maybePreprocess(
  inputPath: string,
  pre: PreprocessOptions | boolean | undefined,
): Promise<string> {
  if (!pre) return inputPath;
  const opts = pre === true ? {} : pre;
  const result = await preprocessVideo(inputPath, opts);
  return result.outputPath;
}

function mimeTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.mpeg':
    case '.mpg':
      return 'video/mpeg';
    default:
      return 'video/mp4';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wrapGenerateError(err: unknown): Error {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      return new Error(`Gemini rate limit (429): ${err.message}`);
    }
    return err;
  }
  return new Error(String(err));
}

/**
 * Choose a routing decision without performing it — useful for callers that
 * want to log or budget before uploading. Returns `'inline' | 'upload' |
 * 'youtube'`.
 */
export function classifyVideoRoute(source: {
  sizeBytes?: number;
  youtubeUrl?: string;
}): 'youtube' | 'inline' | 'upload' {
  if (source.youtubeUrl) return 'youtube';
  if ((source.sizeBytes ?? 0) <= INLINE_LIMIT_BYTES) return 'inline';
  return 'upload';
}

export const VIDEO_INLINE_LIMIT_BYTES = INLINE_LIMIT_BYTES;
export const VIDEO_UPLOAD_LIMIT_BYTES = UPLOAD_LIMIT_BYTES;
