# CutSense - Claude Context

## Project
- **GitHub**: kivimedia/watch-video-skill
- **Local**: C:\Users\raviv\CutSense
- **License**: Apache 2.0
- **Stack**: Node.js 24 + Python 3.12 + Remotion v4 + pnpm workspaces + Turborepo

## Architecture
Three layers: Ingest -> Understand (VUD) -> Edit (Remotion timeline) -> Render

```
packages/
  core/       - Types, state machine, cost tracker, RTL utils
  storage/    - Job/artifact persistence to ~/.cutsense/jobs/
  ingest/     - FFmpeg, WhisperX, PySceneDetect extractors + Python sidecar
  providers/  - Anthropic, OpenAI, Gemini adapters
  understand/ - VUD generation via LLM fusion
  edit/       - Editorial intelligence + timeline builder
  renderer/   - Remotion compositions + headless rendering
  agent/      - Job orchestrator driving the state machine
  cli/        - Commander.js CLI (cutsense run/status)
  dashboard/  - Next.js operator UI (WIP)
```

## Key Data Structures
- **VUD** (Video Understanding Document): `packages/core/src/types/vud.ts`
- **CutSenseTimeline** (Remotion inputProps): `packages/core/src/types/timeline.ts`
- **Job State Machine** (14 states): `packages/core/src/state-machine/`

## Jobs directory
`~/.cutsense/jobs/` - each job has manifest.json + artifacts subdirs

## Python sidecar
- Venv auto-created at: `packages/ingest/src/sidecar/scripts/.venv/`
- Windows: invoke `.venv/Scripts/python.exe` directly (never activate)
- Requirements: faster-whisper, scenedetect, Pillow, imagehash

## Conventions
- All timestamps in seconds (float), never frames (except Remotion types)
- `isRTL`: auto-detected from transcript language
- Energy: 0-1 float, higher = more engaging
- Model routing: never use Opus for tasks Sonnet can handle
- No emdashes anywhere. Use single dash.
- Space after colons in prose

## Build & Test
```bash
pnpm install
pnpm turbo build
pnpm turbo test
```

## Windows Gotchas
- Python venv: `Scripts/` not `bin/`
- Path sep: forward slashes when passing to Python/FFmpeg
- FFmpeg spawn: `windowsHide: true`
- Remotion `--props`: always use file path, never inline JSON on Windows
