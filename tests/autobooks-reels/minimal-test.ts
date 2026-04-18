/**
 * Minimal revideo render test - just a red rectangle for 2 seconds.
 */
import { renderVideo } from '@revideo/renderer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const outDir = resolve(import.meta.dirname, 'output');
mkdirSync(outDir, { recursive: true });

const tmpDir = resolve(import.meta.dirname, 'output', '.tmp_minimal');
mkdirSync(tmpDir, { recursive: true });

const projectContent = `
import { makeProject } from '@revideo/core';
import { makeScene2D } from '@revideo/2d';
import { Rect, Txt } from '@revideo/2d/lib/components';
import { waitFor } from '@revideo/core/lib/flow';
import { createRef } from '@revideo/core/lib/utils';

const testScene = makeScene2D('test', function* (view) {
  const bg = createRef();
  const txt = createRef();

  view.add(<Rect ref={bg} width={1080} height={1920} fill="#2BA5A5" />);
  view.add(<Txt ref={txt} text="Hello CutSense!" fontSize={64} fill="#ffffff" fontWeight={700} />);

  yield* waitFor(2);
});

export default makeProject({
  scenes: [testScene],
  settings: {
    size: { x: 1080, y: 1920 },
    fps: 30,
    background: '#2BA5A5',
  },
});
`;

const projectFile = join(tmpDir, 'project.tsx').replace(/\\/g, '/');
writeFileSync(projectFile, projectContent);

const origCwd = process.cwd();
process.chdir(outDir);

async function main() {
  console.log('Minimal revideo test...');
  console.log('Project file:', projectFile);

  try {
    const result = await renderVideo({
      projectFile,
      settings: {
        outFile: 'minimal_test.mp4',
        outDir: '.',
        logProgress: true,
        projectSettings: {
          exporter: {
            name: '@revideo/core/ffmpeg',
            options: {
              format: 'mp4',
            },
          },
        },
      },
    });
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.chdir(origCwd);
  }

  // Check output
  const { statSync } = await import('node:fs');
  try {
    const stat = statSync(resolve(outDir, 'minimal_test.mp4'));
    console.log('Output size:', stat.size, 'bytes');
  } catch {
    console.log('No output file found');
  }
}

main();
