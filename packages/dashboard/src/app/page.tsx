import { listJobs } from '@cutsense/storage';

const STATE_COLORS: Record<string, string> = {
  created: '#71717a',
  ingesting: '#eab308',
  ingest_done: '#3b82f6',
  understanding: '#eab308',
  understand_done: '#3b82f6',
  editing: '#eab308',
  edit_done: '#3b82f6',
  rendering: '#eab308',
  render_done: '#22c55e',
  ingest_failed: '#ef4444',
  understand_failed: '#ef4444',
  edit_failed: '#ef4444',
  render_failed: '#ef4444',
  cancelled: '#71717a',
};

export default async function JobsPage() {
  let jobs: Awaited<ReturnType<typeof listJobs>> = [];
  try {
    jobs = await listJobs();
  } catch {
    // No jobs yet
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#fff' }}>
        Jobs Queue
      </h2>

      {jobs.length === 0 ? (
        <div style={{ color: '#71717a', padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No jobs yet</p>
          <p style={{ fontSize: 13 }}>
            Run <code style={{ color: '#3b82f6' }}>cutsense run video.mp4 --prompt "..."</code> to create your first job
          </p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              <th style={thStyle}>Job ID</th>
              <th style={thStyle}>State</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                <td style={tdStyle}>
                  <a href={`/jobs/${job.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    {job.id}
                  </a>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: `${STATE_COLORS[job.state] ?? '#71717a'}22`,
                    color: STATE_COLORS[job.state] ?? '#71717a',
                  }}>
                    {job.state}
                  </span>
                </td>
                <td style={tdStyle}>{job.sourceFileName}</td>
                <td style={{ ...tdStyle, color: '#71717a' }}>
                  {new Date(job.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
};
