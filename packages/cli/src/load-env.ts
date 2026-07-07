import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load .env into process.env WITHOUT a runtime dependency and WITHOUT clobbering
// real shell-set vars. The provider layer reads process.env.ANTHROPIC_API_KEY
// directly, so before this the key never reached it and the understand step failed
// with "Could not resolve authentication method". We try the current working dir
// first, then the CutSense repo root (three levels up from this compiled file), so
// the key is found whether cutsense runs from the repo or another directory.
function loadEnvFile(path: string): void {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return; // no .env at this location - fine
  }
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // shell-set vars win
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(here, '../../../.env')); // packages/cli/dist -> CutSense root
