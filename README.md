# Watch Video Skill (CutSense)
TL;DR is a collection of agents that knows how to watch videos, by analyzing key images at a dynamic rate and the transcription of the video. It creates a unified understsanding of the combination of the sound and visuals and can edit your video based on instructions."

Here are the deets: 
**The AI that actually watches your video, then edits it.**

Most video editing tools work from transcripts. CutSense watches every frame, listens to every word, and builds a deep understanding of what's happening in your video. Then it uses that understanding to make real editorial decisions.

Tell it "keep only the parts where the singer appears" and it knows which segments show the singer, which show the MC reading, and which are empty stage shots. It removes what doesn't belong and renders a clean, lossless output.
Other examples:
"Keep only the shots where I look confident and speak coherently without anyone walking behind me." - it will not just do that based on your transcript but also based on the visuals
"I want to add more pazzaz to this video. Add cool animations and text captions that makes this feel fun. 50s quick pace edit please."

## A case study detaield 

A 21-minute ceremony video. Multiple speakers, a young pianist/singer, readings, candle lighting. One prompt:

> "Keep only the parts where the young woman with the white shirt appears. She plays keyboard and sings."

CutSense:
- Extracted 1,295 frames and transcribed 21 minutes of Hebrew speech
- Used adaptive sampling to focus on moments with activity (322 frames kept from 1,295)
- Analyzed every scene with vision AI, describing who is visible, what they're wearing, what they're doing
- The edit planner matched the visual descriptions against the prompt and removed 80+ segments
- FFmpeg rendered the final cut in 13 seconds with zero quality loss

**Result: 5 minutes of just the singer. Original quality. $0.54 in API costs.**

## How It Works

```
Video File
    |
    v
[INGEST]           FFmpeg frames + WhisperX transcript + PySceneDetect
    |
    v
[ADAPTIVE SAMPLE]  Speech-aware frame density + visual change detection
    |
    v
[UNDERSTAND]       Vision LLM builds a Video Understanding Document (VUD)
    |
    v
[EDIT]             LLM cut-planner with visual descriptions + natural language prompt
    |
    v
[RENDER]           FFmpeg lossless stream copy (cuts-only) or Remotion (effects/captions)
    |
    v
output.mp4
```

## What CutSense Does Well

**Person filtering** - "Keep only the CEO talking." CutSense describes each person's appearance (age, hair, clothing, activity) per scene, then the edit planner matches against your description. Not face recognition - visual understanding.

**Adaptive frame sampling** - Static scenes (someone sitting at a piano for 3 minutes) don't need a frame every second. Speech moments do. CutSense uses WhisperX timestamps to sample densely during speech and sparsely during silence, then refines with pHash visual change detection. The result: 2.5x more useful frames without re-extracting from the video.

**Lossless rendering** - For cuts-only edits (no captions, no fades), CutSense auto-selects FFmpeg stream copy instead of re-encoding through Remotion. Your output is pixel-identical to the source. A 5-minute edit renders in 13 seconds, not 20 minutes.

**Hebrew and RTL** - Full bidirectional text support. Hebrew transcription via WhisperX, RTL captions, right-to-left layout detection. Built for real-world multilingual content.

**Multi-provider AI** - Works with Claude, GPT-4o, Gemini. Built-in cost tracking and model routing so you don't burn through API credits.

**Cost governance** - Every pipeline run reports exact token usage and cost. The ceremony video edit cost $0.54 total across ingest, understand, and edit stages.

## Quick Start

```bash
# Clone and install
git clone https://github.com/kivimedia/watch-video-skill.git
cd watch-video-skill
pnpm install
pnpm turbo build

# Run the full pipeline
node packages/cli/bin/cutsense.js run video.mp4 \
  --prompt "Cut to 2 minutes, keep the highlights" \
  --captions none

# Check job status
node packages/cli/bin/cutsense.js status

# Clean up old jobs (frees disk space)
node packages/cli/bin/cutsense.js clean --dry-run
node packages/cli/bin/cutsense.js clean --all
```

### Clean Command Options

```bash
cutsense clean                    # Remove all completed/failed jobs
cutsense clean --dry-run          # Preview what would be deleted
cutsense clean --keep-latest 3    # Keep 3 most recent jobs
cutsense clean --failed-only      # Only remove failed jobs
cutsense clean job_20260414_ABC   # Remove a specific job
```

## The Rendering Stack: Remotion + Revideo + FFmpeg

CutSense has three rendering engines and picks the right one for each job:

**FFmpeg (the fast lane)** - For cuts-only edits with no effects, CutSense uses FFmpeg stream copy. No re-encoding, no quality loss, renders in seconds. This is the default when you're just cutting and rearranging clips. Think of it as the assembly editor - fast, precise, lossless.

