/**
 * Test script: render a marketing reel matching the AutoBooks reference video.
 *
 * Usage: pnpm exec tsx tests/autobooks-reels/render-test.ts
 */

import type { MarketingReelConfig } from '../../packages/core/src/types/marketing-reel.js';
import { renderMarketingReel } from '../../packages/renderer/src/revideo/render-marketing-reel.js';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const outputDir = resolve(import.meta.dirname, 'output');
mkdirSync(outputDir, { recursive: true });

const config: MarketingReelConfig = {
  brand: {
    name: 'AutoBooks',
    logoEmoji: '\uD83D\uDCD6', // open book
    primaryColor: '#1a2332',
    accentColor: '#2BA5A5',
    positiveColor: '#22A06B',
    negativeColor: '#DE350B',
    secondaryColor: '#6B778C',
    bgColor: '#FFFFFF',
    headingFont: 'Georgia, serif',
    bodyFont: 'Segoe UI, sans-serif',
  },
  width: 1080,
  height: 1920,
  fps: 30,
  scenes: [
    // Scene 1: Hook text (2.5s)
    {
      type: 'hook-text',
      duration: 2.5,
      lines: [
        { text: 'You started' },
        { text: 'a business,' },
        { text: 'not an' },
        { text: 'accounting', accent: true },
        { text: 'firm.', accent: true },
      ],
      subtitle: 'So why are you doing your own books?',
    },

    // Scene 2: Value prop (1.5s)
    {
      type: 'value-prop',
      duration: 1.5,
      heading: 'Autobooks keeps\nyour books moving.',
      iconEmoji: '\uD83D\uDCB3', // credit card
    },

    // Scene 3: Connect Your Bank (2.5s)
    {
      type: 'connection-diagram',
      duration: 2.5,
      heading: 'Connect Your Bank',
      leftLabel: 'Your Bank',
      leftEmoji: '\uD83D\uDCB3', // credit card
      rightLabel: 'AUTO\nBOOKS',
      rightEmoji: '\uD83D\uDCD6', // open book
      subtitle: 'Secure. Encrypted. Takes 60 seconds.',
    },

    // Scene 4: Auto-Categorize (2.5s)
    {
      type: 'transaction-list',
      duration: 2.5,
      heading: 'Auto-Categorize',
      transactions: [
        { name: 'Shopify Deposit', category: 'Income', amount: 1240, isIncome: true, emoji: '\uD83D\uDCB0' },
        { name: 'Adobe Creative', category: 'Software', amount: 54.99, isIncome: false, emoji: '\uD83D\uDCBB' },
        { name: 'Client Wire', category: 'Income', amount: 3500, isIncome: true, emoji: '\uD83E\uDE99' },
        { name: 'Google Ads', category: 'Marketing', amount: 420, isIncome: false, emoji: '\uD83D\uDCE3' },
        { name: 'WeWork Rent', category: 'Rent', amount: 800, isIncome: false, emoji: '\uD83C\uDFE2' },
        { name: 'Stripe Payout', category: 'Income', amount: 2100, isIncome: true, emoji: '\uD83D\uDCB5' },
      ],
      summary: '6 transactions sorted automatically',
    },

    // Scene 5: P&L Report (3.5s - needs time for all rows to appear)
    {
      type: 'report-card',
      duration: 3.5,
      heading: 'Reports generate for you',
      headingBadge: '\u2705',
      reportTitle: 'Profit & Loss',
      reportPeriod: 'April 2026',
      sections: [
        {
          title: 'Revenue',
          rows: [
            { label: 'Product Sales', value: 18400 },
            { label: 'Service Income', value: 6180 },
          ],
          total: { label: 'Total Revenue', value: 24580, color: 'positive' },
        },
        {
          title: 'Expenses',
          rows: [
            { label: 'Software & Tools', value: 2340 },
            { label: 'Marketing', value: 1870 },
            { label: 'Rent & Utilities', value: 3420 },
          ],
          total: { label: 'Total Expenses', value: 7620, color: 'negative' },
        },
      ],
      bottomLine: { label: 'Net Profit', value: 16950 },
      footer: 'Auto-generated - zero manual entry',
    },

    // Scene 6: Cash Flow Forecast (4.0s - line draw + forecast + hold)
    {
      type: 'line-chart',
      duration: 4.0,
      heading: 'Cash Flow Forecast',
      xLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      dataPoints: [800, 4200, 3100, 6500, 9500, 13200, 18500],
      forecastStartIndex: 4,
      yAxisPrefix: '$',
      yAxisSuffix: '',
      forecastLabel: 'Forecast',
      summaryCards: [
        { label: 'Current', value: '$16,950' },
        { label: 'Forecast', value: '$22,400' },
      ],
    },

    // Scene 7: CTA End Card (2.5s)
    {
      type: 'cta',
      duration: 2.5,
      heading: 'Start free.',
      buttonText: 'getautobooks.com',
      footnote: 'No credit card required - Setup in 2 min',
    },
  ],
};

async function main() {
  console.log('Rendering AutoBooks marketing reel v2...');
  console.log(`Output dir: ${outputDir}`);
  console.log(`Canvas: ${config.width}x${config.height} (portrait)`);
  console.log(`Total duration: ${config.scenes.reduce((s, sc) => s + sc.duration, 0)}s`);

  const startTime = Date.now();

  const outputPath = await renderMarketingReel(config, {
    outputDir,
    onProgress: (pct) => {
      process.stdout.write(`\rProgress: ${pct.toFixed(1)}%`);
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
  console.log(`Output: ${outputPath}`);
}

main().catch(console.error);
