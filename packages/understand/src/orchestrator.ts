import type { VUD, AIProvider } from '@cutsense/core';
import type { IngestResult } from '@cutsense/core';
import { buildSegments } from './fusion/segment-builder.js';
import { extractEntities } from './fusion/entity-extractor.js';
import { extractTopics } from './fusion/topic-modeler.js';
import { buildEnergyCurve, assignSegmentEnergy } from './fusion/energy-curve.js';
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

  // 3. Run in parallel: visual analysis, entity extraction, topic modeling
  progress('analysis', 'Running visual analysis, entity extraction, and topic modeling');
  const [visualDescriptions, entities, topics] = await Promise.all([
    analyzeVisuals(
      ingestResult.scenes,
      ingestResult.frames,
      ingestResult.contactSheets,
      provider,
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
