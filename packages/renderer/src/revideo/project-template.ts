/**
 * Revideo project template for CutSense enhancements.
 *
 * This file is copied to a temp directory with scene-specific
 * imports injected, then rendered by @revideo/renderer.
 *
 * Each enhancement type gets its own temporary project instance.
 */
import { makeProject } from '@revideo/core';

// The scene import is injected at build time by the CutSense renderer
// @ts-expect-error - dynamic injection
import { scene } from './scene';

export default makeProject({
  scenes: [scene],
});
