import {
  type Job,
  type AIProvider,
  type VUD,
  type CutSenseTimeline,
  JobState,
  transitionJob,
  createJobEvent,
  CostTracker,
} from '@cutsense/core';
import { updateJob, getJob } from '@cutsense/storage';
import { saveJSON, loadJSON, getArtifactPath, saveManifest } from '@cutsense/storage';
import type { IngestResult, IngestOptions } from '@cutsense/core';
import { IngestOrchestrator } from '@cutsense/ingest';
import { understand } from '@cutsense/understand';
import { edit, selectEnhancements, validateTimeline } from '@cutsense/edit';
import { validateVUD } from '@cutsense/understand';
import { checkVUDGate, checkEditGate } from '@cutsense/core';
import { TrackedProvider } from '@cutsense/providers';
import {
  render,
  canUseFastRender,
  renderWithFFmpeg,
  generateEnhancementSpecs,
  renderAllEnhancedScenes,
  applyEnhancementInserts,
  buildEnhancementManifest,
} from '@cutsense/renderer';

export interface PipelineOptions {
  provider: AIProvider;
  ingestOptions?: IngestOptions;
  moreAI?: boolean;
  userInstruction?: string;
  targetDuration?: number;
  captionStyle?: 'none' | 'standard' | 'jumbo' | 'jumbo-then-standard';
  /** Enable hybrid rendering: Revideo inserts for premium segments */
  enableEnhancement?: boolean;
  maxEnhancedSegments?: number;
  maxBudgetUSD?: number;
  maxRepairAttempts?: number;
  onProgress?: (stage: string, step: string, detail?: string) => void;
}

export class JobOrchestrator {
  private costTracker: CostTracker;
  private trackedProvider: TrackedProvider;
  private maxRepairAttempts: number;

  constructor(private options: PipelineOptions) {
    this.maxRepairAttempts = options.maxRepairAttempts ?? 1;
    this.costTracker = new CostTracker(options.maxBudgetUSD);
    this.trackedProvider = new TrackedProvider(options.provider, this.costTracker);
  }

  async run(jobId: string): Promise<Job> {
    let job = await getJob(jobId);
    const progress = this.options.onProgress ?? (() => {});

    try {
      // Ingest
      if (job.state === JobState.CREATED || job.state === JobState.INGEST_FAILED) {
        job = await this.runIngest(job, progress);
      }

      // Understand (with repair loop)
      if (job.state === JobState.INGEST_DONE) {
        job = await this.runUnderstand(job, progress);

        // VUD gate check + repair
        if (job.state === JobState.UNDERSTAND_DONE) {
          const vud = await loadJSON<VUD>(job.id, 'vud', 'vud.json');
          const gateResult = checkVUDGate(vud);
          if (!gateResult.passed) {
            progress('repair', 'vud-gate', `VUD gate failed: ${gateResult.issues.map((i) => i.message).join('; ')}`);
            if (this.maxRepairAttempts > 0) {
              progress('repair', 'vud-retry', 'Attempting VUD repair (re-running understand)');
              job = await this.runUnderstand(job, progress);
            }
          }
        }
      }

      // Edit (with repair loop)
      if (job.state === JobState.UNDERSTAND_DONE && this.options.userInstruction) {
        job = await this.runEdit(job, progress);

        // Edit gate check + repair
        if (job.state === JobState.EDIT_DONE) {
          const timeline = await loadJSON<CutSenseTimeline>(job.id, 'edit', 'timeline.json');
          const validation = validateTimeline(timeline);
          if (!validation.valid) {
            progress('repair', 'edit-gate', `Edit gate failed: ${validation.errors.join('; ')}`);
            if (this.maxRepairAttempts > 0) {
              progress('repair', 'edit-retry', 'Attempting edit repair (re-running edit)');
              job = await this.runEdit(job, progress);
            }
          }
        }
      }

      // Enhancement (hybrid Remotion + Revideo)
      if (job.state === JobState.EDIT_DONE && this.options.enableEnhancement) {
        await this.runEnhancement(job, progress);
      }

      // Render
      if (job.state === JobState.EDIT_DONE) {
        job = await this.runRender(job, progress);
      }

      // Save cost report + run manifest
      await this.saveCostReport(jobId, progress);
      await this.saveRunManifest(jobId, job, progress);
      return job;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress('error', 'pipeline', errorMsg);
      await this.saveCostReport(jobId, progress).catch(() => {});
      return job;
    }
  }

