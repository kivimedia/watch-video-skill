import { DEFAULT_MODELS } from '@cutsense/core';
import { colors, card, th, td, pill } from '../../lib/styles';

const TASK_ROUTING: Array<{ task: string; standard: string; moreAI: string }> = [
  { task: 'Frame labeling', standard: 'Fast', moreAI: 'Standard' },
  { task: 'Scene classification', standard: 'Fast', moreAI: 'Standard' },
  { task: 'Entity extraction', standard: 'Standard', moreAI: 'Premium' },
  { task: 'Visual analysis', standard: 'Standard', moreAI: 'Premium' },
  { task: 'VUD fusion', standard: 'Premium', moreAI: 'Premium' },
  { task: 'Editorial reasoning', standard: 'Premium', moreAI: 'Premium' },
  { task: 'Cut planning', standard: 'Premium', moreAI: 'Premium' },
  { task: 'Caption generation', standard: 'Fast', moreAI: 'Standard' },
  { task: 'Review', standard: 'Standard', moreAI: 'Premium' },
  { task: 'Repair', standard: 'Standard', moreAI: 'Premium' },
];

const TIER_COLORS: Record<string, string> = { Premium: colors.purple, Standard: colors.blue, Fast: colors.textDim };

export default function PoliciesPage() {
  const providers = Object.entries(DEFAULT_MODELS);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: colors.white }}>Policies & Model Routing</h2>

      {/* Task routing table */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 16 }}>Task Routing</div>
        <p style={{ color: colors.textDim, fontSize: 13, marginBottom: 16 }}>
          Each pipeline task is routed to the cheapest model tier that can handle it reliably. MORE AI mode upgrades most tasks to premium.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
            <th style={th}>Task</th><th style={th}>Standard Mode</th><th style={th}>MORE AI Mode</th>
          </tr></thead>
          <tbody>
            {TASK_ROUTING.map((r) => (
              <tr key={r.task} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                <td style={td}>{r.task}</td>
                <td style={td}><span style={pill(TIER_COLORS[r.standard] ?? colors.textDim)}>{r.standard}</span></td>
                <td style={td}><span style={pill(TIER_COLORS[r.moreAI] ?? colors.textDim)}>{r.moreAI}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Provider models */}
      {providers.map(([name, tiers]) => (
        <div key={name} style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 12, textTransform: 'capitalize' }}>{name}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              <th style={th}>Tier</th><th style={th}>Model</th><th style={th}>Input $/1K</th><th style={th}>Output $/1K</th><th style={th}>Context</th><th style={th}>Vision</th>
            </tr></thead>
            <tbody>
              {Object.entries(tiers).map(([tier, config]) => (
                <tr key={tier} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={td}><span style={pill(TIER_COLORS[tier.charAt(0).toUpperCase() + tier.slice(1)] ?? colors.textDim)}>{tier}</span></td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 13 }}>{config.model}</td>
                  <td style={td}>${config.inputCostPer1kTokens.toFixed(6)}</td>
                  <td style={td}>${config.outputCostPer1kTokens.toFixed(6)}</td>
                  <td style={td}>{(config.maxContextTokens / 1000).toFixed(0)}K</td>
                  <td style={td}>{config.supportsVision ? 'Yes' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
