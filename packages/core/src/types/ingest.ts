/**
 * Ingest layer types - raw signals extracted from video.
 */

import type { LUFSData, VideoMetadata, TranscriptWord } from './vud.js';

export interface IngestResult {
  jobId: string;
  metadata: VideoMetadata;
  frames: FrameInfo[];
  scenes: SceneInfo[];
  transcript: TranscriptResult;
  lufs?: LUFSData;
  contactSheets: string[];
}

export interface FrameInfo {
  path: string;
  timestamp: number;
  frameNumber: number;
  phash?: string;
  isDuplicate: boolean;
}

export interface SceneInfo {
  id: string;
  startTime: number;
  endTime: number;
  startFrame: number;
  endFrame: number;
  duration: number;
}

export interface TranscriptResult {
  language: string;
  isRTL: boolean;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  speakers: string[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words: TranscriptWord[];
}

export interface IngestOptions {
  fps?: number;
  language?: string;
  noTranscript?: boolean;
  dedupThreshold?: number;
  contactSheetCols?: number;
  sceneThreshold?: number;
}
