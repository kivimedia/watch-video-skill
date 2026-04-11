import type { AIProvider, VisionContent } from '@cutsense/core';
import type { SceneInfo, FrameInfo } from '@cutsense/core';
import { readImageAsBase64, getMediaType } from '@cutsense/providers';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
): Promise<VisualDescription[]> {
  const systemPrompt = await readFile(
    resolve(__dirname, 'prompt-templates', 'visual-scene.md'),
    'utf-8',
  );

  if (contactSheets.length > 0) {
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
  const maxFramesPerScene = 3;

  for (const scene of scenes) {
    const sceneFrames = frames
      .filter((f) => !f.isDuplicate && f.timestamp >= scene.startTime && f.timestamp <= scene.endTime)
      .slice(0, maxFramesPerScene);

    if (sceneFrames.length === 0) {
      descriptions.push({
        sceneId: scene.id,
        description: 'No frames available for analysis',
        sceneType: 'other',
        visualInterest: 2,
      });
      continue;
    }

    const content: VisionContent[] = [
      { type: 'text', text: `Analyze this scene (${scene.id}): ${scene.startTime.toFixed(1)}s - ${scene.endTime.toFixed(1)}s` },
    ];

    for (const frame of sceneFrames) {
      const imageData = await readImageAsBase64(frame.path);
      const mediaType = getMediaType(frame.path);
      content.push({ type: 'image', source: { type: 'base64', mediaType, data: imageData } });
    }

    const response = await provider.chatWithVision(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      { maxTokens: 1024 },
    );

    try {
      const parsed = JSON.parse(response.content);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        descriptions.push({
          sceneId: item.sceneId ?? scene.id,
          description: item.description ?? '',
          sceneType: item.sceneType ?? 'other',
          visualInterest: item.visualInterest ?? 3,
          textOnScreen: item.textOnScreen,
          cameraMotion: item.cameraMotion,
        });
      }
    } catch {
      descriptions.push({
        sceneId: scene.id,
        description: 'Analysis failed',
        sceneType: 'other',
        visualInterest: 2,
      });
    }
  }

  return descriptions;
}
