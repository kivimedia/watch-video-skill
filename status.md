# CutSense - Project Status

**Date:** 2026-04-11
**Repo:** https://github.com/kivimedia/watch-video-skill
**Local:** `C:\Users\raviv\CutSense`
**Commits:** 5 (all on master)
**Total source files:** ~90 (83 TypeScript/TSX + 5 Python + 2 prompt templates)

---

## 1. What Was Built

### Architecture

```
Video File
    |
    v
[Layer 1: INGEST]        FFmpeg, WhisperX, PySceneDetect, ImageHash
    |                     Extracts: frames, audio, transcript, scenes, metadata, LUFS
    v
[Layer 2: UNDERSTAND]     Vision LLM + Fusion
    |                     Produces: Video Understanding Document (VUD)
    v
[Layer 3: EDIT]           Editorial LLM + Timeline Builder
    |                     Produces: Remotion timeline.json
    v
[ENHANCE - optional]      Revideo inserts (hybrid rendering)
    |                     Renders premium segments as standalone assets
    v
[RENDER]                  Remotion (React-based headless render)
    |
    v
output.mp4
```

### Package Inventory

| Package | Files | Status | Description |
|---------|-------|--------|-------------|
| `@cutsense/core` | 13 | Done | VUD schema, 14-state job machine, cost tracker, RTL utils, enhancement types |
| `@cutsense/storage` | 4 | Done | Job/artifact persistence to `~/.cutsense/jobs/` |
| `@cutsense/ingest` | 11 TS + 6 Py | Done | FFmpeg, WhisperX, PySceneDetect extractors + Python sidecar |
| `@cutsense/providers` | 5 | Done | Anthropic adapter complete; OpenAI + Gemini present but unverified |
| `@cutsense/understand` | 13 | Done | VUD generation via LLM fusion, entities, topics, energy curve |
| `@cutsense/edit` | 8 | Done | Cut planner, caption engine (standard + jumbo), pacing, enhancement selector |
| `@cutsense/renderer` | 11 | Done | Remotion compositions, headless render, FFmpeg-based enhancement v1 |
| `@cutsense/agent` | 2 | Partial | Linear orchestrator only; no workers/reviewers/repair agents yet |
| `@cutsense/cli` | 5 | Partial | `run` and `status` commands; missing per-stage subcommands |
| `@cutsense/dashboard` | 4 | Partial | Jobs queue + job detail/VUD inspector; costs + policies pages missing |

### Infrastructure

| Item | Status |
|------|--------|
| pnpm workspaces + Turborepo | Done |
| TypeScript strict mode, ESM | Done |
| GitHub repo (public, Apache 2.0) | Done |
| `.env` with Anthropic API key | Done |
| GitHub Actions CI (build + test) | Done (but no tests to run) |
| Claude Code skill (`watch-video`) | Done and registered |
| Project CLAUDE.md | Done |

### Key Data Structures Implemented

- **VUD** (Video Understanding Document): segments, entities, topics, energy curve, key moments, MORE AI extensions
- **CutSenseTimeline**: Remotion inputProps with clips, captions, title cards, enhancement metadata
- **EditDecisionList**: LLM-generated cut decisions with reasons
- **SceneEnhancementSpec**: contract between edit layer and Revideo renderer
- **EnhancementManifest**: per-job enhancement report for dashboard
- **Job state machine**: 14 states with enforced transitions and terminal state detection

---

## 2. Known Bugs

### Critical

**Bug 1 - Renderer bundler entry point resolves to wrong path**
- **File:** `packages/renderer/src/bundler.ts` line 14
- **Issue:** `resolve(__dirname, 'composition', 'src', 'index.ts')` resolves to `dist/composition/src/index.ts` at runtime. Remotion's webpack bundler expects a source `.ts`/`.tsx` entry point, not a pre-compiled `.js` file. This will crash at render time.
- **Fix:** Resolve the entry point relative to the package root source tree, not `dist/`. Use a config option or resolve from `import.meta.url` back to `src/`.

**Bug 2 - `manifest-store.ts` and `job-store.ts` write to the same `manifest.json`**
- **File:** `packages/storage/src/manifest-store.ts` and `packages/storage/src/job-store.ts`
- **Issue:** Both modules read/write `manifest.json` in the job directory. `job-store` writes a `Job` object; `manifest-store` writes a `RunManifest` object. Calling `saveManifest()` will corrupt the job, breaking `getJob()`.
- **Fix:** Rename the run manifest file to `run-manifest.json`.

### High

**Bug 3 - `buildTimeline` never sets `originalSegmentId` on clips**
- **File:** `packages/edit/src/timeline/builder.ts`
- **Issue:** Clips are created without `originalSegmentId`. The enhancement inserter (`packages/renderer/src/enhancement/inserter.ts`) matches clips by `clip.originalSegmentId`. Without this field, enhancement inserts silently no-op.
- **Fix:** Add `originalSegmentId: seg.id` to each clip in the builder.

