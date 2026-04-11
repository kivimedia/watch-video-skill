import { listJobs, loadJSON } from '@cutsense/storage';
import type { CostManifest } from '@cutsense/core';
import { colors, card, th, td } from '../../lib/styles';

export const dynamic = 'force-dynamic';

export default async function CostsPage() {
  let jobs: Awaited<ReturnType<typeof listJobs>> = [];
  const costs: Array<{ jobId: string; source: string; cost: CostManifest }> = [];

  try {
    jobs = await listJobs();
    for (const job of jobs) {
      try {
        const cost = await loadJSON<CostManifest>(job.id, 'output', 'cost-report.json');
        costs.push({ jobId: job.id, source: job.sourceFileName, cost });
      } catch {}
    }
  } catch {}

  const totalCost = costs.reduce((sum, c) => sum + c.cost.total, 0);

  // Aggregate by provider
  const byProvider: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  for (const { cost } of costs) {
    for (const [p, v] of Object.entries(cost.byProvider)) { byProvider[p] = (byProvider[p] ?? 0) + (v as number); }
    for (const [s, v] of Object.entries(cost.byStage)) { byStage[s] = (byStage[s] ?? 0) + (v as number); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: colors.white }}>Cost Dashboard</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Spend" value={`$${totalCost.toFixed(4)}`} />
        <StatCard label="Jobs Tracked" value={costs.length} />
        <StatCard label="Avg / Job" value={`$${costs.length > 0 ? (totalCost / costs.length).toFixed(4) : '0'}`} />
        <StatCard label="Total Jobs" value={jobs.length} />
      </div>

      {Object.keys(byProvider).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 12 }}>By Provider</div>
            {Object.entries(byProvider).sort((a, b) => b[1] - a[1]).map(([p, v]) => (
              <div key={p} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderLight}` }}>
                <span style={{ textTransform: 'capitalize', color: colors.textMuted }}>{p}</span>
                <span style={{ fontWeight: 600, color: colors.white }}>${v.toFixed(4)}</span>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 12 }}>By Stage</div>
            {Object.entries(byStage).sort((a, b) => b[1] - a[1]).map(([s, v]) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderLight}` }}>
                <span style={{ color: colors.textMuted }}>{s}</span>
                <span style={{ fontWeight: 600, color: colors.white }}>${v.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {costs.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.white, marginBottom: 12 }}>Per-Job Breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              <th style={th}>Job</th><th style={th}>Source</th><th style={th}>Total</th><th style={th}>Details</th>
            </tr></thead>
            <tbody>
              {costs.map(({ jobId, source, cost }) => (
                <tr key={jobId} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={td}><a href={`/jobs/${jobId}/costs`} style={{ color: colors.blue, textDecoration: 'none', fontFamily: 'monospace', fontSize: 12 }}>{jobId}</a></td>
                  <td style={td}>{source}</td>
                  <td style={{ ...td, fontWeight: 600 }}>${cost.total.toFixed(4)}</td>
                  <td style={{ ...td, fontSize: 12, color: colors.textDim }}>
                    {Object.entries(cost.byStage).map(([s, v]) => `${s}: $${(v as number).toFixed(4)}`).join(' | ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {costs.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <p style={{ color: colors.textMuted }}>No cost data yet. Process a video to start tracking costs.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: colors.white }}>{value}</div>
      <div style={{ fontSize: 12, color: colors.textDim, marginTop: 4 }}>{label}</div>
    </div>
  );
}
