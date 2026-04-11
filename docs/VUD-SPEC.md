# Video Understanding Document (VUD) Specification

Version: 1.0

## Overview

The VUD is a structured JSON document that fully describes a video's content in a form an LLM can reason over. It fuses transcript, visual analysis, entity tracking, topic modeling, and energy scoring into a single machine-readable timeline.

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | `"1.0"` | Yes | Schema version |
| jobId | string | Yes | CutSense job ID |
| sourceFile | string | Yes | Path to source video |
| duration | number | Yes | Video duration in seconds |
| language | string | Yes | BCP-47 language code |
| isRTL | boolean | Yes | Whether primary language is RTL |
| metadata | VideoMetadata | Yes | Technical video metadata |
| segments | VUDSegment[] | Yes | Ordered timeline segments |
| entities | Entity[] | Yes | Tracked entities across video |
| topics | Topic[] | Yes | Topic clusters |
| energyCurve | EnergyPoint[] | Yes | Per-segment energy scores |
| summary | string | Yes | 2-3 sentence description |
| keyMoments | KeyMoment[] | Yes | Highlights for editor |
| moreAI | MoreAIAnalysis | No | Enhanced analysis (MORE AI mode) |

## Segment Schema

Each segment represents a continuous portion of the video:

| Field | Type | Description |
|-------|------|-------------|
| id | string | `seg_000`, `seg_001`, etc. |
| startTime | number | Start in seconds |
| endTime | number | End in seconds |
| duration | number | endTime - startTime |
| transcript | string | Spoken words |
| words | TranscriptWord[] | Word-level timestamps |
| speaker | string? | Speaker label from diarization |
| sceneId | string? | Links to PySceneDetect scene |
| visualDescription | string? | From vision LLM analysis |
| sceneType | enum? | interview, b-roll, action, title, transition, screenrec, other |
| visualInterest | 1-5? | Visual interest rating |
| textOnScreen | string? | Visible text/graphics |
| cameraMotion | string? | Camera behavior |
| topics | string[] | Topic IDs |
| entities | string[] | Entity IDs |
| energy | 0-1 | Engagement score |
| isSilent | boolean | No speech detected |
| isBlurry | boolean | Low visual quality |
| isDuplicate | boolean | Nearly identical to adjacent |

## Entity Schema

| Field | Type | Description |
|-------|------|-------------|
| id | string | `entity_<slug>` |
| name | string | Display name |
| type | enum | person, place, product, organization, concept |
| role | string? | Role if known |
| mentions | number[] | Segment indices |
| totalScreenTime | number | Seconds across all segments |

## Energy Scoring

Energy is a 0-1 float per segment:
- 0.0 = dead silence/static
- 0.5 = normal conversation
- 1.0 = peak action/engagement

Drivers: speech_rate, audio_level, visual_motion, silence, mixed

## Validation Rules

A VUD passes the gate check (releasable to editing) when:
- All segments have monotonic, non-overlapping timestamps
- Transcript coverage exceeds 98% of duration
- Scene coverage exceeds 90% of duration
- Required metadata (fps, width, height) is present
- Entity extraction completed (for videos > 5 segments)

## Type Definition

See `packages/core/src/types/vud.ts` for the full TypeScript interface.
