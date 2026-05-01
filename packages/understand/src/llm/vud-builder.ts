import type { VUD, VUDSegment, Entity, Topic, EnergyPoint, AIProvider, KeyMoment } from '@cutsense/core';
import type { IngestResult } from '@cutsense/core';
import type { VisualDescription } from './visual-analyzer.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/llm/ -> dist -> package root
const PKG_ROOT = resolve(__dirname, '..', '..');
const PROMPTS_DIR = resolve(PKG_ROOT, 'src', 'llm', 'prompt-templates');

export async function buildVUD(
  ingestResult: IngestResult,
  segments: VUDSegment[],
  visualDescriptions: VisualDescription[],
  entities: Entity[],
  topics: Topic[],
  energyCurve: EnergyPoint[],
  provider: AIProvider,
): Promise<VUD> {
  const systemPrompt = await readFile(
    resolve(PROMPTS_DIR, 'vud-system.md'),
    'utf-8',
  );

  // Apply visual descriptions to segments
  for (const desc of visualDescriptions) {
    const seg = segments.find((s) => s.sceneId === desc.sceneId);
    if (seg) {
      seg.visualDescription = desc.description;
      seg.sceneType = desc.sceneType as VUDSegment['sceneType'];
      seg.visualInterest = desc.visualInterest;
      seg.textOnScreen = desc.textOnScreen ?? undefined;
      seg.cameraMotion = desc.cameraMotion ?? undefined;
    }
  }

  // Apply entity references to segments
  for (const entity of entities) {
    for (const idx of entity.mentions) {
      if (segments[idx]) {
        segments[idx].entities.push(entity.id);
      }
    }
  }

  // Apply topic references to segments
  for (const topic of topics) {
    for (const segId of topic.segments) {
      const seg = segments.find((s) => s.id === segId);
      if (seg) {
        seg.topics.push(topic.id);
      }
    }
  }

  // Build summary + key moments via LLM
  const segmentSummaries = segments
    .map((s) => {
      const parts = [`[${s.id}] ${s.startTime.toFixed(1)}s-${s.endTime.toFixed(1)}s`];
      if (s.transcript) parts.push(`Speech: "${s.transcript.slice(0, 150)}"`);
      if (s.visualDescription) parts.push(`Visual: ${s.visualDescription.slice(0, 100)}`);
      parts.push(`Energy: ${s.energy.toFixed(2)}, Type: ${s.sceneType ?? 'unknown'}`);
      return parts.join(' | ');
    })
    .join('\n');

  const userPrompt = `Video: ${ingestResult.metadata.width}x${ingestResult.metadata.height}, ${(ingestResult.metadata.fps).toFixed(1)} fps, duration ${(segments[segments.length - 1]?.endTime ?? 0).toFixed(1)}s
Language: ${ingestResult.transcript.language}
Entities: ${entities.map((e) => `${e.name} (${e.type})`).join(', ') || 'none detected'}
Topics: ${topics.map((t) => t.label).join(', ') || 'none detected'}

Segments:
${segmentSummaries}

Generate: summary, keyMoments, and any segmentUpdates for visual fields you want to refine.`;

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { jsonMode: true, maxTokens: 4096 },
  );

  let summary = 'Video analysis complete.';
  let keyMoments: KeyMoment[] = [];

  try {
    const parsed = JSON.parse(response.content);
    summary = parsed.summary ?? summary;

    if (Array.isArray(parsed.keyMoments)) {
      keyMoments = parsed.keyMoments.map((km: Record<string, unknown>) => ({
        segmentId: String(km.segmentId ?? ''),
        label: String(km.label ?? ''),
        reason: String(km.reason ?? ''),
        recommendedForHighlight: Boolean(km.recommendedForHighlight),
      }));
    }

    if (Array.isArray(parsed.segmentUpdates)) {
      for (const update of parsed.segmentUpdates) {
        const seg = segments.find((s) => s.id === update.id);
        if (seg) {
          if (update.visualDescription) seg.visualDescription = update.visualDescription;
          if (update.sceneType) seg.sceneType = update.sceneType;
          if (update.visualInterest) seg.visualInterest = update.visualInterest;
          if (update.textOnScreen !== undefined) seg.textOnScreen = update.textOnScreen;
          if (update.cameraMotion !== undefined) seg.cameraMotion = update.cameraMotion;
        }
      }
    }
  } catch {
    // Use defaults if LLM output parsing fails
  }

  // motion-quality warning (slideshow detection) is now applied in
  // orchestrator.ts BEFORE applyAdaptiveSampling mutates the isDuplicate
  // flags. See orchestrator.ts for the dup-ratio logic.

  const vud: VUD = {
    version: '1.0',
    jobId: ingestResult.jobId,
    sourceFile: '',
    duration: segments.length > 0 ? segments[segments.length - 1]!.endTime : 0,
    language: ingestResult.transcript.language,
    isRTL: ingestResult.transcript.isRTL,
    metadata: ingestResult.metadata,
    segments,
    entities,
    topics,
    energyCurve,
    summary,
    keyMoments,
  };

  return vud;
}
