/**
 * CutSense Revideo renderer - wraps @revideo/renderer for headless scene rendering.
 *
 * Creates temporary Revideo projects per-scene, renders them to .mp4,
 * and returns the asset path for insertion into the Remotion master timeline.
 */

import { renderVideo } from '@revideo/renderer';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { SceneEnhancementSpec } from '@cutsense/core';

export interface RevideoSceneRenderOptions {
  outputDir: string;
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (percent: number) => void;
}

/**
 * Render a title card scene using Revideo.
 */
export async function renderTitleCard(
  title: string,
  subtitle: string,
  durationSec: number,
  options: RevideoSceneRenderOptions,
): Promise<string> {
  const { width = 1328, height = 1028, fps = 30 } = options;
  const tmpId = randomBytes(4).toString('hex');
  const tmpDir = resolve(options.outputDir, `revideo_tmp_${tmpId}`);
  mkdirSync(tmpDir, { recursive: true });

  // Write the project file
  const projectContent = `
import { makeProject } from '@revideo/core';
import { makeScene2D, Txt, Rect } from '@revideo/2d';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeOutCubic, easeInOutCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

const titleCard = makeScene2D('title', function* (view) {
  const titleRef = createRef();
  const subtitleRef = createRef();

  view.add(<Rect width={${width}} height={${height}} fill="#1a1a2e" />);

  view.add(
    <Txt
      ref={titleRef}
      text="${title.replace(/"/g, '\\"')}"
      fontSize={56}
      fontFamily="Segoe UI, sans-serif"
      fontWeight={600}
      fill="#ffffff"
      x={-600}
      y={-30}
      opacity={0}
    />,
  );

  view.add(
    <Txt
      ref={subtitleRef}
      text="${subtitle.replace(/"/g, '\\"')}"
      fontSize={32}
      fontFamily="Segoe UI, sans-serif"
      fontWeight={300}
      fill="#aaaaaa"
      y={40}
      opacity={0}
    />,
  );

  yield* all(
    titleRef().position.x(0, 0.6, easeOutCubic),
    titleRef().opacity(1, 0.4, easeOutCubic),
  );

  yield* waitFor(0.1);
  yield* subtitleRef().opacity(1, 0.5, easeInOutCubic);
  yield* waitFor(${durationSec - 1.5});
  yield* all(titleRef().opacity(0, 0.3), subtitleRef().opacity(0, 0.3));
});

export default makeProject({
  scenes: [titleCard],
  settings: {
    size: { x: ${width}, y: ${height} },
    fps: ${fps},
    background: '#1a1a2e',
  },
});
`;

  const projectFile = join(tmpDir, 'project.tsx');
  writeFileSync(projectFile, projectContent);

  const outFile = resolve(options.outputDir, `title_${tmpId}.mp4`);

  try {
    await renderVideo({
      projectFile,
      settings: {
        outFile: outFile as `${string}.mp4`,
        outDir: options.outputDir,
        logProgress: false,
        progressCallback: (_, progress) => {
          options.onProgress?.(progress * 100);
        },
      },
    });

    return outFile;
  } finally {
    // Clean up temp project
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Check if Revideo rendering is available (all required deps installed).
 */
export function isRevideoAvailable(): boolean {
  try {
    require.resolve('@revideo/renderer');
    require.resolve('@revideo/vite-plugin');
    require.resolve('@revideo/core');
    require.resolve('@revideo/2d');
    return true;
  } catch {
    return false;
  }
}
