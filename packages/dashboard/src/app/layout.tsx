import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CutSense Dashboard',
  description: 'Full operations suite for CutSense video understanding pipeline',
};

const NAV_ITEMS = [
  { href: '/', label: 'Jobs', icon: '[]' },
  { href: '/jobs/new', label: 'New Job', icon: '+' },
  { href: '/costs', label: 'Costs', icon: '$' },
  { href: '/policies', label: 'Policies', icon: '#' },
  { href: '/settings', label: 'Settings', icon: '*' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', backgroundColor: '#0f1117', color: '#e4e4e7', colorScheme: 'dark' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <nav style={{
            width: 240,
            backgroundColor: '#111318',
            borderRight: '1px solid #27272a',
            padding: '20px 0',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '0 20px', marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: '#fff',
                }}>C</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>CutSense</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>Operations Suite</div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 20px',
                    color: '#a1a1aa',
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                    borderLeft: '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 20, textAlign: 'center', fontSize: 14, fontFamily: 'monospace', color: '#52525b' }}>{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #27272a' }}>
              <div style={{ fontSize: 11, color: '#52525b' }}>v0.1.0 - Apache 2.0</div>
              <a href="https://github.com/kivimedia/watch-video-skill" target="_blank" style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}>GitHub</a>
            </div>
          </nav>

          <main style={{ flex: 1, padding: 32, overflowY: 'auto', maxHeight: '100vh' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
