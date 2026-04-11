/**
 * Scene Enhancement types for the hybrid rendering architecture.
 *
 * Remotion is the master timeline. Revideo renders selected premium
 * segments as standalone video assets that get inserted back into
 * the Remotion composition.
 */

// ─── Enhancement Decision ────────────────────────────────────

export type EnhancementLevel = 'standard' | 'enhancement_candidate' | 'enhancement_required';

export interface EnhancementDecision {
  segmentId: string;
  level: EnhancementLevel;
  reason: EnhancementDecisionReason;
  enhancementType?: EnhancementType;
  confidence: number;
}

export type EnhancementDecisionReason =
  | 'educational_emphasis'
  | 'precision_zoom'
  | 'motion_explanation'
  | 'animated_callout'
  | 'concept_reveal'
  | 'chart_animation'
  | 'premium_treatment'
  | 'user_requested'
  | 'not_needed';

export type EnhancementType =
  | 'educational_zoom_callout'
  | 'animated_annotation'
  | 'diagram_reveal'
  | 'chart_animation'
  | 'feature_spotlight'
  | 'object_emphasis'
  | 'precision_zoom'
  | 'motion_explanation'
  | 'custom';

// ─── Scene Enhancement Spec ──────────────────────────────────

export interface SceneEnhancementSpec {
  sceneId: string;
  sourceSegmentId: string;
  timelineStartSec: number;
  timelineEndSec: number;
  sourceMediaRef: string;
  enhancementType: EnhancementType;
  targetSubject?: string;
  cameraBehavior?: CameraBehavior;
  overlayText?: string[];
  assets?: string[];
  expectedOutputDurationSec: number;
  audioStrategy: AudioStrategy;
  replacementMode: TimelineReplacementMode;
}

export type CameraBehavior =
  | 'zoom_in_hold_zoom_out'
  | 'pan_to_subject'
  | 'steady_zoom_in'
  | 'steady_zoom_out'
  | 'track_subject'
  | 'static_with_overlay'
  | 'custom';

export type AudioStrategy =
  | 'preserve_original'
  | 'duck_under_overlay'
  | 'replace_with_enhanced_mix'
  | 'mute_original';

export type TimelineReplacementMode =
  | 'replace_segment'
  | 'overlay_on_segment'
  | 'insert_before_segment'
  | 'insert_after_segment';

// ─── Insert Render Result ────────────────────────────────────

export interface InsertRenderResult {
  sceneId: string;
  success: boolean;
  outputPath?: string;
  outputDurationSec?: number;
  renderTimeMs?: number;
  error?: string;
  fallbackToStandard: boolean;
}

// ─── Enhanced Timeline ───────────────────────────────────────

export interface EnhancementManifest {
  jobId: string;
  mode: EditMode;
  totalSegments: number;
  enhancedSegments: number;
  specs: SceneEnhancementSpec[];
  results: InsertRenderResult[];
  totalEnhancementCostUSD: number;
  totalEnhancementRenderTimeMs: number;
  fallbackCount: number;
  status: 'pending' | 'rendering' | 'complete' | 'degraded' | 'failed';
}

export type EditMode = 'standard' | 'enhanced' | 'motion_first';

// ─── Enhanced Clip (extends TimelineClip concept) ────────────

export interface EnhancedClipMeta {
  clipId: string;
  isEnhanced: boolean;
  enhancementSceneId?: string;
  originalSegmentId?: string;
  replacementMode?: TimelineReplacementMode;
  audioStrategy?: AudioStrategy;
  enhancedAssetPath?: string;
  fellBackToStandard?: boolean;
}
