import { bundle } from '@remotion/renderer';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname resolves to dist/ at runtime, so we go up to the package root
// then into src/composition/src/ where the actual Remotion entry point lives.
// Remotion's bundler needs the source .ts/.tsx files (it runs webpack internally).
const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');

let cachedBundlePath: string | null = null;

export async function getBundle(
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (cachedBundlePath) return cachedBundlePath;

  const entryPoint = resolve(PACKAGE_ROOT, 'src', 'composition', 'src', 'index.ts');

  const bundlePath = await bundle({
    entryPoint,
    onProgress: (progress) => {
      onProgress?.(progress);
    },
  });

  cachedBundlePath = bundlePath;
  return bundlePath;
}

export function clearBundleCache(): void {
  cachedBundlePath = null;
}
