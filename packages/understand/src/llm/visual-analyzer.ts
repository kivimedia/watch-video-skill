import type { AIProvider, VisionContent } from '@cutsense/core';
import type { SceneInfo, FrameInfo } from '@cutsense/core';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { salvageJson } from './json-salvage.js';

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

  // Batch scenes: pick 1 representative frame per scene, send a few scenes per API call.
  // This keeps costs manageable while providing per-scene descriptions.
  //
  // BATCH_SIZE and MAX_TOKENS are a pair, do not raise one without the other. The prompt
  // asks for a full paragraph per scene, so ten scenes on a 2048 cap ran the model out of
  // output tokens mid-array. JSON.parse then threw and the empty catch below binned all ten
  // at once, silently. On a 550s screen recording that discarded 210 of 259 scenes, about
  // 81%, after the vision calls had already been paid for. Failures arrived in clean blocks
  // of ten, which is the signature of a whole batch dying rather than a hard frame.
  //
  // The cap was the culprit, not the batching, so MAX_TOKENS does the real work here: five
  // descriptions plus their textOnScreen fields land near 2k tokens, so 8192 leaves room to
  // spare. Five rather than ten also keeps each image's share of the prompt higher, which
  // matters on screen recordings where the useful detail is small on-screen text. Anything
  // that still fails to parse is retried one scene at a time below.
  const BATCH_SIZE = 5;
  const MAX_TOKENS = 8192;

  for (let batchStart = 0; batchStart < scenes.length; batchStart += BATCH_SIZE) {
    const batch = scenes.slice(batchStart, batchStart + BATCH_SIZE);

    const content: VisionContent[] = [];
    const sceneList = batch.map((s) => `${s.id}: ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s`).join('\n');
    content.push({
      type: 'text',
      text: `Analyze these ${batch.length} scenes. For EACH scene, describe who is visible (appearance, clothing, hair, activity), what they are doing, and the setting. Return a JSON array with one object per scene.\n\nScenes:\n${sceneList}`,
    });

    // Kept per scene so a failed batch can be retried one scene at a time without
    // re-reading and re-encoding the frames from disk.
    const singleContents: (VisionContent[] | null)[] = [];

    let hasFrames = false;
    for (const scene of batch) {
      // Pick 1 representative frame per scene (middle of scene)
      const sceneFrames = frames
        .filter((f) => !f.isDuplicate && f.timestamp >= scene.startTime && f.timestamp <= scene.endTime);

      const midFrame = sceneFrames[Math.floor(sceneFrames.length / 2)] ?? sceneFrames[0];
      if (midFrame) {
        const imageData = await readImageAsBase64(midFrame.path);
        const mediaType = getMediaType(midFrame.path);
        const label = `Frame for ${scene.id} (${midFrame.timestamp.toFixed(1)}s):`;
        const image: VisionContent = {
          type: 'image',
          source: { type: 'base64', mediaType, data: imageData },
        };
        content.push({ type: 'text', text: label });
        content.push(image);
        singleContents.push([
          {
            type: 'text',
            text:
              `Analyze this 1 scene. Describe who is visible (appearance, clothing, hair, activity), ` +
              `what they are doing, and the setting. Return a JSON array with one object.\n\n` +
              `Scenes:\n${scene.id}: ${scene.startTime.toFixed(1)}s - ${scene.endTime.toFixed(1)}s`,
          },
          { type: 'text', text: label },
          image,
        ]);
        hasFrames = true;
      } else {
        singleContents.push(null);
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
      { maxTokens: MAX_TOKENS },
    );

    const parsedItems = parseSceneDescriptions(response.content);
    if (parsedItems) {
      descriptions.push(...parsedItems);
      continue;
    }

    // The batch response did not parse. Say so out loud rather than swallowing it, then
    // retry the scenes one at a time: a single scene cannot overflow the token cap, so a
    // truncation failure recovers completely and only a genuinely bad frame is lost.
    console.warn(
      `[visual-analyzer] batch of ${batch.length} starting at ${batch[0]?.id ?? '?'} did not parse ` +
        `(${response.content.length} chars returned). Retrying scene by scene.`,
    );

    for (let i = 0; i < batch.length; i++) {
      const scene = batch[i];
      const single = singleContents[i];
      if (!single) {
        descriptions.push(failedDescription(scene, 'No frames available for analysis'));
        continue;
      }

      try {
        const retry = await provider.chatWithVision(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: single },
          ],
          { maxTokens: MAX_TOKENS },
        );
        const one = parseSceneDescriptions(retry.content);
        if (one && one.length > 0) {
          descriptions.push({ ...one[0], sceneId: one[0].sceneId || scene.id });
        } else {
          console.warn(`[visual-analyzer] ${scene.id} still did not parse on retry.`);
          descriptions.push(failedDescription(scene, 'Analysis failed'));
        }
      } catch (err) {
        console.warn(`[visual-analyzer] ${scene.id} retry threw: ${String(err).slice(0, 200)}`);
        descriptions.push(failedDescription(scene, 'Analysis failed'));
      }
    }
  }

  return descriptions;
}

function failedDescription(scene: SceneInfo, description: string): VisualDescription {
  return {
    sceneId: scene.id,
    description,
    sceneType: 'other',
    visualInterest: 2,
  };
}

/**
 * Parse a scene-description response into VisualDescriptions.
 *
 * Returns null when the payload cannot be parsed, so the caller can retry rather than
 * record a fabricated "Analysis failed" for scenes the model may have described fine.
 * A truncated array is the common case: the model runs out of output tokens mid-object,
 * so the last complete object is salvaged instead of discarding the whole response.
 */
function parseSceneDescriptions(raw: string): VisualDescription[] | null {
  const { value } = salvageJson<unknown>(raw);
  if (value === null) return null;

  const items = Array.isArray(value) ? value : [value];
  const out: VisualDescription[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const description = typeof rec.description === 'string' ? rec.description : '';
    if (!description) continue;
    out.push({
      sceneId: typeof rec.sceneId === 'string' ? rec.sceneId : '',
      description,
      sceneType: (typeof rec.sceneType === 'string'
        ? rec.sceneType
        : 'other') as VisualDescription['sceneType'],
      visualInterest: typeof rec.visualInterest === 'number' ? rec.visualInterest : 3,
      textOnScreen: typeof rec.textOnScreen === 'string' ? rec.textOnScreen : undefined,
      cameraMotion: typeof rec.cameraMotion === 'string' ? rec.cameraMotion : undefined,
    });
  }

  return out.length > 0 ? out : null;
}
