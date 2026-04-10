/**
 * CutSense Timeline - Remotion inputProps schema.
 *
 * This is what gets passed to Remotion's renderMedia() as inputProps.
 * It fully describes the output video: clips, captions, title cards.
 */

export interface CutSenseTimeline {
  version: '1.0';
  jobId: string;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  clips: TimelineClip[];
  captions?: CaptionConfig;
  titleCards?: TitleCard[];
  audioTracks?: AudioTrack[];
}

export interface TimelineClip {
  id: string;
  src: string;
  startFrom: number;
  durationInFrames: number;
  volume?: number;
  playbackRate?: number;
  transition?: ClipTransition;
}

export interface ClipTransition {
  type: 'cut' | 'fade';
  durationInFrames?: number;
}

export interface CaptionConfig {
  style: 'standard' | 'jumbo';
  track: CaptionChunk[];
  direction: 'ltr' | 'rtl';
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  position?: 'bottom' | 'center' | 'top';
}

export interface CaptionChunk {
  text: string;
  startFrame: number;
  endFrame: number;
  direction?: 'ltr' | 'rtl';
  highlight?: boolean;
}

export interface TitleCard {
  startFrame: number;
  durationInFrames: number;
  text: string;
  subtext?: string;
  style: 'minimal' | 'bold' | 'cta';
  direction?: 'ltr' | 'rtl';
}

export interface AudioTrack {
  id: string;
  src: string;
  startFrame: number;
  durationInFrames: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * Edit Decision List - intermediate format before timeline compilation.
 * The LLM produces this; the timeline builder converts it to CutSenseTimeline.
 */
export interface EditDecisionList {
  jobId: string;
  targetDurationSec: number;
  actualDurationSec: number;
  decisions: EditDecision[];
  captionMode: 'none' | 'standard' | 'jumbo' | 'jumbo-then-standard';
  transitionDefault: 'cut' | 'fade' | 'mixed';
}

export interface EditDecision {
  segmentId: string;
  action: 'keep' | 'trim' | 'remove';
  reason: string;
  trimStart?: number;
  trimEnd?: number;
  transitionBefore?: 'cut' | 'fade';
}
