import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CutSense Dashboard',
  description: 'Operator dashboard for CutSense video understanding pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#0f1117', color: '#e4e4e7' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <nav style={{
            width: 220,
            backgroundColor: '#16181d',
            borderRight: '1px solid #27272a',
            padding: '24px 0',
            flexShrink: 0,
          }}>
            <div style={{ padding: '0 20px', marginBottom: 32 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#fff' }}>CutSense</h1>
              <span style={{ fontSize: 12, color: '#71717a' }}>Operator Dashboard</span>
            </div>
            <NavLink href="/" label="Jobs" />
            <NavLink href="/costs" label="Costs" />
            <NavLink href="/policies" label="Policies" />
          </nav>
          <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: '10px 20px',
        color: '#a1a1aa',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </a>
  );
}
