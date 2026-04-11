import { describe, it, expect } from 'vitest';
import {
  JobState,
  VALID_TRANSITIONS,
  isTerminalState,
  getNextStates,
  transitionJob,
  InvalidTransitionError,
  type Job,
} from '@cutsense/core';

function makeJob(state: JobState): Job {
  return {
    id: 'test_001',
    state,
    sourcePath: '/tmp/test.mp4',
    sourceFileName: 'test.mp4',
    jobDir: '/tmp/jobs/test_001',
    config: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('Job State Machine', () => {
  describe('VALID_TRANSITIONS', () => {
    it('should have entries for all 14 states', () => {
      const allStates = Object.values(JobState);
      expect(allStates.length).toBe(14);
      for (const state of allStates) {
        expect(VALID_TRANSITIONS.has(state)).toBe(true);
      }
    });

    it('should allow CREATED -> INGESTING', () => {
      expect(VALID_TRANSITIONS.get(JobState.CREATED)?.has(JobState.INGESTING)).toBe(true);
    });

    it('should allow any non-terminal state -> CANCELLED', () => {
      const nonTerminal = [
        JobState.CREATED, JobState.INGESTING, JobState.INGEST_DONE,
        JobState.UNDERSTANDING, JobState.UNDERSTAND_DONE,
        JobState.EDITING, JobState.EDIT_DONE,
        JobState.RENDERING,
      ];
      for (const state of nonTerminal) {
        expect(VALID_TRANSITIONS.get(state)?.has(JobState.CANCELLED)).toBe(true);
      }
    });

    it('should not allow transitions from terminal states', () => {
      const terminal = [
        JobState.RENDER_DONE, JobState.INGEST_FAILED,
        JobState.UNDERSTAND_FAILED, JobState.EDIT_FAILED,
        JobState.RENDER_FAILED, JobState.CANCELLED,
      ];
      for (const state of terminal) {
        expect(VALID_TRANSITIONS.get(state)?.size).toBe(0);
      }
    });
  });

  describe('isTerminalState', () => {
    it('should return true for terminal states', () => {
      expect(isTerminalState(JobState.RENDER_DONE)).toBe(true);
      expect(isTerminalState(JobState.CANCELLED)).toBe(true);
      expect(isTerminalState(JobState.INGEST_FAILED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isTerminalState(JobState.CREATED)).toBe(false);
      expect(isTerminalState(JobState.INGESTING)).toBe(false);
      expect(isTerminalState(JobState.EDIT_DONE)).toBe(false);
    });
  });

  describe('getNextStates', () => {
    it('should return valid next states', () => {
      const next = getNextStates(JobState.INGESTING);
      expect(next).toContain(JobState.INGEST_DONE);
      expect(next).toContain(JobState.INGEST_FAILED);
      expect(next).toContain(JobState.CANCELLED);
    });

    it('should return empty array for terminal states', () => {
      expect(getNextStates(JobState.RENDER_DONE)).toHaveLength(0);
    });
  });

  describe('transitionJob', () => {
    it('should transition from CREATED to INGESTING', () => {
      const job = makeJob(JobState.CREATED);
      const updated = transitionJob(job, JobState.INGESTING);
      expect(updated.state).toBe(JobState.INGESTING);
      expect(updated.updatedAt).not.toBe(job.updatedAt);
    });

    it('should set error on failure transitions', () => {
      const job = makeJob(JobState.INGESTING);
      const updated = transitionJob(job, JobState.INGEST_FAILED, 'FFmpeg crashed');
      expect(updated.state).toBe(JobState.INGEST_FAILED);
      expect(updated.error).toBe('FFmpeg crashed');
    });

    it('should throw InvalidTransitionError on illegal transition', () => {
      const job = makeJob(JobState.CREATED);
      expect(() => transitionJob(job, JobState.EDITING)).toThrow(InvalidTransitionError);
    });

    it('should throw when transitioning from terminal state', () => {
      const job = makeJob(JobState.RENDER_DONE);
      expect(() => transitionJob(job, JobState.RENDERING)).toThrow(InvalidTransitionError);
    });

    it('should walk the full happy path', () => {
      let job = makeJob(JobState.CREATED);
      job = transitionJob(job, JobState.INGESTING);
      job = transitionJob(job, JobState.INGEST_DONE);
      job = transitionJob(job, JobState.UNDERSTANDING);
      job = transitionJob(job, JobState.UNDERSTAND_DONE);
      job = transitionJob(job, JobState.EDITING);
      job = transitionJob(job, JobState.EDIT_DONE);
      job = transitionJob(job, JobState.RENDERING);
      job = transitionJob(job, JobState.RENDER_DONE);
      expect(job.state).toBe(JobState.RENDER_DONE);
    });
  });
});
