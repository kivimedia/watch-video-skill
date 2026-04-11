import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // FFmpeg
  try {
    const out = execFileSync('ffmpeg', ['-version'], { timeout: 5000, encoding: 'utf-8' });
    const version = out.split('\n')[0] ?? '';
    checks.ffmpeg = { ok: true, detail: version.replace('ffmpeg version ', '').split(' ')[0] ?? 'installed' };
  } catch {
    checks.ffmpeg = { ok: false, detail: 'Not found on PATH' };
  }

  // Python venv
  const venvSentinel = resolve(process.cwd(), '..', 'ingest', 'src', 'sidecar', 'scripts', '.venv-ready');
  if (existsSync(venvSentinel)) {
    checks.pythonVenv = { ok: true, detail: 'Ready' };
  } else {
    checks.pythonVenv = { ok: false, detail: 'Not set up - run cutsense ingest once to initialize' };
  }

  // Anthropic API key
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  checks.anthropicKey = { ok: hasKey, detail: hasKey ? 'Set' : 'Missing ANTHROPIC_API_KEY env var' };

  // Node version
  checks.node = { ok: true, detail: process.version };

  return NextResponse.json({ checks });
}
