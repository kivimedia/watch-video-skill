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
import { saveJSON, loadJSON, getArtifactPath } from '@cutsense/storage';
import type { IngestResult, IngestOptions } from '@cutsense/core';
import { IngestOrchestrator } from '@cutsense/ingest';
import { understand } from '@cutsense/understand';
import { edit } from '@cutsense/edit';
import { render } from '@cutsense/renderer';

export interface PipelineOptions {
  provider: AIProvider;
  ingestOptions?: IngestOptions;
  moreAI?: boolean;
  userInstruction?: string;
  targetDuration?: number;
  captionStyle?: 'none' | 'standard' | 'jumbo' | 'jumbo-then-standard';
  maxRepairAttempts?: number;
  onProgress?: (stage: string, step: string, detail?: string) => void;
}

export class JobOrchestrator {
  private costTracker = new CostTracker();
  private maxRepairAttempts: number;

  constructor(private options: PipelineOptions) {
    this.maxRepairAttempts = options.maxRepairAttempts ?? 1;
  }

  async run(jobId: string): Promise<Job> {
    let job = await getJob(jobId);
    const progress = this.options.onProgress ?? (() => {});

    try {
      // Ingest
      if (job.state === JobState.CREATED || job.state === JobState.INGEST_FAILED) {
        job = await this.runIngest(job, progress);
      }

      // Understand
      if (job.state === JobState.INGEST_DONE) {
        job = await this.runUnderstand(job, progress);
      }

      // Edit
      if (job.state === JobState.UNDERSTAND_DONE && this.options.userInstruction) {
        job = await this.runEdit(job, progress);
      }

      // Render
      if (job.state === JobState.EDIT_DONE) {
        job = await this.runRender(job, progress);
      }

      return job;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress('error', 'pipeline', errorMsg);
      return job;
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

      const vud = await understand(ingestResult, this.options.provider, {
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

      const timeline = await edit(vud, this.options.userInstruction!, this.options.provider, {
        targetDuration: this.options.targetDuration,
        captionStyle: this.options.captionStyle,
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

  private async runRender(
    job: Job,
    progress: PipelineOptions['onProgress'] & Function,
  ): Promise<Job> {
    job = transitionJob(job, JobState.RENDERING);
    await updateJob(job.id, { state: job.state });
    progress('render', 'starting', 'Rendering video with Remotion');

    try {
      const timeline = await loadJSON<CutSenseTimeline>(job.id, 'edit', 'timeline.json');
      const outputPath = getArtifactPath(job.id, 'output', 'output.mp4');

      await render(timeline, outputPath, {
        onProgress: ({ percent }) => {
          progress('render', 'progress', `Rendering: ${percent}%`);
        },
        onBundleProgress: (p) => {
          progress('render', 'bundling', `Bundling compositions: ${(p * 100).toFixed(0)}%`);
        },
      });

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