  private async saveCostReport(
    jobId: string,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<void> {
    const costManifest = this.costTracker.toManifest();
    await saveJSON(jobId, 'output', 'cost-report.json', costManifest);
    if (costManifest.total > 0) {
      progress('costs', 'saved', `Total: $${costManifest.total.toFixed(4)} | ${this.costTracker.totalInputTokens + this.costTracker.totalOutputTokens} tokens`);
    }
    if (this.costTracker.isOverBudget) {
      progress('costs', 'warning', 'Job exceeded budget limit');
    }
  }

  private async saveRunManifest(
    jobId: string,
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<void> {
    try {
      const manifest = {
        job,
        policyVersion: '2026-04-11.1',
        source: { filename: job.sourceFileName, durationSec: 0 },
        brief: job.config,
        artifacts: {} as Record<string, unknown>,
        scores: { renderValidation: job.state === JobState.RENDER_DONE ? 'pass' as const : 'pending' as const },
        costs: this.costTracker.toManifest(),
        runtime: { repairLoops: {}, retries: {}, humanActions: [] },
        releaseDecision: {
          status: job.state === JobState.RENDER_DONE ? 'released' as const : 'held' as const,
          reason: job.state === JobState.RENDER_DONE ? 'pipeline_complete' : `stopped_at_${job.state}`,
          overrides: [],
        },
        events: [],
      };
      await saveManifest(jobId, manifest as any);
      progress('manifest', 'saved', `Run manifest written for ${jobId}`);
    } catch (err) {
      progress('manifest', 'error', `Failed to save manifest: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async runIngest(
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<Job> {
    job = transitionJob(job, JobState.INGESTING);
    await updateJob(job.id, { state: job.state });
    progress('ingest', 'starting', 'Beginning video ingest');

    try {
      const orchestrator = new IngestOrchestrator();
      const result = await orchestrator.ingest(
        job.sourcePath,
        job.id,
        this.options.ingestOptions ?? {},
      );

      await saveJSON(job.id, 'transcript', 'ingest-result.json', result);

      job = transitionJob(job, JobState.INGEST_DONE);
      await updateJob(job.id, { state: job.state });
      progress('ingest', 'done', `Ingest complete: ${result.frames.length} frames, ${result.scenes.length} scenes`);
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job = transitionJob(job, JobState.INGEST_FAILED, msg);
      await updateJob(job.id, { state: job.state, error: msg });
      throw err;
    }
  }

  private async runUnderstand(
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<Job> {
    job = transitionJob(job, JobState.UNDERSTANDING);
    await updateJob(job.id, { state: job.state });
    progress('understand', 'starting', 'Building Video Understanding Document');

    try {
      const ingestResult = await loadJSON<IngestResult>(job.id, 'transcript', 'ingest-result.json');

      const vud = await understand(ingestResult, this.trackedProvider.withStage('understand'), {
        moreAI: this.options.moreAI,
        onProgress: (step, detail) => progress('understand', step, detail),
      });

      vud.sourceFile = job.sourcePath;
      await saveJSON(job.id, 'vud', 'vud.json', vud);

      job = transitionJob(job, JobState.UNDERSTAND_DONE);
      await updateJob(job.id, { state: job.state });
      progress('understand', 'done', `VUD complete: ${vud.segments.length} segments, ${vud.entities.length} entities`);
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job = transitionJob(job, JobState.UNDERSTAND_FAILED, msg);
      await updateJob(job.id, { state: job.state, error: msg });
      throw err;
    }
  }

  private async runEdit(
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<Job> {
    job = transitionJob(job, JobState.EDITING);
    await updateJob(job.id, { state: job.state });
    progress('edit', 'starting', 'Generating edit decisions');

    try {
      const vud = await loadJSON<VUD>(job.id, 'vud', 'vud.json');

      const timeline = await edit(vud, this.options.userInstruction!, this.trackedProvider.withStage('edit'), {
        targetDuration: this.options.targetDuration,
        captionStyle: this.options.captionStyle,
        silenceThresholdSec: job.config.silenceCutMinMs ? job.config.silenceCutMinMs / 1000 : undefined,
        takePicker: job.config.takePicker ?? 'none',
        onProgress: (step, detail) => progress('edit', step, detail),
      });

      await saveJSON(job.id, 'edit', 'timeline.json', timeline);

      job = transitionJob(job, JobState.EDIT_DONE);
      await updateJob(job.id, { state: job.state });
      progress('edit', 'done', `Timeline: ${timeline.clips.length} clips, ${(timeline.durationInFrames / timeline.fps).toFixed(1)}s`);
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job = transitionJob(job, JobState.EDIT_FAILED, msg);
      await updateJob(job.id, { state: job.state, error: msg });
      throw err;
    }
  }

  private async runEnhancement(
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<void> {
    progress('enhance', 'starting', 'Detecting enhancement opportunities');

    try {
      const vud = await loadJSON<VUD>(job.id, 'vud', 'vud.json');
      const timeline = await loadJSON<CutSenseTimeline>(job.id, 'edit', 'timeline.json');

      // Load the EDL to run enhancement selection
      const { planCuts } = await import('@cutsense/edit');
      // Re-use the edit decisions from the timeline to select enhancements
      const decisions = await selectEnhancements(
        vud,
        {
          jobId: vud.jobId,
          targetDurationSec: timeline.durationInFrames / timeline.fps,
          actualDurationSec: timeline.durationInFrames / timeline.fps,
          decisions: timeline.clips.map((c) => ({
            segmentId: c.originalSegmentId ?? c.id,
            action: 'keep' as const,
            reason: 'kept in timeline',
          })),
          captionMode: 'none',
          transitionDefault: 'cut',
        },
        this.trackedProvider.withStage('enhance'),
        { maxEnhancedSegments: this.options.maxEnhancedSegments },
      );

      const candidates = decisions.filter((d) => d.level !== 'standard');
      if (candidates.length === 0) {
        progress('enhance', 'skip', 'No segments need enhancement');
        return;
      }

      progress('enhance', 'specs', `${candidates.length} segments selected for enhancement`);

      // Generate specs
      const specs = generateEnhancementSpecs(vud, decisions);

      // Render enhanced scenes
      const enhancementDir = getArtifactPath(job.id, 'output', '');
      progress('enhance', 'rendering', `Rendering ${specs.length} enhanced scenes`);

      const results = await renderAllEnhancedScenes(specs, {
        outputDir: enhancementDir,
        onProgress: (sceneId, percent) => {
          progress('enhance', 'scene', `${sceneId}: ${percent}%`);
        },
      });

      // Apply inserts to timeline
      const enhancedTimeline = applyEnhancementInserts(timeline, specs, results);
      await saveJSON(job.id, 'edit', 'timeline.json', enhancedTimeline);

      // Save enhancement manifest
      const manifest = buildEnhancementManifest(
        job.id,
        vud.segments.length,
        specs,
        results,
      );
      await saveJSON(job.id, 'edit', 'enhancement-manifest.json', manifest);

      const successCount = results.filter((r) => r.success).length;
      const fallbackCount = results.filter((r) => r.fallbackToStandard).length;
      progress(
        'enhance',
        'done',
        `Enhanced ${successCount}/${specs.length} segments (${fallbackCount} fell back to standard)`,
      );
    } catch (err) {
      // Enhancement failure is not fatal - the standard timeline still works
      const msg = err instanceof Error ? err.message : String(err);
      progress('enhance', 'error', `Enhancement failed (non-fatal): ${msg}`);
    }
  }

  private async runRender(
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<Job> {
    job = transitionJob(job, JobState.RENDERING);
    await updateJob(job.id, { state: job.state });

    try {
      const timeline = await loadJSON<CutSenseTimeline>(job.id, 'edit', 'timeline.json');
      const outputPath = getArtifactPath(job.id, 'output', 'output.mp4');

      if (canUseFastRender(timeline)) {
        progress('render', 'starting', 'Fast rendering with FFmpeg (lossless stream copy)');
        await renderWithFFmpeg(timeline, outputPath, {
          onProgress: ({ percent }) => {
            progress('render', 'progress', `Rendering: ${percent}%`);
          },
        });
      } else {
        progress('render', 'starting', 'Rendering with Remotion');
        await render(timeline, outputPath, {
          onProgress: ({ percent }: { percent: number }) => {
            progress('render', 'progress', `Rendering: ${percent}%`);
          },
          onBundleProgress: (p: number) => {
            progress('render', 'bundling', `Bundling compositions: ${(p * 100).toFixed(0)}%`);
          },
        });
      }

      job = transitionJob(job, JobState.RENDER_DONE);
      await updateJob(job.id, { state: job.state });
      progress('render', 'done', `Output: ${outputPath}`);
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job = transitionJob(job, JobState.RENDER_FAILED, msg);
      await updateJob(job.id, { state: job.state, error: msg });
      throw err;
    }
  }
}
