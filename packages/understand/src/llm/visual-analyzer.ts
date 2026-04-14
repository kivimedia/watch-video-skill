import type { AIProvider, VisionContent } from '@cutsense/core';
import type { SceneInfo, FrameInfo } from '@cutsense/core';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anthropic's 5 MB limit is on the base64-decoded bytes (i.e. the raw file size)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Resolve to src/ not dist/ since .md files aren't copied by tsc
const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/llm/ -> dist -> package root
const PKG_ROOT = resolve(__dirname, '..', '..');
const PROMPTS_DIR = resolve(PKG_ROOT, 'src', 'llm', 'prompt-templates');

function readImageAsBase64(filePath: string): Promise<string> {
  return readFile(filePath).then((buf) => buf.toString('base64'));
}

function getMediaType(filePath: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const ext = filePath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

export interface VisualDescription {
  sceneId: string;
  description: string;
  sceneType: string;
  visualInterest: number;
  textOnScreen?: string;
  cameraMotion?: string;
}

export async function analyzeVisuals(
  scenes: SceneInfo[],
  frames: FrameInfo[],
  contactSheets: string[],
  provider: AIProvider,
  usePerSceneAnalysis?: boolean,
): Promise<VisualDescription[]> {
  const systemPrompt = await readFile(
    resolve(PROMPTS_DIR, 'visual-scene.md'),
    'utf-8',
  );

  // Per-scene analysis produces accurate per-segment descriptions (important for
  // person-filtering edits). Contact sheets are cheaper but produce sparse/inaccurate
  // descriptions because the vision model can't map thumbnails to scene boundaries.
  // Default to per-scene analysis for now until contact sheet mapping is improved.
  if (!usePerSceneAnalysis && contactSheets.length > 0) {
    return analyzeContactSheets(contactSheets, scenes, systemPrompt, provider);
  }

  return analyzeIndividualFrames(scenes, frames, systemPrompt, provider);
}

async function analyzeContactSheets(
  sheets: string[],
  scenes: SceneInfo[],
  systemPrompt: string,
  provider: AIProvider,
): Promise<VisualDescription[]> {
  const descriptions: VisualDescription[] = [];

  for (const sheetPath of sheets) {
    const fileSize = (await stat(sheetPath)).size;
    if (fileSize > MAX_IMAGE_BYTES) {
      throw new Error(
        `Contact sheet too large: ${(fileSize / 1024 / 1024).toFixed(1)} MB ` +
        `(limit ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(1)} MB). ` +
        `Re-run ingest with smaller thumbWidth or maxFrames.`,
      );
    }

    const imageData = await readImageAsBase64(sheetPath);
    const mediaType = getMediaType(sheetPath);

    const sceneList = scenes
      .map((s) => `${s.id}: ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s`)
      .join('\n');

    const content: VisionContent[] = [
      { type: 'text', text: `Analyze these video frames. Scene boundaries:\n${sceneList}` },
      { type: 'image', source: { type: 'base64', mediaType, data: imageData } },
    ];

    const response = await provider.chatWithVision(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      { maxTokens: 4096 },
    );

    try {
      const parsed = JSON.parse(response.content);
      const items = Array.isArray(parsed) ? parsed : [];
      for (const item of items) {
        descriptions.push({
          sceneId: item.sceneId ?? '',
          description: item.description ?? '',
          sceneType: item.sceneType ?? 'other',
          visualInterest: item.visualInterest ?? 3,
          textOnScreen: item.textOnScreen,
          cameraMotion: item.cameraMotion,
        });
      }
    } catch {
      // If parsing fails, continue with empty descriptions
    }
  }

  return descriptions;
}

async function analyzeIndividualFrames(
  scenes: SceneInfo[],
  frames: FrameInfo[],
  systemPrompt: string,
  provider: AIProvider,
): Promise<VisualDescription[]> {
  const descriptions: VisualDescription[] = [];

  // Batch scenes: pick 1 representative frame per scene, send up to 10 scenes per API call.
  // This keeps costs manageable while providing per-scene descriptions.
  const BATCH_SIZE = 10;

  for (let batchStart = 0; batchStart < scenes.length; batchStart += BATCH_SIZE) {
    const batch = scenes.slice(batchStart, batchStart + BATCH_SIZE);

    const content: VisionContent[] = [];
    const sceneList = batch.map((s) => `${s.id}: ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s`).join('\n');
    content.push({
      type: 'text',
      text: `Analyze these ${batch.length} scenes. For EACH scene, describe who is visible (appearance, clothing, hair, activity), what they are doing, and the setting. Return a JSON array with one object per scene.\n\nScenes:\n${sceneList}`,
    });

    let hasFrames = false;
    for (const scene of batch) {
      // Pick 1 representative frame per scene (middle of scene)
      const sceneFrames = frames
        .filter((f) => !f.isDuplicate && f.timestamp >= scene.startTime && f.timestamp <= scene.endTime);

      const midFrame = sceneFrames[Math.floor(sceneFrames.length / 2)] ?? sceneFrames[0];
      if (midFrame) {
        const imageData = await readImageAsBase64(midFrame.path);
        const mediaType = getMediaType(midFrame.path);
        content.push({
          type: 'text',
          text: `Frame for ${scene.id} (${midFrame.timestamp.toFixed(1)}s):`,
        });
        content.push({ type: 'image', source: { type: 'base64', mediaType, data: imageData } });
        hasFrames = true;
      }
    }

    if (!hasFrames) {
      for (const scene of batch) {
        descriptions.push({
          sceneId: scene.id,
          description: 'No frames available for analysis',
          sceneType: 'other',
          visualInterest: 2,
        });
      }
      continue;
    }

    const response = await provider.chatWithVision(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      { maxTokens: 2048 },
    );

    try {
      let jsonStr = response.content.trim();
      const arrStart = jsonStr.indexOf('[');
      const arrEnd = jsonStr.lastIndexOf(']');
      if (arrStart >= 0 && arrEnd > arrStart) {
        jsonStr = jsonStr.slice(arrStart, arrEnd + 1);
      }
      const parsed = JSON.parse(jsonStr);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        descriptions.push({
          sceneId: item.sceneId ?? '',
          description: item.description ?? '',
          sceneType: item.sceneType ?? 'other',
          visualInterest: item.visualInterest ?? 3,
          textOnScreen: item.textOnScreen,
          cameraMotion: item.cameraMotion,
        });
      }
    } catch {
      // Fallback: mark all scenes in batch as failed
      for (const scene of batch) {
        descriptions.push({
          sceneId: scene.id,
          description: 'Analysis failed',
          sceneType: 'other',
          visualInterest: 2,
        });
      }
    }
  }

  return descriptions;
}
