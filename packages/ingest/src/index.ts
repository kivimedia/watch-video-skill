// @cutsense/ingest - Layer 1: raw signal extraction from video files

// Sidecar management
export { PythonSidecarManager } from './sidecar/manager.js';
export { ScriptRunner } from './sidecar/runner.js';
export type { RunnerOptions } from './sidecar/runner.js';

// Extractors
export { extractMetadata } from './extractors/metadata.js';
export { extractAudio } from './extractors/audio.js';
export { extractFrames } from './extractors/frames.js';
export type { FrameExtractionOptions } from './extractors/frames.js';
export { detectScenes } from './extractors/scenes.js';
export type { SceneDetectionOptions } from './extractors/scenes.js';
export { transcribe } from './extractors/transcript.js';
export type { TranscribeOptions } from './extractors/transcript.js';
export { measureLUFS } from './extractors/lufs.js';

// Deduplication
export { generateContactSheet } from './deduplication/contact-sheet.js';
export type { ContactSheetOptions } from './deduplication/contact-sheet.js';

// Orchestrator
export { IngestOrchestrator } from './orchestrator.js';
export type { IngestProgressCallback, OrchestratorOptions } from './orchestrator.js';
