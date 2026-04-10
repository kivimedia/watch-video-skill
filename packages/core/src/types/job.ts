/**
 * Job state machine and run manifest types.
 *
 * Every CutSense job follows a deterministic state machine with 14 states.
 * The RunManifest records everything that happened during a job's lifecycle.
 */

export enum JobState {
  CREATED = 'created',
  INGESTING = 'ingesting',
  INGEST_DONE = 'ingest_done',
  INGEST_FAILED = 'ingest_failed',
  UNDERSTANDING = 'understanding',
  UNDERSTAND_DONE = 'understand_done',
  UNDERSTAND_FAILED = 'understand_failed',
  EDITING = 'editing',
  EDIT_DONE = 'edit_done',
  EDIT_FAILED = 'edit_failed',
  RENDERING = 'rendering',
  RENDER_DONE = 'render_done',
  RENDER_FAILED = 'render_failed',
  CANCELLED = 'cancelled',
}

export const TERMINAL_STATES: ReadonlySet<JobState> = new Set([
  JobState.RENDER_DONE,
  JobState.INGEST_FAILED,
  JobState.UNDERSTAND_FAILED,
  JobState.EDIT_FAILED,
  JobState.RENDER_FAILED,
  JobState.CANCELLED,
]);

export interface JobConfig {
  language?: string;
  provider?: string;
  model?: string;
  moreAI?: boolean;
  targetDuration?: number;
  captionStyle?: 'none' | 'standard' | 'jumbo' | 'jumbo-then-standard';
  transitions?: 'cut' | 'fade' | 'mixed';
  musicHandling?: 'keep' | 'duck' | 'strip';
  outputFormat?: 'remotion' | 'both' | 'fcpxml';
  visualPriority?: 'text-driven' | 'visual-driven' | 'balanced';
  userInstruction?: string;
  fps?: number;
  framesPerSecond?: number;
  maxBudgetUSD?: number;
}

export interface Job {
  id: string;
  state: JobState;
  sourcePath: string;
  sourceFileName: string;
  jobDir: string;
  config: JobConfig;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface RunManifest {
  job: Job;
  policyVersion: string;
  source: {
    filename: string;
    durationSec: number;
    hash?: string;
  };
  brief: JobConfig;
  artifacts: ArtifactManifest;
  scores: ScoreManifest;
  costs: CostManifest;
  runtime: RuntimeManifest;
  releaseDecision: ReleaseDecision;
  events: JobEvent[];
}

export interface ArtifactManifest {
  transcript?: string;
  contactSheets?: string[];
  frames?: string[];
  audio?: string;
  vud?: string;
  entityIndex?: string;
  edl?: string;
  composition?: string;
  captions?: string;
  reviewReports?: string[];
  renderLog?: string;
  deliveryBundle?: string;
}

export interface ScoreManifest {
  understandingReview?: number;
  editingReview?: number;
  instructionAdherence?: number;
  renderValidation?: 'pass' | 'fail' | 'pending';
}

export interface CostManifest {
  currency: 'USD';
  total: number;
  byStage: Record<string, number>;
  byProvider: Record<string, number>;
}

export interface RuntimeManifest {
  repairLoops: Record<string, number>;
  retries: Record<string, number>;
  humanActions: HumanAction[];
}

export interface HumanAction {
  type: 'approve' | 'reject' | 'repair_request' | 'override' | 'note';
  stage: string;
  timestamp: string;
  comment?: string;
}

export interface ReleaseDecision {
  status: 'released' | 'held' | 'blocked';
  reason: string;
  overrides: string[];
}

export type JobEventType =
  | 'job.created'
  | 'stage.started'
  | 'stage.completed'
  | 'stage.failed'
  | 'review.passed'
  | 'review.failed'
  | 'repair.requested'
  | 'repair.completed'
  | 'human.review_requested'
  | 'human.approved'
  | 'human.rejected'
  | 'budget.warning'
  | 'budget.blocked'
  | 'render.started'
  | 'render.completed'
  | 'delivery.completed'
  | 'job.cancelled';

export interface JobEvent {
  type: JobEventType;
  timestamp: string;
  stage?: string;
  detail?: string;
}