**[Remotion](https://remotion.dev) (the editor)** - When the edit needs captions, transitions, fades, or overlays, CutSense compiles a React composition and renders it through Remotion's headless Chromium pipeline. Remotion treats video as code - every frame is a React component, every transition is a function. This gives CutSense programmatic control over the output that traditional NLEs can't match. Captions, title cards, picture-in-picture - all expressed as typed, version-controllable compositions.

**[Revideo](https://re.video) (the motion designer)** - For premium segments that need motion graphics, animated text, or cinematic visual effects, CutSense hands off to Revideo. While Remotion handles the editorial timeline, Revideo handles individual scene enhancement - think of it as the After Effects artist sitting next to the Premiere Pro editor. The hybrid rendering pipeline stitches Revideo-enhanced segments back into the Remotion timeline seamlessly.

The pipeline auto-selects: simple cuts get FFmpeg, edits with captions get Remotion, premium segments with effects get Revideo. One prompt, three engines, zero manual switching.

## Architecture

CutSense is a pnpm monorepo with 10 packages:

| Package | What it does |
|---------|-------------|
| `@cutsense/core` | Types, state machine, cost tracking, RTL utils |
| `@cutsense/storage` | Job and artifact persistence to `~/.cutsense/jobs/` |
| `@cutsense/ingest` | FFmpeg frame extraction, WhisperX transcription, PySceneDetect |
| `@cutsense/providers` | Anthropic, OpenAI, Gemini adapters with cost tracking |
| `@cutsense/understand` | Adaptive sampling, vision analysis, VUD generation |
| `@cutsense/edit` | LLM cut-planner, caption engine, timeline builder |
| `@cutsense/renderer` | FFmpeg lossless render + Remotion compositions for effects |
| `@cutsense/agent` | Pipeline orchestrator with stage gates and repair loops |
| `@cutsense/cli` | Commander.js CLI with run, status, and clean commands |
| `@cutsense/dashboard` | Next.js operator UI for job management and VUD inspection |

## The Video Understanding Document (VUD)

The VUD is the core abstraction. It's a structured JSON timeline that describes every segment of your video with enough detail for an LLM to make editorial decisions:

```json
{
  "segments": [
    {
      "startTime": 540.0,
      "endTime": 589.0,
      "transcript": "singing...",
      "visualDescription": "A young woman with long dark hair wearing a cream top sits at a keyboard on the left side of the stage, playing and singing",
      "energy": 0.85,
      "sceneType": "performance",
      "topics": ["music", "ceremony"]
    }
  ]
}
```

The visual descriptions are what make person-filtering possible. Without them, the edit planner is blind.

## What's In Progress

**Person-matching precision** - The edit planner sometimes includes segments with the wrong person when visual descriptions are ambiguous (two women in white tops at the same mic). The next step is structured person tracking across segments, so "Person A = young woman, curly hair, keyboard" is a persistent identity, not re-described every scene.

**Revideo integration** - Hybrid rendering where premium segments get motion graphics, animated titles, or visual effects via Revideo, while standard segments use FFmpeg stream copy. The architecture is in place, the rendering bridge is being built.

**Evaluation framework** - Benchmark corpus and automated eval tracks to measure edit quality, person-filtering accuracy, and cost efficiency across different video types.

**Multi-camera support** - Handling videos with multiple camera angles and synced audio tracks.

## Known Limits

**WhisperX on Windows** - The faster-whisper/CTranslate2 transcription engine crashes intermittently on Windows due to memory-mapped model file handle contention. CutSense handles this gracefully (continues without transcript), but the root cause is in the C extension layer. Runs reliably on Linux/Mac.

**Vision model quality** - Visual descriptions are only as good as the vision model's frame analysis. Dark, low-contrast scenes or small faces in wide shots produce vague descriptions ("person on stage" instead of "young woman with curly brown hair playing keyboard"). Adaptive sampling helps but can't fix what the model can't see.

**Frame deduplication** - Very long static scenes (10+ minutes of the same shot) may still have gaps in visual coverage even with adaptive sampling. The 5-second speech interval and 15-second silent interval cover most cases, but edge cases exist.

**Single video input** - CutSense processes one video file at a time. No multi-file merge, no timeline import from NLEs.

## Requirements

- Node.js >= 20
- Python >= 3.10 (auto-configured on first run)
- FFmpeg on PATH
- At least one API key: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_AI_API_KEY`

## License

CutSense is licensed under Apache 2.0 - See [LICENSE](LICENSE)

### Third-Party License Notice

CutSense depends on several open-source projects with their own licenses:

- **[Remotion](https://remotion.dev)** - Licensed under the [Remotion Free License](https://www.remotion.dev/docs/license), which is free for individuals and companies with 3 or fewer employees. Organizations with 4+ employees need a [Remotion Company License](https://www.remotion.dev/pricing) for commercial video rendering. CutSense does not sublicense Remotion - users must comply with Remotion's terms independently.
- **[Revideo](https://re.video)** - MIT License. Fully open source.
- **[FFmpeg](https://ffmpeg.org)** - LGPL v2.1+. CutSense calls FFmpeg as an external process (not linked). Users are responsible for their FFmpeg installation's license compliance. Standard builds from ffmpeg.org are LGPL.
- **[faster-whisper](https://github.com/SYSTRAN/faster-whisper)** - MIT License.
- **[PySceneDetect](https://www.scenedetect.com)** - BSD 3-Clause License.

All other JavaScript/TypeScript dependencies are MIT or Apache 2.0 licensed.

---

## Built by Kivi Media

CutSense is built by [Kivi Media](https://kivimedia.co), an AI-first agency that builds intelligent automation for businesses.

We build AI agents that actually work - not demos, not proofs of concept, but production systems that run every day. CutSense is one example. We have 274 more.

**If you need AI agents built for your business - 100 agents in 90 days - talk to us.**

[kivimedia.co/strategy](https://kivimedia.co/strategy)
