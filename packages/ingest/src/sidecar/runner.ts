/**
 * ScriptRunner - spawns Python sidecar scripts and returns their
 * stdout parsed as JSON.
 */

import { spawn } from 'child_process';
import { PythonSidecarManager } from './manager.js';

const FALLBACK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
// Long videos (multi-hour masterclasses) need more than 10 minutes per
// sidecar script; CUTSENSE_SCRIPT_TIMEOUT_MS overrides without a code change.
const envTimeout = Number(process.env.CUTSENSE_SCRIPT_TIMEOUT_MS);
const DEFAULT_TIMEOUT_MS =
  Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : FALLBACK_TIMEOUT_MS;

export interface RunnerOptions {
  /** Timeout in milliseconds. Defaults to CUTSENSE_SCRIPT_TIMEOUT_MS or 10 minutes. */
  timeoutMs?: number;
}

export class ScriptRunner {
  private readonly manager: PythonSidecarManager;

  constructor(manager?: PythonSidecarManager) {
    this.manager = manager ?? new PythonSidecarManager();
  }

  /**
   * Runs a sidecar Python script and returns the parsed JSON output.
   *
   * @param scriptName - filename inside the scripts directory (e.g. "extract_frames.py")
   * @param args - additional CLI arguments passed to the script
   * @param options - runner configuration
   */
  async runScript<T = unknown>(
    scriptName: string,
    args: string[] = [],
    options: RunnerOptions = {},
  ): Promise<T> {
    const pythonPath = this.manager.getPythonPath();
    const scriptsDir = this.manager.getScriptsDir();
    const scriptPath = `${scriptsDir}/${scriptName}`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<T>((resolve, reject) => {
      const child = spawn(pythonPath, [scriptPath, ...args], {
        cwd: scriptsDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: process.platform === 'win32',
      });

      let stdout = '';
      const stderrChunks: string[] = [];

      // Pipe stderr so progress messages flow to the parent process
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrChunks.push(text);
        process.stderr.write(`[${scriptName}] ${text}`);
      });

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(
          new Error(
            `Script "${scriptName}" timed out after ${timeoutMs / 1000}s.`,
          ),
        );
      }, timeoutMs);

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(
          new Error(
            `Failed to spawn "${scriptName}": ${err.message}. ` +
              `Python path: ${pythonPath}`,
          ),
        );
      });

      child.on('close', (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          let scriptError = '';
          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed?.error) scriptError = `\nScript error: ${parsed.error}`;
          } catch { /* stdout not JSON, ignore */ }
          const stderrSummary = stderrChunks.join('').slice(-2000);
          reject(
            new Error(
              `Script "${scriptName}" exited with code ${code}.${scriptError}\n` +
                `stderr (last 2000 chars):\n${stderrSummary}`,
            ),
          );
          return;
        }

        const trimmed = stdout.trim();
        if (!trimmed) {
          reject(
            new Error(
              `Script "${scriptName}" produced no stdout output. ` +
                'Expected JSON.',
            ),
          );
          return;
        }

        try {
          resolve(JSON.parse(trimmed) as T);
        } catch (err) {
          reject(
            new Error(
              `Script "${scriptName}" stdout is not valid JSON.\n` +
                `stdout: ${trimmed.slice(0, 500)}`,
            ),
          );
        }
      });
    });
  }
}
