import type { VUD, AIProvider } from '@cutsense/core';
import type { IngestResult } from '@cutsense/core';
import { buildSegments } from './fusion/segment-builder.js';
import { extractEntities } from './fusion/entity-extractor.js';
import { extractTopics } from './fusion/topic-modeler.js';
import { buildEnergyCurve, assignSegmentEnergy } from './fusion/energy-curve.js';
import { applyAdaptiveSampling } from './fusion/adaptive-sampling.js';
import { analyzeVisuals } from './llm/visual-analyzer.js';
import { buildVUD } from './llm/vud-builder.js';
import { enhanceVUD } from './llm/more-ai.js';
import { validateVUD } from './validators/vud-validator.js';

export interface UnderstandOptions {
  moreAI?: boolean;
  onProgress?: (step: string, detail?: string) => void;
}

export async function understand(
  ingestResult: IngestResult,
  provider: AIProvider,
  options: UnderstandOptions = {},
): Promise<VUD> {
  const progress = options.onProgress ?? (() => {});

  // 1. Build segments from transcript + scenes
  progress('segments', 'Merging transcript with scene boundaries');
  const segments = buildSegments(
    ingestResult.transcript,
    ingestResult.scenes,
    Number(ingestResult.metadata.lufs?.inputI ?? 0) > 0 ? 0 :
      ingestResult.scenes.length > 0
        ? ingestResult.scenes[ingestResult.scenes.length - 1]!.endTime
        : ingestResult.transcript.words.length > 0
          ? ingestResult.transcript.words[ingestResult.transcript.words.length - 1]!.end
          : 0,
  );

  // 2. Build energy curve (no LLM needed)
  progress('energy', 'Calculating energy curve');
  const energyCurve = buildEnergyCurve(segments, ingestResult.metadata.lufs);
  assignSegmentEnergy(segments, energyCurve);

  // Snapshot raw duplicate-frame ratio BEFORE applyAdaptiveSampling mutates
  // the isDuplicate flags. This is the motion-quality signal: how many frames
  // are perceptual duplicates of their predecessor as the ingest layer
  // originally measured them via phash.
  //
  // Without this snapshot, the dup-ratio reading is misleading because Phase
  // 2 of adaptive sampling (visual-change reflag) clears isDuplicate on
  // frames it wants to keep for visual analysis - typically masking 50%+ of
  // the original duplicates.
  //
  // Threshold 40% chosen empirically: SalesEcho live-shot reels score
  // ~10-15%, Hedra talking-head clips ~5-15%, but Ken-Burns-only static
  // reels score >50%. 40% is the floor where "slideshow feel" becomes
  // obvious to a human viewer.
  const rawTotalFrames = ingestResult.frames.length;
  const rawDupCount = ingestResult.frames.filter((f) => f.isDuplicate).length;
  const rawDupRatio = rawTotalFrames > 0 ? rawDupCount / rawTotalFrames : 0;

  // 2.5. Adaptive frame sampling - refine which frames are available for visual analysis
  progress('adaptive-sampling', 'Refining frame selection based on speech and visual changes');
  const samplingStats = applyAdaptiveSampling(ingestResult.frames, ingestResult.transcript);
  progress('adaptive-sampling-done',
    `Phase 1: +${samplingStats.phase1Unflagged} frames (speech density), ` +
    `Phase 2: +${samplingStats.phase2Unflagged} frames (visual change), ` +
    `Total kept: ${samplingStats.totalKept}`,
  );

  // 3. Run in parallel: visual analysis, entity extraction, topic modeling
  progress('analysis', 'Running visual analysis, entity extraction, and topic modeling');
  const [visualDescriptions, entities, topics] = await Promise.all([
    analyzeVisuals(
      ingestResult.scenes,
      ingestResult.frames,
      ingestResult.contactSheets,
      provider,
      true, // Use per-scene frame analysis for accurate visual descriptions
    ),
    extractEntities(segments, provider),
    extractTopics(segments, provider),
  ]);

  // 4. Build full VUD
  progress('vud', 'Generating Video Understanding Document');
  const vud = await buildVUD(
    ingestResult,
    segments,
    visualDescriptions,
    entities,
    topics,
    energyCurve,
    provider,
  );

  // 4.5. Surface motion-quality warning when raw duplicate-frame ratio is
  // high enough that the video reads as a slideshow. Prepend to the LLM-
  // produced summary so anyone reading the VUD sees this top-line.
  if (rawDupRatio >= 0.40 && rawTotalFrames > 0) {
    const pct = Math.round(rawDupRatio * 100);
    vud.summary = `[motion-quality: ${pct}% of frames are perceptual duplicates of the prior frame - subjects show minimal movement; this video may read as a slideshow rather than live footage] ${vud.summary}`;
  }

  // 5. Validate
  progress('validate', 'Validating VUD');
  const validation = validateVUD(vud);
  if (!validation.valid) {
    progress('warning', `VUD validation warnings: ${validation.errors.join(', ')}`);
  }

  // 6. MORE AI mode
  if (options.moreAI) {
    progress('more-ai', 'Running enhanced analysis (MORE AI mode)');
    const moreAIResult = await enhanceVUD(vud, provider);
    vud.moreAI = moreAIResult;
  }

  progress('done', 'Understanding complete');
  return vud;
}
