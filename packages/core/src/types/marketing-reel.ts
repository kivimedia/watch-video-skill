/**
 * Marketing Reel types for CutSense.
 *
 * A marketing reel is a standalone animated video (typically 15-30s, vertical)
 * built entirely from data - no source video needed. Inspired by SaaS product
 * reels (e.g. AutoBooks, Stripe, Square) that combine text animation, mock UI,
 * charts, and CTAs.
 */

// ─── Top-Level Config ───────────────────────────────────────

export interface MarketingReelConfig {
  /** Brand identity */
  brand: BrandConfig;
  /** Ordered list of scenes to render */
  scenes: ReelScene[];
  /** Output dimensions (default 1080x1920 for vertical) */
  width?: number;
  height?: number;
  /** Frames per second (default 30) */
  fps?: number;
}

export interface BrandConfig {
  name: string;
  /** Emoji or single character for the brand icon (e.g. "\uD83D\uDCD6" for open book) */
  logoEmoji?: string;
  /** Primary dark color for text (e.g. "#1a2332") */
  primaryColor: string;
  /** Accent color for highlights, icons, CTA (e.g. "#2BA5A5") */
  accentColor: string;
  /** Positive/green color for income, growth (e.g. "#22A06B") */
  positiveColor: string;
  /** Negative/red color for expenses, decline (e.g. "#DE350B") */
  negativeColor: string;
  /** Secondary/gray color for subtitles (e.g. "#6B778C") */
  secondaryColor: string;
  /** Background color (default "#FFFFFF") */
  bgColor?: string;
  /** Font family for headings */
  headingFont?: string;
  /** Font family for body text */
  bodyFont?: string;
}

// ─── Scene Types ────────────────────────────────────────────

export type ReelScene =
  | HookTextScene
  | ValuePropScene
  | ConnectionDiagramScene
  | TransactionListScene
  | ReportCardScene
  | LineChartScene
  | CTAScene;

/** Scene 1: Hook text - staggered line reveal with accent color */
export interface HookTextScene {
  type: 'hook-text';
  /** Duration in seconds */
  duration: number;
  /** Lines of text to reveal one by one */
  lines: HookLine[];
  /** Subtitle text below a separator line */
  subtitle?: string;
}

export interface HookLine {
  text: string;
  /** If true, use accent color + italic */
  accent?: boolean;
}

/** Scene 2: Value proposition - heading + icon */
export interface ValuePropScene {
  type: 'value-prop';
  duration: number;
  heading: string;
  /** Emoji for the icon (e.g. "\uD83D\uDCB3" for credit card) */
  iconEmoji?: string;
}

/** Scene 3: Connection diagram - two circles connected by a line */
export interface ConnectionDiagramScene {
  type: 'connection-diagram';
  duration: number;
  heading: string;
  leftLabel: string;
  rightLabel: string;
  /** Emoji inside left circle */
  leftEmoji?: string;
  /** Emoji inside right circle */
  rightEmoji?: string;
  /** Subtitle below the diagram */
  subtitle?: string;
}

/** Scene 4: Transaction list - staggered row reveal */
export interface TransactionListScene {
  type: 'transaction-list';
  duration: number;
  heading: string;
  transactions: Transaction[];
  /** Summary text at bottom (e.g. "6 transactions sorted automatically") */
  summary?: string;
}

export interface Transaction {
  name: string;
  category: string;
  amount: number;
  /** True = income (positive/green), false = expense (negative/red) */
  isIncome: boolean;
  /** Emoji icon for the row (e.g. "\uD83D\uDCB0") */
  emoji?: string;
}

/** Scene 5: Report card - financial report with rows */
export interface ReportCardScene {
  type: 'report-card';
  duration: number;
  heading: string;
  /** Emoji badge next to heading (e.g. "\u2705") */
  headingBadge?: string;
  reportTitle: string;
  reportPeriod: string;
  sections: ReportSection[];
  /** Highlighted bottom row (e.g. Net Profit) */
  bottomLine?: { label: string; value: number };
  /** Footer text */
  footer?: string;
}

export interface ReportSection {
  title: string;
  rows: { label: string; value: number }[];
  /** Total row for this section */
  total?: { label: string; value: number; color?: 'positive' | 'negative' };
}

/** Scene 6: Line chart with animated draw + forecast zone */
export interface LineChartScene {
  type: 'line-chart';
  duration: number;
  heading: string;
  /** X-axis labels (e.g. month names) */
  xLabels: string[];
  /** Y-axis data points (same length as xLabels for actual data) */
  dataPoints: number[];
  /** Index where forecast starts (dashed line from here) */
  forecastStartIndex: number;
  /** Y-axis label format - e.g. "$" prefix, "k" suffix */
  yAxisPrefix?: string;
  yAxisSuffix?: string;
  /** Label for forecast badge */
  forecastLabel?: string;
  /** Summary cards below chart */
  summaryCards?: { label: string; value: string }[];
}

/** Scene 7/8: CTA end card */
export interface CTAScene {
  type: 'cta';
  duration: number;
  /** Large text (e.g. "Start free.") */
  heading: string;
  /** Button/pill text (e.g. "getautobooks.com") */
  buttonText: string;
  /** Small text below button */
  footnote?: string;
}
