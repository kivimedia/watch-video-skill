# Hybrid Rendering: Remotion Master + Revideo Inserts

## Goal
Add Revideo as a selective scene enhancement engine alongside Remotion (the master timeline). Enhanced segments render as standalone video assets that get inserted back into the Remotion composition.

## Approach
1. Add enhancement types to @cutsense/core
2. Add enhancement selection logic to @cutsense/edit
3. Add Revideo rendering pipeline to @cutsense/renderer
4. Update orchestrator to include enhancement step
5. Update dashboard to show enhancement status
6. Graceful fallback: Revideo failure = use standard Remotion segment

## Files to create/modify
- `packages/core/src/types/enhancement.ts` - SceneEnhancementSpec, InsertRenderResult, etc.
- `packages/core/src/index.ts` - Re-export new types
- `packages/edit/src/planner/enhancement-selector.ts` - Decision logic
- `packages/edit/src/orchestrator.ts` - Add enhancement selection step
- `packages/edit/src/index.ts` - Re-export
- `packages/renderer/src/enhancement/spec-generator.ts` - Generate specs from VUD
- `packages/renderer/src/enhancement/revideo-renderer.ts` - Revideo render pipeline
- `packages/renderer/src/enhancement/inserter.ts` - Insert assets into Remotion timeline
- `packages/renderer/src/renderer.ts` - Add enhanced render path
- `packages/renderer/src/index.ts` - Re-export
- `packages/renderer/package.json` - Add @revideo/* deps
- `packages/agent/src/orchestrator.ts` - Add enhancement stage
- `packages/dashboard/src/app/jobs/[id]/page.tsx` - Show enhancement status

## Verification
- Standard edit renders without Revideo (Remotion-only path still works)
- Enhanced segment renders as standalone asset
- Insert placed correctly in Remotion timeline
- Revideo failure falls back to standard segment