**Bug 4 - `CostTracker` instantiated but never populated**
- **File:** `packages/agent/src/orchestrator.ts` line 40
- **Issue:** `private costTracker = new CostTracker()` is created but `costTracker.record()` is never called. API costs from providers are returned in `ChatResponse.costUSD` but never accumulated. The cost dashboard will always show $0.
- **Fix:** After each provider call, feed the response into `costTracker.record()`. Pass `maxBudgetUSD` from `JobConfig` to the tracker.

**Bug 5 - Python `pyannote.audio` in requirements.txt is problematic**
- **File:** `packages/ingest/src/sidecar/scripts/requirements.txt`
- **Issue:** `pyannote.audio>=3.1.0` requires accepting HuggingFace gated model terms and installing PyTorch. It will fail for most users on `pip install`. The actual transcription is done by `faster-whisper`, which has its own VAD-based speaker diarization.
- **Fix:** Remove `pyannote.audio` or make it optional. Use `faster-whisper`'s built-in diarization.

### Medium

**Bug 6 - `vud-builder.ts` has a dead ternary for duration**
- **File:** `packages/understand/src/llm/vud-builder.ts` line 120
- **Issue:** `duration: ingestResult.metadata.lufs ? 0 : 0` - both branches return 0. Duration is overwritten later from segments, but if `segments.length === 0`, VUD validation fails with "Invalid duration: 0".
- **Fix:** Set `duration` from `ingestResult.metadata` or calculated from the last segment.

**Bug 7 - Anthropic `premium` and `standard` model tiers are identical**
- **File:** `packages/core/src/types/providers.ts`
- **Issue:** Both `premium` and `standard` tiers for Anthropic map to `claude-sonnet-4-20250514`. The model router cannot distinguish between them.
- **Fix:** Map `premium` to Opus (`claude-opus-4-20250514`) and `standard` to Sonnet.

---

## 3. Missing Features

### No Tests (Zero)

The `tests/` directory structure exists but contains no test files. No vitest config exists anywhere. The `pnpm turbo test` command will find nothing. Priority areas for first tests:

1. **State machine transitions** - Pure logic, easy to test, high value
2. **VUD validator + stage gates** - Ensures quality checks work
3. **Timeline builder** - Frame math, fps conversion
4. **RTL detection** - Hebrew text direction logic
5. **Cost tracker** - Accumulation and budget checking
6. **Segment builder** - Transcript-to-scene merging

### Missing CLI Subcommands

The README shows: `cutsense ingest`, `cutsense understand`, `cutsense edit`, `cutsense render`

Only `cutsense run` (full pipeline) and `cutsense status` are implemented. Users cannot run stages independently.

### Missing Dashboard Pages

- `/costs` - nav link exists, page does not
- `/policies` - nav link exists, page does not
- `/jobs/[id]/vud` - dedicated VUD inspector page (currently inline on job detail)
- `/jobs/[id]/edit` - edit review page
- `/jobs/[id]/qa` - QA center

### Missing Agent Runtime Features

Per the PRD (Section 11), the agent layer should have:
- **Workers** (separate processes per stage) - not implemented, runs inline
- **Reviewers** (VUD reviewer, timeline reviewer) - types exist but not wired
- **Repair agents** (targeted VUD/timeline fixes) - `maxRepairAttempts` is set but no repair loop exists
- **Release gate** (deterministic check before delivery) - not implemented
- **Human review gate** - not implemented

### Missing Documentation

- `docs/adr/` - empty (4 ADRs mentioned in plan: Remotion over Revideo, Python sidecar, VUD as IR, Job state machine)
- `docs/VUD-SPEC.md` - not created
- `docs/TIMELINE-SPEC.md` - not created
- `docs/CONTRIBUTING.md` - not created
- `docs/PROVIDERS.md` - not created

### Other Missing Items

- **FCPXML export** - `JobConfig.outputFormat` includes `'fcpxml'` but no writer exists
- **Local provider** - throws "not yet implemented"
- **Revideo full integration** - current enhancement uses FFmpeg filters; true Revideo generator-based rendering not implemented
- **Run manifest** - `RunManifest` type exists but is never written by the orchestrator
- **Release workflow** - `release.yml` GitHub Action not created
- **Multi-camera support** - deferred per PRD
- **Evaluation framework** - benchmark corpus, eval tracks not started
- **MCP server integration** - not started

---

## 4. Quality Improvement Recommendations

### Priority 1 - Fix Critical Bugs (Do First)

1. **Fix renderer bundler path** - without this, no video can be rendered
2. **Fix manifest file collision** - without this, job state gets corrupted after a full pipeline run
3. **Add `originalSegmentId` to timeline clips** - without this, hybrid rendering enhancement is dead code

### Priority 2 - Wire Cost Tracking

The cost governance system (PRD Section 14) is architecturally complete but not connected:
- Feed `ChatResponse.costUSD` into `CostTracker.record()` after every LLM call
- Pass `JobConfig.maxBudgetUSD` to `CostTracker` constructor
- Check `costTracker.isOverBudget` before each LLM call
- Write `costTracker.toManifest()` to the run manifest at job completion
- This turns cost tracking from decorative to functional

