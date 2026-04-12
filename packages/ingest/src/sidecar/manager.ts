/**
 * PythonSidecarManager - manages the Python virtual environment
 * used by CutSense's sidecar scripts.
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFileSync } from 'child_process';

// Resolve the scripts directory relative to the compiled output.
// Compiled output lives at dist/sidecar/manager.js
// Scripts live at src/sidecar/scripts/ (not in dist)
function resolveScriptsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/sidecar/manager.js -> dist/sidecar -> dist -> package root
  const pkgRoot = resolve(thisFile, '..', '..', '..');
  return join(pkgRoot, 'src', 'sidecar', 'scripts');
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

    const pythonExe = await this.findBootstrapPython();

    await new Promise<void>((resolve, reject) => {
      const child = spawn(pythonExe, [setupScript], {
        cwd: this.scriptsDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'inherit'],
        windowsHide: true,
      });

      child.stdout?.on('data', (chunk: Buffer) => {
        process.stderr.write(`[sidecar setup] ${chunk.toString()}`);
      });

      child.on('error', (err) => {
        reject(
          new Error(
            `Failed to start setup_venv.py with ${pythonExe}: ${err.message}. ` +
              'Install Python 3.10+ from https://python.org/downloads/',
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `setup_venv.py exited with code ${code}. Check stderr for details.`,
            ),
          );
        }
      });
    });
  }

  /**
   * Find a working Python to bootstrap setup_venv.py.
   * setup_venv.py itself picks the best Python for the venv,
   * but we need any Python 3.10+ just to run it.
   */
  private async findBootstrapPython(): Promise<string> {
    // Try candidates in order. On Windows, versioned names don't exist,
    // but we also check common install paths.
    const candidates = ['python3', 'python'];

    if (process.platform === 'win32') {
      // Add known Windows install paths (prefer 3.11/3.12 for ML compat)
      for (const minor of [11, 12, 10, 13, 14]) {
        candidates.push(`C:\\Python3${minor}\\python.exe`);
        candidates.push(`C:\\Program Files\\Python3${minor}\\python.exe`);
      }
    }

    for (const candidate of candidates) {
      try {
        const out = execFileSync(candidate, ['-c', 'import sys; print(sys.version_info[:2])'], {
          timeout: 5000,
          encoding: 'utf-8',
          windowsHide: true,
        }).trim();
        const match = out.match(/\((\d+),\s*(\d+)\)/);
        if (match) {
          const major = parseInt(match[1]!, 10);
          const minor = parseInt(match[2]!, 10);
          if (major >= 3 && minor >= 10) {
            return candidate;
          }
        }
      } catch {
        // Try next candidate
      }
    }

    throw new Error(
      'No Python 3.10+ found. Install Python from https://python.org/downloads/\n' +
      'Tried: ' + candidates.join(', '),
    );
  }
}
