# CutSense

**AI Video Understanding & Programmatic Editing Engine**

CutSense gives AI systems genuine understanding of video content, then uses that understanding to drive programmatic video editing. Unlike tools that work from transcripts alone, CutSense fuses audio transcription, visual scene analysis, and editorial intelligence into a structured **Video Understanding Document (VUD)** - the source of truth for all editing decisions.

The editing layer outputs compositions compatible with [Remotion](https://remotion.dev) (React-based video framework), producing edits expressed as code - fully version-controllable, parameterizable, and renderable in CI/CD pipelines.

## How It Works

```
Video File -> [Ingest] -> [Understand] -> [Edit] -> [Render] -> output.mp4
                |              |              |           |
           FFmpeg/WhisperX  Vision LLM    Editorial   Remotion
           PySceneDetect    + Fusion       LLM        headless
```

**Layer 1 - Ingest**: Extracts frames, audio, transcript (word-level), scenes, metadata, and loudness from any video file.

**Layer 2 - Understand**: Synthesizes raw signals into a VUD - a structured JSON timeline with visual descriptions, entity tracking, topic modeling, and energy scoring.

**Layer 3 - Edit**: Takes the VUD plus natural language instructions and produces a Remotion timeline with cuts, transitions, and captions.

**Render**: Remotion renders the timeline to MP4 via headless Chromium.

## Quick Start

```bash
# Install
npm install -g @cutsense/cli

# Full pipeline: understand and edit a video
cutsense run interview.mp4 --prompt "Cut to 2 minutes, keep the best moments"

# Step by step
cutsense ingest interview.mp4
cutsense understand job_20260410_abc --provider anthropic
cutsense edit job_20260410_abc --prompt "Highlight reel, add jumbo captions"
cutsense render job_20260410_abc --output highlight.mp4
```

## Features

- **Multi-modal understanding** - Fuses transcript, visual analysis, and audio signals
- **Entity tracking** - Identifies and tracks people, products, locations across the timeline
- **Visual interest scoring** - Rates segments 1-5 based on composition, action, uniqueness
- **Caption engine** - Standard subtitles and TikTok-style jumbo word-by-word captions
- **Hebrew & RTL** - Full bidirectional text support for Hebrew, Arabic, and mixed content
- **Multi-provider AI** - Works with Claude, GPT-4o, Gemini, or local models
- **MORE AI mode** - Enhanced understanding at higher cost (emotion tracking, pacing analysis, B-roll suggestions)
- **Cost governance** - Built-in model routing, budget tracking, and cost-per-minute reporting
- **Agent runtime** - Orchestrator with workers, reviewers, repair agents, and stage gates
- **Operator dashboard** - Next.js UI for job management, VUD inspection, and cost monitoring

## Requirements

- Node.js >= 20
- Python >= 3.10 (auto-configured on first run)
- FFmpeg (must be on PATH)
- At least one AI provider API key (Anthropic, OpenAI, or Google)

## Architecture

CutSense is a pnpm monorepo with 10 packages:

| Package | Description |
|---------|-------------|
| `@cutsense/core` | Types, state machine, schemas, cost tracking, RTL utils |
| `@cutsense/storage` | Job and artifact persistence |
| `@cutsense/ingest` | Layer 1: FFmpeg, WhisperX, PySceneDetect extractors |
| `@cutsense/providers` | Multi-provider AI adapters |
| `@cutsense/understand` | Layer 2: VUD generation via LLM fusion |
| `@cutsense/edit` | Layer 3: Editorial intelligence and timeline builder |
| `@cutsense/renderer` | Remotion composition and headless rendering |
| `@cutsense/agent` | Orchestrator, workers, reviewers, repair agents |
| `@cutsense/cli` | Commander.js CLI |
| `@cutsense/dashboard` | Next.js operator dashboard |

## The Video Understanding Document (VUD)

The VUD is the core abstraction - a structured JSON timeline that an LLM can reason over:

```json
{
  "version": "1.0",
  "segments": [
    {
      "startTime": 14.2,
      "endTime": 18.7,
      "transcript": "...and that is when we decided to pivot",
      "visualDescription": "Speaker leans forward, holding prototype",
      "energy": 0.9,
      "topics": ["product-pivot"],
      "entities": ["speaker_1", "prototype"]
    }
  ],
  "entities": [
    { "name": "Danny", "type": "person", "role": "CEO", "totalScreenTime": 142.5 }
  ]
}
```

## Running the Dashboard

```bash
cd packages/dashboard
npx next dev --port 3847
```

Opens at `http://localhost:3847` with pages for Jobs, Costs, and Policies.

**Important: local storage only.** The dashboard reads job data directly from `~/.cutsense/jobs/` on the local filesystem. It shows only jobs created on the machine it runs on. There is no database or API layer in v1.

To deploy to Vercel or any cloud host, you would need to add one of:
- A REST API that reads from a shared database (Supabase, Postgres, etc.)
- A file sync layer (S3, GCS) that mirrors the jobs directory
- A WebSocket bridge to a machine running the CLI

This is by design for v1 - CutSense is a CLI-first tool. The dashboard is an operator companion, not a standalone SaaS.

## License

Apache 2.0 - See [LICENSE](LICENSE)

## Author

Ziv Raviv / [Kivi Media](https://kivimedia.co)
