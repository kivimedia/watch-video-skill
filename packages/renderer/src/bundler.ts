import { bundle } from '@remotion/renderer';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedBundlePath: string | null = null;

export async function getBundle(
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (cachedBundlePath) return cachedBundlePath;

  const entryPoint = resolve(__dirname, 'composition', 'src', 'index.ts');

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
