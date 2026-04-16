// Core rendering
export { getBundle, clearBundleCache } from './bundler.js';
export { render, type RenderOptions } from './renderer.js';
export { canUseFastRender, renderWithFFmpeg, type FFmpegRenderOptions } from './ffmpeg-renderer.js';

// Enhancement (hybrid Remotion + Revideo)
export { generateEnhancementSpecs } from './enhancement/spec-generator.js';
export { renderEnhancedScene, renderAllEnhancedScenes, type RevideoRenderOptions } from './enhancement/revideo-renderer.js';
export { applyEnhancementInserts, buildEnhancementManifest } from './enhancement/inserter.js';

// Marketing Reel (standalone Revideo composition)
export { renderMarketingReel, type MarketingReelRenderOptions } from './revideo/render-marketing-reel.js';
