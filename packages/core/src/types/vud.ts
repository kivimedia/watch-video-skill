/**
 * Video Understanding Document (VUD) - The core data structure of CutSense.
 *
 * A VUD is a structured JSON timeline that fully describes a video's content
 * in a form an LLM can reason over. It fuses transcript, visual analysis,
 * entity tracking, topic modeling, and energy scoring into a single document.
 */

export interface VUD {
  version: '1.0';
  jobId: string;
  sourceFile: string;
  duration: number;
  language: string;
  isRTL: boolean;
  metadata: VideoMetadata;
  segments: VUDSegment[];
  entities: Entity[];
  topics: Topic[];
  energyCurve: EnergyPoint[];
  summary: string;
  keyMoments: KeyMoment[];
  moreAI?: MoreAIAnalysis;
}

export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  hasAudio: boolean;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  lufs?: LUFSData;
}

export interface LUFSData {
  inputI: number;
  inputTP: number;
  inputLRA: number;
  inputThresh: number;
}

export interface VUDSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  transcript: string;
  words: TranscriptWord[];
  speaker?: string;
  sceneId?: string;
  visualDescription?: string;
  representativeFrame?: string;
  sceneType?: SceneType;
  visualInterest?: number;
  textOnScreen?: string;
  cameraMotion?: string;
  topics: string[];
  entities: string[];
  energy: number;
  isSilent: boolean;
  isBlurry: boolean;
  isDuplicate: boolean;
  isRTL?: boolean;
}

export type SceneType =
  | 'interview'
  | 'b-roll'
  | 'action'
  | 'title'
  | 'transition'
  | 'screenrec'
  | 'other';

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'person' | 'place' | 'product' | 'organization' | 'concept';
  role?: string;
  description?: string;
  mentions: number[];
  totalScreenTime: number;
}

export interface Topic {
  id: string;
  label: string;
  segments: string[];
  totalDuration: number;
}

export interface EnergyPoint {
  time: number;
  energy: number;
  driver: 'speech_rate' | 'audio_level' | 'visual_motion' | 'silence' | 'mixed';
}

export interface KeyMoment {
  segmentId: string;
  label: string;
  reason: string;
  recommendedForHighlight: boolean;
}

export interface MoreAIAnalysis {
  sentiment: SentimentPoint[];
  bRollOpportunities: BRollOpportunity[];
  pacingRecommendations: string[];
  editorialNotes: string;
}

export interface SentimentPoint {
  time: number;
  sentiment: number;
  label: string;
}

export interface BRollOpportunity {
  afterSegmentId: string;
  suggestedContent: string;
  reason: string;
}
