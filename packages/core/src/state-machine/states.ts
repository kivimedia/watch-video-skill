/**
 * Job state machine - valid transitions between the 14 states.
 *
 * No other transitions are valid. The dashboard and orchestrator
 * must reject illegal transitions.
 */

import { JobState } from '../types/job.js';

export const VALID_TRANSITIONS: ReadonlyMap<JobState, ReadonlySet<JobState>> = new Map([
  [JobState.CREATED, new Set([JobState.INGESTING, JobState.CANCELLED])],
  [JobState.INGESTING, new Set([JobState.INGEST_DONE, JobState.INGEST_FAILED, JobState.CANCELLED])],
  [
    JobState.INGEST_DONE,
    new Set([JobState.UNDERSTANDING, JobState.CANCELLED]),
  ],
  [JobState.INGEST_FAILED, new Set()],
  [
    JobState.UNDERSTANDING,
    new Set([JobState.UNDERSTAND_DONE, JobState.UNDERSTAND_FAILED, JobState.CANCELLED]),
  ],
  [
    JobState.UNDERSTAND_DONE,
    new Set([JobState.EDITING, JobState.CANCELLED]),
  ],
  [JobState.UNDERSTAND_FAILED, new Set()],
  [
    JobState.EDITING,
    new Set([JobState.EDIT_DONE, JobState.EDIT_FAILED, JobState.CANCELLED]),
  ],
  [JobState.EDIT_DONE, new Set([JobState.RENDERING, JobState.CANCELLED])],
  [JobState.EDIT_FAILED, new Set()],
  [
    JobState.RENDERING,
    new Set([JobState.RENDER_DONE, JobState.RENDER_FAILED, JobState.CANCELLED]),
  ],
  [JobState.RENDER_DONE, new Set()],
  [JobState.RENDER_FAILED, new Set()],
  [JobState.CANCELLED, new Set()],
]);

export function isTerminalState(state: JobState): boolean {
  return !VALID_TRANSITIONS.get(state)?.size;
}

export function getNextStates(state: JobState): JobState[] {
  return [...(VALID_TRANSITIONS.get(state) ?? [])];
}
