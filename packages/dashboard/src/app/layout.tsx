import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CutSense Dashboard',
  description: 'Full operations suite for CutSense video understanding pipeline',
};

const NAV_ITEMS = [
  { href: '/', label: 'Jobs' },
  { href: '/jobs/new', label: 'New Job' },
  { href: '/costs', label: 'Costs' },
  { href: '/policies', label: 'Policies' },
  { href: '/settings', label: 'Settings' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          * { box-sizing: border-box; }
          ::selection { background: #3b82f6; color: #fff; }
          .nav-link {
            display: block;
            padding: 11px 24px;
            color: #a1a1aa;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            border-left: 3px solid transparent;
            transition: all 0.15s ease;
          }
          .nav-link:hover {
            color: #e4e4e7;
            background-color: #1a1a2e;
            border-left-color: #3b82f644;
          }
          button { transition: all 0.12s ease; }
          button:hover:not(:disabled) { filter: brightness(1.12); }
          button:active:not(:disabled) { transform: scale(0.98); }
          input:focus, textarea:focus, select:focus {
            border-color: #3b82f6 !important;
            outline: none;
            box-shadow: 0 0 0 2px #3b82f622;
          }
          select option { background: #1a1a2e; color: #e4e4e7; }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: #0f1117; }
          ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        `}</style>
      </head>
      <body suppressHydrationWarning style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        backgroundColor: '#0f1117',
        color: '#e4e4e7',
        colorScheme: 'dark',
      }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <nav style={{
            width: 240,
            backgroundColor: '#111318',
            borderRight: '1px solid #27272a',
            padding: '20px 0',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
          }}>
            <div style={{ padding: '0 24px', marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: '#fff',
                }}>C</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>CutSense</div>
                  <div style={{ fontSize: 11, color: '#71717a', letterSpacing: 0.3 }}>Operations Suite</div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              {NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </a>
              ))}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #27272a' }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>CutSense v0.1.0</div>
              <a href="https://github.com/kivimedia/watch-video-skill" target="_blank" rel="noopener" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>
                GitHub
              </a>
              <span style={{ color: '#3f3f46', margin: '0 6px' }}>-</span>
              <span style={{ fontSize: 12, color: '#71717a' }}>Apache 2.0</span>
            </div>
          </nav>

          <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxHeight: '100vh' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
