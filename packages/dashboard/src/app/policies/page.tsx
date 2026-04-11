import { DEFAULT_MODELS } from '@cutsense/core';

export default function PoliciesPage() {
  const providers = Object.entries(DEFAULT_MODELS);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Model Routing Policies</h2>

      <p style={{ color: '#a1a1aa', marginBottom: 24, lineHeight: 1.6 }}>
        CutSense routes each task to the cheapest capable model. Premium tasks (VUD fusion, editorial reasoning) use
        the best model available. Fast tasks (frame labeling, captions) use the cheapest.
      </p>

      {providers.map(([providerName, tiers]) => (
        <div key={providerName} style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#fff', textTransform: 'capitalize' }}>
            {providerName}
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle}>Input $/1K</th>
                <th style={thStyle}>Output $/1K</th>
                <th style={thStyle}>Context</th>
                <th style={thStyle}>Vision</th>
                <th style={thStyle}>JSON</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tiers).map(([tier, config]) => (
                <tr key={tier} style={{ borderBottom: '1px solid #1e1e24' }}>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      backgroundColor: tier === 'premium' ? '#7c3aed22' : tier === 'standard' ? '#3b82f622' : '#71717a22',
                      color: tier === 'premium' ? '#a78bfa' : tier === 'standard' ? '#60a5fa' : '#a1a1aa',
                    }}>
                      {tier}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{config.model}</td>
                  <td style={tdStyle}>${config.inputCostPer1kTokens.toFixed(6)}</td>
                  <td style={tdStyle}>${config.outputCostPer1kTokens.toFixed(6)}</td>
                  <td style={tdStyle}>{(config.maxContextTokens / 1000).toFixed(0)}K</td>
                  <td style={tdStyle}>{config.supportsVision ? 'Yes' : 'No'}</td>
                  <td style={tdStyle}>{config.supportsJson ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ marginTop: 32, padding: 20, backgroundColor: '#16181d', borderRadius: 8, border: '1px solid #27272a' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#fff' }}>Task Routing (Standard Mode)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: '#71717a' }}>Frame labeling:</span> Fast</div>
          <div><span style={{ color: '#71717a' }}>Scene classification:</span> Fast</div>
          <div><span style={{ color: '#71717a' }}>Entity extraction:</span> Standard</div>
          <div><span style={{ color: '#71717a' }}>Visual analysis:</span> Standard</div>
          <div><span style={{ color: '#71717a' }}>VUD fusion:</span> Premium</div>
          <div><span style={{ color: '#71717a' }}>Editorial reasoning:</span> Premium</div>
          <div><span style={{ color: '#71717a' }}>Cut planning:</span> Premium</div>
          <div><span style={{ color: '#71717a' }}>Caption generation:</span> Fast</div>
          <div><span style={{ color: '#71717a' }}>Review:</span> Standard</div>
          <div><span style={{ color: '#71717a' }}>Repair:</span> Standard</div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: 12,
  fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 14 };
