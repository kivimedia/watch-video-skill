import type { CSSProperties } from 'react';

export const colors = {
  bg: '#0f1117',
  surface: '#16181d',
  border: '#27272a',
  borderLight: '#1e1e24',
  text: '#e4e4e7',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  white: '#ffffff',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  purple: '#a78bfa',
  orange: '#f97316',
};

export const STATE_COLORS: Record<string, string> = {
  created: colors.textDim,
  ingesting: colors.yellow,
  ingest_done: colors.blue,
  ingest_failed: colors.red,
  understanding: colors.yellow,
  understand_done: colors.blue,
  understand_failed: colors.red,
  editing: colors.yellow,
  edit_done: colors.blue,
  edit_failed: colors.red,
  rendering: colors.yellow,
  render_done: colors.green,
  render_failed: colors.red,
  cancelled: colors.textDim,
};

export const card: CSSProperties = {
  backgroundColor: colors.surface,
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  padding: '20px 24px',
};

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: colors.textDim,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

export const td: CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
};

export const btn: CSSProperties = {
  padding: '8px 18px',
  borderRadius: 8,
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

export const btnPrimary: CSSProperties = {
  ...btn,
  backgroundColor: colors.blue,
  color: colors.white,
};

export const btnDanger: CSSProperties = {
  ...btn,
  backgroundColor: colors.red,
  color: colors.white,
};

export const btnGhost: CSSProperties = {
  ...btn,
  backgroundColor: 'transparent',
  color: colors.textMuted,
  border: `1px solid ${colors.border}`,
};

export const input: CSSProperties = {
  backgroundColor: '#1a1a2e',
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '10px 14px',
  color: colors.text,
  fontSize: 14,
  width: '100%',
  outline: 'none',
};

export const textarea: CSSProperties = {
  ...input,
  minHeight: 100,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
};

export const select: CSSProperties = {
  ...input,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
  colorScheme: 'dark',
};

export const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textMuted,
  marginBottom: 6,
  display: 'block',
};

export const pill = (color: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: `${color}22`,
  color,
});
