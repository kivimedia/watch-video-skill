import type { VUD, AIProvider, CutSenseTimeline, JobConfig } from '@cutsense/core';
import { planCuts } from './planner/cut-planner.js';
import { planCaptions } from './planner/caption-planner.js';
import { analyzePacing } from './planner/pacing-analyzer.js';
import { pickBestTakes } from './planner/take-picker.js';
import { buildTimeline } from './timeline/builder.js';
import { validateTimeline } from './validators/timeline-validator.js';

export interface EditOptions {
  targetDuration?: number;
  captionStyle?: JobConfig['captionStyle'];
  onProgress?: (step: string, detail?: string) => void;
  /** Remove silence gaps >= this many seconds. 0 or undefined = disabled. */
  silenceThresholdSec?: number;
  /** Take-picker strategy. 'vision_audio' scores by Whisper confidence + VUD visual quality. */
  takePicker?: 'vision_audio' | 'none';
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
  let edl = await planCuts(vud, instruction, provider, options.targetDuration);

  // Override caption mode from user options (including forcing 'none')
  if (options.captionStyle !== undefined) {
    edl.captionMode = options.captionStyle === 'none' ? 'none' : options.captionStyle;
  }

  // 2. Take-picker: detect repeated lines and keep the best delivery
  if (options.takePicker && options.takePicker !== 'none') {
    progress('take-picker', 'Scanning for repeated takes');
    const result = pickBestTakes(vud, edl);
    edl = result.edl;
    if (result.log.length > 0) {
      const summary = result.log
        .map((l) => `"${l.phrase}..." (${l.takes.length} takes, kept score ${l.takes.find((t) => t.kept)?.combinedScore.toFixed(2)})`)
        .join('; ');
      progress('take-picker', `${result.log.length} repeat cluster(s) resolved: ${summary}`);
    } else {
      progress('take-picker', 'No repeated takes detected');
    }
  }

  // 3. Analyze pacing
  progress('pacing', 'Analyzing pacing');
  const pacingWarnings = analyzePacing(vud, edl);
  if (pacingWarnings.length > 0) {
    progress('pacing-warning', pacingWarnings.join('; '));
  }

  const silenceThreshold = options.silenceThresholdSec ?? 0;

  // 4. Plan captions (from actual spoken audio - silence gaps are excised from frame offsets)
  let captions;
  if (edl.captionMode !== 'none') {
    progress('captions', `Building ${edl.captionMode} captions from spoken audio`);
    captions = planCaptions(vud, edl, vud.metadata.fps || 30, silenceThreshold);
  }

  // 5. Build timeline (silence islands kept in sync with caption frame offsets)
  progress('timeline', 'Assembling Remotion timeline');
  const timeline = buildTimeline(vud, edl, captions, silenceThreshold);

  // 6. Validate
  progress('validate', 'Validating timeline');
  const validation = validateTimeline(timeline);
  if (!validation.valid) {
    progress('warning', `Timeline validation issues: ${validation.errors.join(', ')}`);
  }

  progress('done', `Edit complete: ${timeline.clips.length} clips, ${(timeline.durationInFrames / timeline.fps).toFixed(1)}s`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (timeline as any)._edl = edl;
  return timeline;
}
