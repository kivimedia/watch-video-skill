import { listJobs } from '@cutsense/storage';
import { colors, STATE_COLORS, th, td, pill, card, btnPrimary } from '../lib/styles';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  let jobs: Awaited<ReturnType<typeof listJobs>> = [];
  try { jobs = await listJobs(); } catch {}

  const running = jobs.filter((j) => j.state.includes('ing')).length;
  const done = jobs.filter((j) => j.state === 'render_done').length;
  const failed = jobs.filter((j) => j.state.includes('failed')).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: colors.white }}>Jobs</h2>
        <a href="/jobs/new" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>+ New Job</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total" value={jobs.length} color={colors.white} />
        <StatCard label="Running" value={running} color={colors.yellow} />
        <StatCard label="Complete" value={done} color={colors.green} />
        <StatCard label="Failed" value={failed} color={colors.red} />
      </div>

      {jobs.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '50px 40px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #3b82f622, #8b5cf622)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: colors.blue,
          }}>C</div>
          <p style={{ fontSize: 18, color: colors.white, fontWeight: 600, marginBottom: 6 }}>Ready to process your first video</p>
          <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            CutSense understands your video's content - transcript, visuals, entities, energy - then edits it based on your instructions.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href="/jobs/new" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Create New Job</a>
          </div>
          <div style={{ marginTop: 16, padding: '10px 20px', backgroundColor: '#1a1a2e', borderRadius: 8, display: 'inline-block' }}>
            <span style={{ fontSize: 12, color: colors.textDim }}>Or from CLI: </span>
            <code style={{ fontSize: 13, color: colors.blue }}>cutsense run video.mp4 --prompt "..."</code>
          </div>
        </div>
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                <th style={th}>Job ID</th>
                <th style={th}>State</th>
                <th style={th}>Source</th>
                <th style={th}>Created</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const stateColor = STATE_COLORS[job.state] ?? colors.textDim;
                return (
                  <tr key={job.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                    <td style={td}>
                      <a href={`/jobs/${job.id}`} style={{ color: colors.blue, textDecoration: 'none', fontFamily: 'monospace', fontSize: 13 }}>
                        {job.id}
                      </a>
                    </td>
                    <td style={td}><span style={pill(stateColor)}>{job.state}</span></td>
                    <td style={td}>{job.sourceFileName}</td>
                    <td style={{ ...td, color: colors.textDim, fontSize: 13 }}>{timeSince(job.createdAt)}</td>
                    <td style={td}>
                      <a href={`/jobs/${job.id}`} style={{ color: colors.textMuted, textDecoration: 'none', fontSize: 13 }}>View</a>
                      {job.state === 'understand_done' && (
                        <a href={`/jobs/${job.id}/edit`} style={{ color: colors.blue, textDecoration: 'none', fontSize: 13, marginLeft: 12 }}>Edit</a>
                      )}
                      {job.state === 'edit_done' && (
                        <a href={`/jobs/${job.id}/render`} style={{ color: colors.green, textDecoration: 'none', fontSize: 13, marginLeft: 12 }}>Render</a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ backgroundColor: '#16181d', borderRadius: 10, padding: 18, border: '1px solid #27272a', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
