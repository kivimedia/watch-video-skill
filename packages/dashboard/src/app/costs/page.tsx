import { listJobs } from '@cutsense/storage';
import { loadJSON } from '@cutsense/storage';
import type { CostManifest } from '@cutsense/core';

export default async function CostsPage() {
  let jobs: Awaited<ReturnType<typeof listJobs>> = [];
  const costs: Array<{ jobId: string; source: string; cost: CostManifest }> = [];

  try {
    jobs = await listJobs();
    for (const job of jobs) {
      try {
        const cost = await loadJSON<CostManifest>(job.id, 'output', 'cost-report.json');
        costs.push({ jobId: job.id, source: job.sourceFileName, cost });
      } catch {
        // No cost report for this job
      }
    }
  } catch {
    // No jobs yet
  }

  const totalCost = costs.reduce((sum, c) => sum + c.cost.total, 0);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#fff' }}>Cost Overview</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>${totalCost.toFixed(4)}</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Total Spend</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>{costs.length}</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Jobs with Cost Data</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>
            ${costs.length > 0 ? (totalCost / costs.length).toFixed(4) : '0.00'}
          </div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Avg Cost per Job</div>
        </div>
      </div>

      {costs.length === 0 ? (
        <p style={{ color: '#71717a', textAlign: 'center', padding: 40 }}>
          No cost data yet. Run a pipeline with an AI provider to generate cost reports.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              <th style={thStyle}>Job</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>By Stage</th>
              <th style={thStyle}>By Provider</th>
            </tr>
          </thead>
          <tbody>
            {costs.map(({ jobId, source, cost }) => (
              <tr key={jobId} style={{ borderBottom: '1px solid #1e1e24' }}>
                <td style={tdStyle}>
                  <a href={`/jobs/${jobId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{jobId}</a>
                </td>
                <td style={tdStyle}>{source}</td>
                <td style={tdStyle}>${cost.total.toFixed(4)}</td>
                <td style={tdStyle}>
                  {Object.entries(cost.byStage).map(([stage, amt]) => (
                    <span key={stage} style={{ display: 'inline-block', marginRight: 8, fontSize: 12 }}>
                      <span style={{ color: '#71717a' }}>{stage}:</span> ${(amt as number).toFixed(4)}
                    </span>
                  ))}
                </td>
                <td style={tdStyle}>
                  {Object.entries(cost.byProvider).map(([prov, amt]) => (
                    <span key={prov} style={{ display: 'inline-block', marginRight: 8, fontSize: 12 }}>
                      <span style={{ color: '#71717a' }}>{prov}:</span> ${(amt as number).toFixed(4)}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#16181d', borderRadius: 8, padding: 20,
  border: '1px solid #27272a', textAlign: 'center',
};
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: 12,
  fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = { padding: '12px', fontSize: 14 };
