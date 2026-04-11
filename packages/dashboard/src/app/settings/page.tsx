'use client';

import { useState, useEffect } from 'react';
import { colors, card, btnPrimary, btnGhost } from '../../lib/styles';

export default function SettingsPage() {
  const [system, setSystem] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/system')
      .then((r) => r.json())
      .then((data) => { setSystem(data.checks); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: colors.white }}>Settings & System Status</h2>

      {/* System checks */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 16 }}>System Requirements</div>
        {loading ? (
          <p style={{ color: colors.textMuted }}>Checking system...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(system).map(([name, check]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: '#1a1a2e', borderRadius: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: check.ok ? `${colors.green}22` : `${colors.red}22`,
                  color: check.ok ? colors.green : colors.red,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {check.ok ? 'OK' : '!'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.white }}>{formatName(name)}</div>
                  <div style={{ fontSize: 12, color: check.ok ? colors.textMuted : colors.red }}>{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 12 }}>About CutSense</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', fontSize: 14 }}>
          <span style={{ color: colors.textDim }}>Version</span><span style={{ color: colors.text }}>0.1.0</span>
          <span style={{ color: colors.textDim }}>License</span><span style={{ color: colors.text }}>Apache 2.0</span>
          <span style={{ color: colors.textDim }}>GitHub</span><a href="https://github.com/kivimedia/watch-video-skill" target="_blank" style={{ color: colors.blue, textDecoration: 'none' }}>kivimedia/watch-video-skill</a>
          <span style={{ color: colors.textDim }}>Author</span><span style={{ color: colors.text }}>Ziv Raviv / Kivi Media</span>
          <span style={{ color: colors.textDim }}>Jobs Dir</span><span style={{ color: colors.text, fontFamily: 'monospace', fontSize: 12 }}>~/.cutsense/jobs/</span>
          <span style={{ color: colors.textDim }}>Dashboard</span><span style={{ color: colors.textMuted }}>Local only - reads from filesystem</span>
        </div>
      </div>

      {/* Architecture */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 12 }}>Pipeline Architecture</div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: colors.textMuted, lineHeight: 2, whiteSpace: 'pre' }}>
{`Video File
    |
[1. INGEST]     FFmpeg, WhisperX, PySceneDetect
    |
[2. UNDERSTAND] Vision LLM + Fusion -> VUD
    |
[3. EDIT]       Editorial LLM -> Remotion Timeline
    |
[4. ENHANCE]    Revideo inserts (optional)
    |
[5. RENDER]     Remotion -> output.mp4`}
        </div>
      </div>
    </div>
  );
}

function formatName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}
