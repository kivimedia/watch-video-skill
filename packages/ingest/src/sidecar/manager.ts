/**
 * PythonSidecarManager - manages the Python virtual environment
 * used by CutSense's sidecar scripts.
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Resolve the scripts directory relative to the compiled output.
// Compiled output lives at dist/sidecar/manager.js, so two levels up,
// then into the monorepo-level sidecar/scripts folder.
function resolveScriptsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/sidecar/manager.js -> dist/sidecar -> dist -> package root
  const pkgRoot = resolve(thisFile, '..', '..', '..');
  return join(pkgRoot, 'sidecar', 'scripts');
}

export class PythonSidecarManager {
  private readonly scriptsDir: string;

  constructor() {
    this.scriptsDir = resolveScriptsDir();
  }

  /** Returns the path to the scripts directory. */
  getScriptsDir(): string {
    return this.scriptsDir;
  }

  /** Returns the path to the venv Python executable. */
  getPythonPath(): string {
    const venvDir = join(this.scriptsDir, '.venv');
    const isWindows = process.platform === 'win32';
    return isWindows
      ? join(venvDir, 'Scripts', 'python.exe')
      : join(venvDir, 'bin', 'python');
  }

  /**
   * Returns true when the .venv-ready sentinel file exists,
   * meaning the venv has been fully set up.
   */
  isReady(): boolean {
    const sentinel = join(this.scriptsDir, '.venv-ready');
    return existsSync(sentinel);
  }

  /**
   * Runs setup_venv.py to create the Python virtual environment.
   * Streams progress from the subprocess to stderr so the caller can
   * forward it to the user interface.
   */
  async setup(): Promise<void> {
    if (this.isReady()) {
      return;
    }

    const setupScript = join(this.scriptsDir, 'setup_venv.py');
    if (!existsSync(setupScript)) {
      throw new Error(
        `setup_venv.py not found at ${setupScript}. ` +
          'Ensure the sidecar scripts are present in the package.',
      );
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn('python', [setupScript], {
        cwd: this.scriptsDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'inherit'],
        // Hide the console window on Windows
        windowsHide: true,
      });

      child.stdout?.on('data', (chunk: Buffer) => {
        process.stderr.write(`[sidecar setup] ${chunk.toString()}`);
      });

      child.on('error', (err) => {
        reject(
          new Error(
            `Failed to start setup_venv.py: ${err.message}. ` +
              'Is Python 3.8+ available on PATH?',
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `setup_venv.py exited with code ${code}. ` +
                'Check stderr for details.',
            ),
          );
        }
      });
    });
  }
}
