/**
 * State transition engine - enforces the job state machine.
 */

import { type Job, JobState, type JobEvent, type JobEventType } from '../types/job.js';
import { VALID_TRANSITIONS } from './states.js';

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: JobState,
    public readonly to: JobState,
  ) {
    super(`Invalid transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function transitionJob(job: Job, targetState: JobState, detail?: string): Job {
  const allowed = VALID_TRANSITIONS.get(job.state);
  if (!allowed?.has(targetState)) {
    throw new InvalidTransitionError(job.state, targetState);
  }

  return {
    ...job,
    state: targetState,
    updatedAt: new Date().toISOString(),
    error: targetState.endsWith('_failed') ? detail : job.error,
  };
}

export function createJobEvent(
  type: JobEventType,
  stage?: string,
  detail?: string,
): JobEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    stage,
    detail,
  };
}

export function getStateEventType(state: JobState): JobEventType {
  if (state === JobState.CANCELLED) return 'job.cancelled';
  if (state.endsWith('_failed')) return 'stage.failed';
  if (state.endsWith('_done') || state === JobState.RENDER_DONE) return 'stage.completed';
  return 'stage.started';
}
