import type { VUD, AIProvider, CutSenseTimeline, JobConfig } from '@cutsense/core';
import { planCuts } from './planner/cut-planner.js';
import { planCaptions } from './planner/caption-planner.js';
import { analyzePacing } from './planner/pacing-analyzer.js';
import { buildTimeline } from './timeline/builder.js';
import { validateTimeline } from './validators/timeline-validator.js';

export interface EditOptions {
  targetDuration?: number;
  captionStyle?: JobConfig['captionStyle'];
  onProgress?: (step: string, detail?: string) => void;
}

export async function edit(
  vud: VUD,
  instruction: string,
  provider: AIProvider,
  options: EditOptions = {},
): Promise<CutSenseTimeline> {
  const progress = options.onProgress ?? (() => {});

  // 1. Plan cuts
  progress('planning', 'Generating edit decision list');
  const edl = await planCuts(vud, instruction, provider, options.targetDuration);

  // Override caption mode if specified in options
  if (options.captionStyle && options.captionStyle !== 'none') {
    edl.captionMode = options.captionStyle;
  }

  // 2. Analyze pacing
  progress('pacing', 'Analyzing pacing');
  const pacingWarnings = analyzePacing(vud, edl);
  if (pacingWarnings.length > 0) {
    progress('pacing-warning', pacingWarnings.join('; '));
  }

  // 3. Plan captions
  let captions;
  if (edl.captionMode !== 'none') {
    progress('captions', `Building ${edl.captionMode} captions`);
    captions = planCaptions(vud, edl, vud.metadata.fps || 30);
  }

  // 4. Build timeline
  progress('timeline', 'Assembling Remotion timeline');
  const timeline = buildTimeline(vud, edl, captions);

  // 5. Validate
  progress('validate', 'Validating timeline');
  const validation = validateTimeline(timeline);
  if (!validation.valid) {
    progress('warning', `Timeline validation issues: ${validation.errors.join(', ')}`);
  }

  progress('done', `Edit complete: ${timeline.clips.length} clips, ${(timeline.durationInFrames / timeline.fps).toFixed(1)}s`);
  return timeline;
}