### Priority 3 - Add Foundational Tests

Create a vitest workspace config and write tests for:
- State machine (all valid/invalid transitions)
- VUD validator (pass/fail cases)
- Timeline builder (frame math)
- RTL utilities (Hebrew detection)
- Cost tracker (accumulation, budget limits)

Estimated: ~200 lines of tests, high confidence gain.

### Priority 4 - Fix Python Sidecar Reliability

- Remove `pyannote.audio` from requirements (or make optional with `--diarize` flag)
- Test `setup_venv.py` on clean Windows machine
- Handle Windows Store Python stub (check `python --version` actually works)
- Add `--cpu-only` flag to `transcribe.py` for machines without CUDA
- Add model size selection to CLI (`--whisper-model base|small|medium|large-v2`)

### Priority 5 - Complete CLI Subcommands

Add `ingest`, `understand`, `edit`, `render` as standalone commands. This makes debugging much easier - users can run one stage, inspect the output, then run the next.

### Priority 6 - Add Repair Loops

The orchestrator should:
1. After VUD generation: run `checkVUDGate()` 
2. If gate fails: attempt one repair pass (re-run just the failing validation)
3. If repair fails: escalate to human or fail gracefully
4. Same for timeline: run `checkEditGate()` after edit, repair if needed

### Priority 7 - Improve LLM Prompt Quality

The current prompts work but could be significantly improved:
- **VUD system prompt**: Add few-shot examples of ideal VUD JSON output
- **Cut planner prompt**: Add examples of good cut decisions with reasoning
- **Entity extractor**: Add disambiguation rules for similar entities
- **Visual analyzer**: Add scene type calibration examples
- Better error recovery: retry on malformed JSON with a "fix this JSON" follow-up prompt

### Priority 8 - Dashboard Feature Completion

- Add `/costs` page reading from `CostTracker.toManifest()`
- Add `/policies` page for model routing configuration
- Add real-time job progress (polling or SSE)
- Add Remotion Player embed for video preview
- Add caption editing interface

---

## 5. File Count Summary

```
packages/core/src/          13 files (types, state machine, utils)
packages/storage/src/        4 files (job store, artifact store, manifest)
packages/ingest/src/        11 files (extractors, sidecar, orchestrator)
packages/ingest/src/sidecar/scripts/  6 files (5 Python + requirements.txt)
packages/providers/src/      5 files (base + 3 providers + factory)
packages/understand/src/    13 files (fusion, LLM, validators, prompts)
packages/edit/src/           8 files (planners, timeline, validators)
packages/renderer/src/      11 files (compositions, bundler, enhancement)
packages/agent/src/          2 files (orchestrator + barrel)
packages/cli/src/            5 files (commands, progress, entry)
packages/dashboard/src/      4 files (layout, pages)
                           ---
Total:                     ~90 source files
Tests:                       0 files
Docs:                        0 files (README and CLAUDE.md exist)
```

---

## 6. PRD Section Coverage

| PRD Section | Covered? | Notes |
|-------------|----------|-------|
| 1. Executive Summary | N/A | Context only |
| 2. Landscape & Prior Art | N/A | Context only |
| 3. Architecture (3 layers) | Yes | Fully implemented |
| 4. AI Provider Strategy | Mostly | Multi-provider adapters done; model routing done; native video input not done |
| 5. VUD Specification | Yes | Full schema with all fields |
| 6. User Interaction Model | Partial | CLI done but missing per-stage commands; conversational editing not started |
| 7. Technical Stack | Yes | All deps wired |
| 8. Video-to-LLM (what CutSense adds) | Yes | Entity tracking, VUD schema, edit-to-code bridge all done |
| 9. Development Phases | Phase 1 mostly done | Phase 2-4 partially started |
| 10. Success Metrics | No | No benchmarks, no eval framework |
| 11. Agent Runtime | Partial | Linear orchestrator only; no workers/reviewers/repair |
| 12. Stage Gates | Partial | Gate functions exist but repair loops not wired |
| 13. Evaluation Plan | No | No benchmark corpus, no eval tracks |
| 14. Cost Governance | Partial | Types and tracker exist but not wired to actual API calls |
| 15. Production Operations | Partial | Job state machine + checkpointing done; queue/concurrency not done |
| 16. Human Review Policy | No | Types exist but no review flow implemented |
| 17. Operator Dashboard | Partial | Job list + detail done; 5 pages missing |
| 18. Observability & Security | Partial | Event types defined; logging not structured; audit trail not implemented |
| 19. Implementation Contracts | Mostly | Thresholds table done; state machine done; manifest schema done; dashboard contracts partial |
| 20. MVP Scope | On track | v1 scope focused correctly on single orchestrator + Remotion + standard captions |
| Hybrid Rendering Addendum | Done | Remotion master + FFmpeg enhancement v1; full Revideo pending |
