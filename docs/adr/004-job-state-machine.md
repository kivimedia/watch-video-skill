# ADR-004: Deterministic Job State Machine

## Status
Accepted

## Context
Video processing pipelines have many failure modes. Without explicit state tracking, it's impossible to know where a job failed, whether it can be resumed, or what artifacts are valid.

## Decision
Every job follows a 14-state machine with enforced transitions. The orchestrator, dashboard, and audit trail all use this state machine as the source of truth.

## States
CREATED -> INGESTING -> INGEST_DONE -> UNDERSTANDING -> UNDERSTAND_DONE -> EDITING -> EDIT_DONE -> RENDERING -> RENDER_DONE
Plus: INGEST_FAILED, UNDERSTAND_FAILED, EDIT_FAILED, RENDER_FAILED, CANCELLED

## Rationale
- Enables resume-from-checkpoint behavior
- Dashboard can show exactly where each job is
- Illegal transitions are rejected at the type level
- Failure states are explicit, not implicit

## Consequences
- Every state transition must go through `transitionJob()`
- Terminal states cannot be exited
- Job manifest records every state transition with timestamp
