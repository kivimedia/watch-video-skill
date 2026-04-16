/**
 * CutSense Marketing Reel renderer - generates animated product marketing videos
 * using Revideo. No source video needed - everything is built from data.
 *
 * Produces vertical (1080x1920) SaaS-style reels with text animations,
 * mock UI components, charts, and CTAs.
 */

import { renderVideo } from '@revideo/renderer';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MarketingReelConfig, ReelScene } from '@cutsense/core';

const execFileAsync = promisify(execFile);

export interface MarketingReelRenderOptions {
  outputDir: string;
  onProgress?: (percent: number) => void;
}

function totalDuration(scenes: ReelScene[]): number {
  return scenes.reduce((sum, s) => sum + s.duration, 0);
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

// ─── Scene Code Generators ──────────────────────────────────
// Each generator outputs a self-contained JS block that:
//   1. Starts with view.removeChildren() to clear the previous scene
//   2. Re-adds the white background
//   3. Uses W (width) and H (height) constants for relative sizing
//   4. Fades elements in/out within a { } block scope

function genHookText(scene: Extract<ReelScene, { type: 'hook-text' }>, brand: MarketingReelConfig['brand']): string {
  const lines = scene.lines.map((l, i) => {
    const color = l.accent ? brand.accentColor : brand.primaryColor;
    const italic = l.accent ? 'italic' : 'normal';
    return `
    const hl${i} = createRef();
    view.add(
      <Txt ref={hl${i}} text={\`${esc(l.text)}\`} fontSize={W * 0.1} fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} fontWeight={700} fontStyle={"${italic}"} fill={"${color}"} y={H * -0.06 + ${i} * W * 0.13} opacity={0} textAlign="center" />
    );`;
  }).join('\n');

  const fadeIns = scene.lines.map((_, i) =>
    `    yield* hl${i}().opacity(1, 0.3, easeOutCubic);\n    yield* waitFor(0.1);`
  ).join('\n');

  const fadeOuts = scene.lines.map((_, i) =>
    `      hl${i}().opacity(0, 0.3),`
  ).join('\n');

  // Logo: colored rounded square icon + text (not emoji - matches source style)
  const logoIcon = `
    const hlIconBg = createRef();
    view.add(<Rect ref={hlIconBg} width={W * 0.06} height={W * 0.06} fill={"${brand.accentColor}"} radius={W * 0.012} y={H * -0.23} x={W * -0.08} opacity={0} />);
    ${brand.logoEmoji ? `const hlIconE = createRef();\n    view.add(<Txt ref={hlIconE} text={\`${esc(brand.logoEmoji)}\`} fontSize={W * 0.035} y={H * -0.23} x={W * -0.08} opacity={0} />);` : ''}`;

  const logoIconFadeIn = `      hlIconBg().opacity(1, 0.3, easeOutCubic),\n${brand.logoEmoji ? '      hlIconE().opacity(1, 0.3, easeOutCubic),' : ''}`;
  const logoIconFadeOut = `      hlIconBg().opacity(0, 0.3),\n${brand.logoEmoji ? '      hlIconE().opacity(0, 0.3),' : ''}`;

  const subtitleCode = scene.subtitle ? `
    const hlSep = createRef();
    view.add(<Rect ref={hlSep} width={W * 0.08} height={5} fill={"${brand.accentColor}"} y={H * -0.06 + ${scene.lines.length} * W * 0.13 + W * 0.04} opacity={0} radius={2} />);
    const hlSub = createRef();
    view.add(<Txt ref={hlSub} text={\`${esc(scene.subtitle)}\`} fontSize={W * 0.038} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fill={"${brand.secondaryColor}"} y={H * -0.06 + ${scene.lines.length} * W * 0.13 + W * 0.1} opacity={0} textAlign="center" />);` : '';

  const subtitleFadeIn = scene.subtitle ? `
    yield* hlSep().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.15);
    yield* hlSub().opacity(1, 0.4, easeOutCubic);` : '';

  const subtitleFadeOut = scene.subtitle ? `
      hlSep().opacity(0, 0.3),
      hlSub().opacity(0, 0.3),` : '';

  return `
  // ─── HOOK TEXT ──────────────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    const hlLogo = createRef();
    view.add(<Txt ref={hlLogo} text={\`${esc(brand.name)}\`} fontSize={W * 0.045} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fontWeight={600} fill={"${brand.primaryColor}"} y={H * -0.23} x={W * 0.02} opacity={0} />);
${logoIcon}
${lines}
${subtitleCode}

    yield* all(
      hlLogo().opacity(1, 0.3, easeOutCubic),
${logoIconFadeIn}
    );
    yield* waitFor(0.2);
${fadeIns}
${subtitleFadeIn}

    yield* waitFor(${Math.max(0.3, scene.duration - scene.lines.length * 0.4 - 1.5)});

    yield* all(
      hlLogo().opacity(0, 0.3),
${logoIconFadeOut}
${fadeOuts}
${subtitleFadeOut}
    );
    yield* waitFor(0.1);
  }`;
}

function genValueProp(scene: Extract<ReelScene, { type: 'value-prop' }>, brand: MarketingReelConfig['brand']): string {
  const iconEmoji = scene.iconEmoji || '\u{1F4B3}';
  return `
  // ─── VALUE PROP ─────────────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    const vpLogo = createRef();
    view.add(<Txt ref={vpLogo} text={\`${esc(brand.name)}\`} fontSize={W * 0.045} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fontWeight={600} fill={"${brand.primaryColor}"} y={H * -0.32} opacity={0} />);

    const vpHead = createRef();
    view.add(<Txt ref={vpHead} text={\`${esc(scene.heading)}\`} fontSize={W * 0.085} fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} fontWeight={700} fill={"${brand.primaryColor}"} y={H * -0.1} opacity={0} textAlign="center" />);

    const vpIconBg = createRef();
    view.add(<Rect ref={vpIconBg} width={W * 0.2} height={W * 0.2} fill={"${brand.primaryColor}"} radius={W * 0.035} y={H * 0.12} opacity={0} />);

    const vpIconTxt = createRef();
    view.add(<Txt ref={vpIconTxt} text={\`${esc(iconEmoji)}\`} fontSize={W * 0.1} y={H * 0.12} opacity={0} />);

    yield* all(vpLogo().opacity(1, 0.3), vpHead().opacity(1, 0.4, easeOutCubic));
    yield* waitFor(0.2);
    yield* all(vpIconBg().opacity(1, 0.3, easeOutCubic), vpIconTxt().opacity(1, 0.3, easeOutCubic));

    yield* waitFor(${Math.max(0.3, scene.duration - 1.2)});

    yield* all(vpLogo().opacity(0, 0.3), vpHead().opacity(0, 0.3), vpIconBg().opacity(0, 0.3), vpIconTxt().opacity(0, 0.3));
    yield* waitFor(0.1);
  }`;
}

function genConnectionDiagram(scene: Extract<ReelScene, { type: 'connection-diagram' }>, brand: MarketingReelConfig['brand']): string {
  const leftEmoji = scene.leftEmoji || '\u{1F4B3}';
  const rightEmoji = scene.rightEmoji || '\u{1F4D6}';
  return `
  // ─── CONNECTION DIAGRAM ─────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    const cdLogo = createRef();
    view.add(<Txt ref={cdLogo} text={\`${esc(brand.name)}\`} fontSize={W * 0.045} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fontWeight={600} fill={"${brand.primaryColor}"} y={H * -0.32} opacity={0} />);

    const cdHead = createRef();
    view.add(<Txt ref={cdHead} text={\`${esc(scene.heading)}\`} fontSize={W * 0.085} fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} fontWeight={700} fill={"${brand.primaryColor}"} y={H * -0.15} opacity={0} textAlign="center" />);

    // Left circle - large
    const cdLC = createRef();
    view.add(<Circle ref={cdLC} width={W * 0.35} height={W * 0.35} stroke={"${brand.accentColor}"} lineWidth={3} y={H * 0.06} x={W * -0.22} opacity={0} />);
    const cdLEmoji = createRef();
    view.add(<Txt ref={cdLEmoji} text={\`${esc(leftEmoji)}\`} fontSize={W * 0.1} y={H * 0.06} x={W * -0.22} opacity={0} />);

    // Connection line
    const cdLine = createRef();
    view.add(<Line ref={cdLine} points={[[W * -0.05, 0], [W * 0.05, 0]]} stroke={"${brand.accentColor}"} lineWidth={2} y={H * 0.06} opacity={0} end={0} />);

    // Checkmark - positioned ABOVE the connection line
    const cdChk = createRef();
    view.add(<Circle ref={cdChk} width={W * 0.065} height={W * 0.065} stroke={"${brand.accentColor}"} lineWidth={2} fill={"#ffffff"} y={H * 0.06 - W * 0.05} opacity={0} />);
    const cdChkT = createRef();
    view.add(<Txt ref={cdChkT} text="\u2713" fontSize={W * 0.035} fill={"${brand.accentColor}"} y={H * 0.06 - W * 0.05} opacity={0} />);

    // Right circle - large
    const cdRC = createRef();
    view.add(<Circle ref={cdRC} width={W * 0.35} height={W * 0.35} stroke={"${brand.accentColor}"} lineWidth={3} y={H * 0.06} x={W * 0.22} opacity={0} />);
    const cdREmoji = createRef();
    view.add(<Txt ref={cdREmoji} text={\`${esc(rightEmoji)}\`} fontSize={W * 0.1} y={H * 0.05} x={W * 0.22} opacity={0} />);
    const cdRLabel = createRef();
    view.add(<Txt ref={cdRLabel} text={\`${esc(scene.rightLabel)}\`} fontSize={W * 0.03} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fontWeight={600} fill={"${brand.primaryColor}"} y={H * 0.1} x={W * 0.22} opacity={0} textAlign="center" />);

    ${scene.subtitle ? `
    const cdSub = createRef();
    view.add(<Txt ref={cdSub} text={\`${esc(scene.subtitle)}\`} fontSize={W * 0.035} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fill={"${brand.secondaryColor}"} y={H * 0.25} opacity={0} textAlign="center" />);` : ''}

    yield* all(cdLogo().opacity(1, 0.3), cdHead().opacity(1, 0.4, easeOutCubic));
    yield* waitFor(0.2);
    yield* all(cdLC().opacity(1, 0.3), cdLEmoji().opacity(1, 0.3));
    yield* cdLine().opacity(1, 0.1);
    yield* cdLine().end(1, 0.5, easeOutCubic);
    yield* all(cdChk().opacity(1, 0.2), cdChkT().opacity(1, 0.2));
    yield* all(cdRC().opacity(1, 0.3), cdREmoji().opacity(1, 0.3), cdRLabel().opacity(1, 0.3));
    ${scene.subtitle ? `yield* waitFor(0.15);\n    yield* cdSub().opacity(1, 0.4, easeOutCubic);` : ''}

    yield* waitFor(${Math.max(0.3, scene.duration - 2.5)});

    yield* all(cdLogo().opacity(0, 0.3), cdHead().opacity(0, 0.3), cdLC().opacity(0, 0.3), cdLEmoji().opacity(0, 0.3), cdLine().opacity(0, 0.3), cdChk().opacity(0, 0.3), cdChkT().opacity(0, 0.3), cdRC().opacity(0, 0.3), cdREmoji().opacity(0, 0.3), cdRLabel().opacity(0, 0.3), ${scene.subtitle ? 'cdSub().opacity(0, 0.3),' : ''});
    yield* waitFor(0.1);
  }`;
}

function genTransactionList(scene: Extract<ReelScene, { type: 'transaction-list' }>, brand: MarketingReelConfig['brand']): string {
  const txCount = scene.transactions.length;
  const rowH = 0.065; // fraction of H per row

  const txDecls = scene.transactions.map((tx, i) => {
    const amtColor = tx.isIncome ? brand.positiveColor : brand.negativeColor;
    const amtPrefix = tx.isIncome ? '+' : '-';
    const amtStr = `${amtPrefix}$${Math.abs(tx.amount).toLocaleString('en-US')}`;
    const bgColor = tx.isIncome ? '#E3FCEF' : '#FFEAEA';
    const emoji = tx.emoji || (tx.isIncome ? '\u{1F4B0}' : '\u{1F4C9}');
    const yPos = -0.2 + i * rowH;
    return `
    // Row ${i}: ${tx.name}
    const txBg${i} = createRef();
    view.add(<Rect ref={txBg${i}} width={W * 0.88} height={H * 0.058} fill={"#f8f9fa"} radius={14} y={H * ${yPos}} opacity={0} />);
    const txIcon${i} = createRef();
    view.add(<Rect ref={txIcon${i}} width={W * 0.1} height={W * 0.1} fill={"${bgColor}"} radius={14} y={H * ${yPos}} x={W * -0.34} opacity={0} layout alignItems="center" justifyContent="center"><Txt text={\`${esc(emoji)}\`} fontSize={W * 0.05} /></Rect>);
    const txName${i} = createRef();
    view.add(<Txt ref={txName${i}} text={\`${esc(tx.name)}\`} fontSize={W * 0.038} fontWeight={600} fill={"${brand.primaryColor}"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} y={H * ${yPos} - H * 0.012} x={W * -0.1} opacity={0} />);
    const txCat${i} = createRef();
    view.add(<Txt ref={txCat${i}} text={\`\u2192 ${esc(tx.category)}\`} fontSize={W * 0.025} fill={"${brand.secondaryColor}"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} y={H * ${yPos} + H * 0.014} x={W * -0.1} opacity={0} />);
    const txAmt${i} = createRef();
    view.add(<Txt ref={txAmt${i}} text={\`${esc(amtStr)}\`} fontSize={W * 0.042} fontWeight={700} fill={"${amtColor}"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} y={H * ${yPos}} x={W * 0.33} opacity={0} textAlign="right" />);`;
  }).join('\n');

  const staggerIn = scene.transactions.map((_, i) =>
    `    yield* all(txBg${i}().opacity(1, 0.15), txIcon${i}().opacity(1, 0.15), txName${i}().opacity(1, 0.15), txCat${i}().opacity(1, 0.15), txAmt${i}().opacity(1, 0.15));\n    yield* waitFor(0.06);`
  ).join('\n');

  const fadeOuts = scene.transactions.map((_, i) =>
    `      txBg${i}().opacity(0, 0.2), txIcon${i}().opacity(0, 0.2), txName${i}().opacity(0, 0.2), txCat${i}().opacity(0, 0.2), txAmt${i}().opacity(0, 0.2),`
  ).join('\n');

  const summaryY = -0.22 + txCount * rowH + 0.03;

  return `
  // ─── TRANSACTION LIST ───────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    const tlHead = createRef();
    view.add(<Txt ref={tlHead} text={\`${esc(scene.heading)}\`} fontSize={W * 0.085} fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} fontWeight={700} fill={"${brand.primaryColor}"} y={H * -0.35} opacity={0} textAlign="center" />);

${txDecls}

    ${scene.summary ? `
    const tlSum = createRef();
    view.add(<Txt ref={tlSum} text={\`\u2705 ${esc(scene.summary)}\`} fontSize={W * 0.035} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fontWeight={500} fill={"${brand.primaryColor}"} y={H * ${summaryY}} opacity={0} textAlign="center" />);` : ''}

    yield* tlHead().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.15);
${staggerIn}
    ${scene.summary ? `yield* waitFor(0.15);\n    yield* tlSum().opacity(1, 0.3, easeOutCubic);` : ''}

    yield* waitFor(${Math.max(0.3, scene.duration - txCount * 0.21 - 1.0)});

    yield* all(
      tlHead().opacity(0, 0.2),
${fadeOuts}
      ${scene.summary ? 'tlSum().opacity(0, 0.2),' : ''}
    );
    yield* waitFor(0.1);
  }`;
}

function genReportCard(scene: Extract<ReelScene, { type: 'report-card' }>, brand: MarketingReelConfig['brand']): string {
  let rowY = -0.14;
  const rowGap = 0.04;
  let rowIdx = 0;
  const allFadeOuts: string[] = [];

  let rowDecls = '';
  let rowFadeIns = '';

  for (const section of scene.sections) {
    const sRef = `rs${rowIdx}`;
    rowDecls += `
    const ${sRef} = createRef();
    view.add(<Txt ref={${sRef}} text={\`${esc(section.title)}\`} fontSize={W * 0.038} fontWeight={700} fill={"${brand.primaryColor}"} y={H * ${rowY}} x={W * -0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);`;
    rowFadeIns += `    yield* ${sRef}().opacity(1, 0.12);\n`;
    allFadeOuts.push(`${sRef}().opacity(0, 0.2)`);
    rowY += rowGap;
    rowIdx++;

    for (const row of section.rows) {
      const r = `rr${rowIdx}`;
      const valStr = `$${Math.abs(row.value).toLocaleString('en-US')}`;
      rowDecls += `
    const ${r}L = createRef();
    const ${r}V = createRef();
    view.add(<Txt ref={${r}L} text={\`${esc(row.label)}\`} fontSize={W * 0.032} fill={"${brand.primaryColor}"} y={H * ${rowY}} x={W * -0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);
    view.add(<Txt ref={${r}V} text={\`${esc(valStr)}\`} fontSize={W * 0.032} fill={"${brand.primaryColor}"} y={H * ${rowY}} x={W * 0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} textAlign="right" />);`;
      rowFadeIns += `    yield* all(${r}L().opacity(1, 0.08), ${r}V().opacity(1, 0.08));\n`;
      allFadeOuts.push(`${r}L().opacity(0, 0.2)`, `${r}V().opacity(0, 0.2)`);
      rowY += rowGap - 0.005;
      rowIdx++;
    }

    if (section.total) {
      const t = `rt${rowIdx}`;
      const tColor = section.total.color === 'negative' ? brand.negativeColor : brand.positiveColor;
      const totStr = `$${Math.abs(section.total.value).toLocaleString('en-US')}`;
      rowDecls += `
    const ${t}L = createRef();
    const ${t}V = createRef();
    view.add(<Txt ref={${t}L} text={\`${esc(section.total.label)}\`} fontSize={W * 0.035} fontWeight={700} fill={"${brand.primaryColor}"} y={H * ${rowY}} x={W * -0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);
    view.add(<Txt ref={${t}V} text={\`${esc(totStr)}\`} fontSize={W * 0.035} fontWeight={700} fill={"${tColor}"} y={H * ${rowY}} x={W * 0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} textAlign="right" />);`;
      rowFadeIns += `    yield* all(${t}L().opacity(1, 0.12), ${t}V().opacity(1, 0.12));\n`;
      allFadeOuts.push(`${t}L().opacity(0, 0.2)`, `${t}V().opacity(0, 0.2)`);
      rowY += rowGap + 0.008;
      rowIdx++;
    }
  }

  let bottomDecl = '';
  let bottomFadeIn = '';
  if (scene.bottomLine) {
    const blVal = `$${Math.abs(scene.bottomLine.value).toLocaleString('en-US')}`;
    bottomDecl = `
    const rpBlBg = createRef();
    view.add(<Rect ref={rpBlBg} width={W * 0.88} height={H * 0.05} fill={"${brand.accentColor}18"} radius={10} y={H * ${rowY + 0.01}} opacity={0} />);
    const rpBlL = createRef();
    view.add(<Txt ref={rpBlL} text={\`${esc(scene.bottomLine.label)}\`} fontSize={W * 0.042} fontWeight={700} fill={"${brand.positiveColor}"} y={H * ${rowY + 0.01}} x={W * -0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);
    const rpBlV = createRef();
    view.add(<Txt ref={rpBlV} text={\`${esc(blVal)}\`} fontSize={W * 0.055} fontWeight={700} fill={"${brand.positiveColor}"} y={H * ${rowY + 0.01}} x={W * 0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} textAlign="right" />);`;
    bottomFadeIn = `    yield* all(rpBlBg().opacity(1, 0.2), rpBlL().opacity(1, 0.2), rpBlV().opacity(1, 0.2));`;
    allFadeOuts.push('rpBlBg().opacity(0, 0.2)', 'rpBlL().opacity(0, 0.2)', 'rpBlV().opacity(0, 0.2)');
  }

  const badge = scene.headingBadge ? `
    const rpBadge = createRef();
    view.add(<Txt ref={rpBadge} text={\`${esc(scene.headingBadge)}\`} fontSize={W * 0.065} y={H * -0.345} x={W * 0.35} opacity={0} />);` : '';
  const badgeFadeIn = scene.headingBadge ? `    yield* rpBadge().opacity(1, 0.2);` : '';
  if (scene.headingBadge) allFadeOuts.push('rpBadge().opacity(0, 0.2)');

  const allFadeOutStr = allFadeOuts.map(f => `      ${f},`).join('\n');

  return `
  // ─── REPORT CARD ────────────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    const rpHead = createRef();
    view.add(<Txt ref={rpHead} text={\`${esc(scene.heading)}\`} fontSize={W * 0.075} fontWeight={700} fill={"${brand.primaryColor}"} y={H * -0.34} opacity={0} textAlign="center" fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} />);
${badge}

    // Card background
    const rpCard = createRef();
    view.add(<Rect ref={rpCard} width={W * 0.92} height={H * ${rowY + 0.14}} fill={"#f8faf8"} radius={20} y={H * ${(rowY - 0.16) / 2 + 0.02}} opacity={0} stroke={"${brand.accentColor}30"} lineWidth={2} />);

    const rpTitle = createRef();
    view.add(<Txt ref={rpTitle} text={\`${esc(scene.reportTitle)}\`} fontSize={W * 0.04} fontWeight={600} fill={"${brand.accentColor}"} y={H * -0.24} x={W * -0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);
    const rpPeriod = createRef();
    view.add(<Txt ref={rpPeriod} text={\`${esc(scene.reportPeriod)}\`} fontSize={W * 0.032} fill={"${brand.secondaryColor}"} y={H * -0.24} x={W * 0.22} opacity={0} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} textAlign="right" />);

${rowDecls}
${bottomDecl}

    ${scene.footer ? `
    const rpFoot = createRef();
    view.add(<Txt ref={rpFoot} text={\`\u2728 ${esc(scene.footer)}\`} fontSize={W * 0.028} fill={"${brand.secondaryColor}"} y={H * ${rowY + 0.08}} opacity={0} textAlign="center" fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);` : ''}

    yield* rpHead().opacity(1, 0.3, easeOutCubic);
${badgeFadeIn}
    yield* waitFor(0.1);
    yield* rpCard().opacity(1, 0.2);
    yield* all(rpTitle().opacity(1, 0.2), rpPeriod().opacity(1, 0.2));
    yield* waitFor(0.08);
${rowFadeIns}
${bottomFadeIn}
    ${scene.footer ? `yield* waitFor(0.08);\n    yield* rpFoot().opacity(1, 0.3);` : ''}

    yield* waitFor(${Math.max(0.3, scene.duration - 2.5)});

    yield* all(
      rpHead().opacity(0, 0.2),
      rpCard().opacity(0, 0.2),
      rpTitle().opacity(0, 0.2),
      rpPeriod().opacity(0, 0.2),
${allFadeOutStr}
      ${scene.footer ? 'rpFoot().opacity(0, 0.2),' : ''}
    );
    yield* waitFor(0.1);
  }`;
}

function genLineChart(scene: Extract<ReelScene, { type: 'line-chart' }>, brand: MarketingReelConfig['brand']): string {
  const chartW = 0.8; // fraction of W
  const chartH = 0.22; // fraction of H
  const chartY = -0.02;
  const maxVal = Math.max(...scene.dataPoints) * 1.3;
  const stepX = chartW / (scene.xLabels.length - 1);
  const yPrefix = scene.yAxisPrefix || '$';
  const ySuffix = scene.yAxisSuffix || '';
  const forecastLabel = scene.forecastLabel || 'Forecast';

  const points = scene.dataPoints.map((v, i) => {
    const x = -chartW / 2 + i * stepX;
    const y = chartH / 2 - (v / maxVal) * chartH;
    return `[W * ${x.toFixed(4)}, H * ${(chartY + y).toFixed(4)}]`;
  });

  const actualPoints = points.slice(0, scene.forecastStartIndex + 1);
  const forecastPoints = points.slice(scene.forecastStartIndex);

  // Y-axis labels - pick clean round numbers
  const rawMax = Math.max(...scene.dataPoints);
  const tickStep = rawMax <= 5000 ? 1000 : rawMax <= 20000 ? 5000 : rawMax <= 50000 ? 10000 : 25000;
  const yTickValues: number[] = [];
  for (let v = 0; v <= rawMax * 1.2; v += tickStep) yTickValues.push(v);
  const yTicks = yTickValues.map(val => {
    const label = val === 0 ? `${yPrefix}0` : val >= 1000 ? `${yPrefix}${val / 1000}k${ySuffix}` : `${yPrefix}${val}${ySuffix}`;
    const yFrac = chartY + chartH / 2 - (val / maxVal) * chartH;
    return `    view.add(<Txt text={\`${esc(label)}\`} fontSize={W * 0.025} fill={"${brand.secondaryColor}"} x={W * ${(-chartW / 2 - 0.06).toFixed(4)}} y={H * ${yFrac.toFixed(4)}} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} textAlign="right" />);`;
  }).join('\n');

  const xLabels = scene.xLabels.map((label, i) => {
    const x = -chartW / 2 + i * stepX;
    return `    view.add(<Txt text={\`${esc(label)}\`} fontSize={W * 0.028} fill={"${brand.secondaryColor}"} x={W * ${x.toFixed(4)}} y={H * ${(chartY + chartH / 2 + 0.025).toFixed(4)}} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />);`;
  }).join('\n');

  const circleDots = scene.dataPoints.map((v, i) => {
    const x = -chartW / 2 + i * stepX;
    const y = chartY + chartH / 2 - (v / maxVal) * chartH;
    return `    const lcD${i} = createRef();\n    view.add(<Circle ref={lcD${i}} width={W * 0.022} height={W * 0.022} fill={"${brand.accentColor}"} x={W * ${x.toFixed(4)}} y={H * ${y.toFixed(4)}} opacity={0} />);`;
  }).join('\n');

  const dotFadeIns = scene.dataPoints.map((_, i) => `lcD${i}().opacity(1, 0.08)`).join(', ');
  const dotFadeOuts = scene.dataPoints.map((_, i) => `lcD${i}().opacity(0, 0.2)`).join(', ');

  // Forecast zone
  const fzStartX = -chartW / 2 + scene.forecastStartIndex * stepX;
  const fzWidth = (scene.xLabels.length - 1 - scene.forecastStartIndex) * stepX;
  const fzCenterX = fzStartX + fzWidth / 2;

  // Summary cards
  const summaryDecls = (scene.summaryCards || []).map((card: { label: string; value: string }, i: number) => {
    const x = i === 0 ? -0.15 : 0.15;
    return `
    const lcS${i} = createRef();
    view.add(
      <Rect ref={lcS${i}} width={W * 0.25} height={H * 0.05} fill={"${brand.accentColor}15"} radius={16} y={H * ${(chartY + chartH / 2 + 0.08).toFixed(4)}} x={W * ${x}} opacity={0} layout direction="column" alignItems="center" justifyContent="center" gap={2}>
        <Txt text={\`${esc(card.label)}\`} fontSize={W * 0.028} fill={"${brand.secondaryColor}"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />
        <Txt text={\`${esc(card.value)}\`} fontSize={W * 0.048} fontWeight={700} fill={"${brand.positiveColor}"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />
      </Rect>
    );`;
  }).join('');

  const sumFadeIns = (scene.summaryCards || []).map((_: unknown, i: number) => `lcS${i}().opacity(1, 0.3)`).join(', ');
  const sumFadeOuts = (scene.summaryCards || []).map((_: unknown, i: number) => `lcS${i}().opacity(0, 0.2)`).join(', ');

  return `
  // ─── LINE CHART ─────────────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    const lcHead = createRef();
    view.add(<Txt ref={lcHead} text={\`${esc(scene.heading)}\`} fontSize={W * 0.075} fontWeight={700} fill={"${brand.primaryColor}"} y={H * -0.36} opacity={0} textAlign="center" fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} />);

    // Chart card bg
    const lcCard = createRef();
    view.add(<Rect ref={lcCard} width={W * ${(chartW + 0.12).toFixed(4)}} height={H * ${(chartH + 0.06).toFixed(4)}} fill={"#ffffff"} radius={16} y={H * ${chartY}} opacity={0} stroke={"#e0e0e0"} lineWidth={1} />);

    // Y-axis
${yTicks}

    // X-axis
${xLabels}

    // Actual line
    const lcActual = createRef();
    view.add(<Line ref={lcActual} points={[${actualPoints.join(', ')}]} stroke={"${brand.accentColor}"} lineWidth={3} opacity={0} end={0} lineJoin="round" />);

    ${forecastPoints.length > 1 ? `
    // Forecast area
    const lcFzArea = createRef();
    view.add(<Rect ref={lcFzArea} width={W * ${fzWidth.toFixed(4)}} height={H * ${chartH}} fill={"${brand.accentColor}18"} x={W * ${fzCenterX.toFixed(4)}} y={H * ${chartY}} opacity={0} radius={4} />);

    // Forecast dashed line
    const lcFcast = createRef();
    view.add(<Line ref={lcFcast} points={[${forecastPoints.join(', ')}]} stroke={"${brand.accentColor}80"} lineWidth={2} lineDash={[8, 6]} opacity={0} end={0} lineJoin="round" />);

    // Forecast badge
    const lcBadge = createRef();
    view.add(<Rect ref={lcBadge} width={W * 0.14} height={H * 0.025} fill={"${brand.accentColor}"} radius={H * 0.012} x={W * ${(fzCenterX + fzWidth * 0.2).toFixed(4)}} y={H * ${(chartY - chartH * 0.25).toFixed(4)}} opacity={0} layout alignItems="center" justifyContent="center"><Txt text={\`${esc(forecastLabel)} \u2197\`} fontSize={W * 0.018} fontWeight={600} fill={"#ffffff"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} /></Rect>);
    ` : ''}

    // Data dots
${circleDots}

${summaryDecls}

    yield* lcHead().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* lcCard().opacity(1, 0.2);

    yield* lcActual().opacity(1, 0.1);
    yield* lcActual().end(1, 1.0, easeOutCubic);
    yield* all(${dotFadeIns});

    ${forecastPoints.length > 1 ? `
    yield* lcFzArea().opacity(1, 0.3, easeOutCubic);
    yield* lcFcast().opacity(1, 0.1);
    yield* lcFcast().end(1, 0.6, easeOutCubic);
    yield* lcBadge().opacity(1, 0.3, easeOutCubic);` : ''}

    ${(scene.summaryCards || []).length > 0 ? `yield* waitFor(0.15);\n    yield* all(${sumFadeIns});` : ''}

    yield* waitFor(${Math.max(0.3, scene.duration - 3.2)});

    yield* all(
      lcHead().opacity(0, 0.2), lcCard().opacity(0, 0.2), lcActual().opacity(0, 0.2),
      ${forecastPoints.length > 1 ? 'lcFzArea().opacity(0, 0.2), lcFcast().opacity(0, 0.2), lcBadge().opacity(0, 0.2),' : ''}
      ${dotFadeOuts},
      ${sumFadeOuts ? sumFadeOuts + ',' : ''}
    );
    yield* waitFor(0.1);
  }`;
}

function genCTA(scene: Extract<ReelScene, { type: 'cta' }>, brand: MarketingReelConfig['brand']): string {
  return `
  // ─── CTA END CARD ───────────────────────────────
  {
    view.removeChildren();
    view.add(<Rect width={W * 2} height={H * 2} fill={"${brand.bgColor || '#ffffff'}"} />);

    // Large brand icon
    const ctaIconBg = createRef();
    view.add(<Rect ref={ctaIconBg} width={W * 0.28} height={W * 0.28} fill={"${brand.accentColor}"} radius={W * 0.06} y={H * -0.2} opacity={0} />);
    ${brand.logoEmoji ? `
    const ctaIconE = createRef();
    view.add(<Txt ref={ctaIconE} text={\`${esc(brand.logoEmoji)}\`} fontSize={W * 0.14} y={H * -0.2} opacity={0} />);` : ''}

    const ctaBrand = createRef();
    view.add(<Txt ref={ctaBrand} text={\`${esc(brand.name.toUpperCase())}\`} fontSize={W * 0.042} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fontWeight={600} letterSpacing={5} fill={"${brand.accentColor}"} y={H * -0.07} opacity={0} />);

    const ctaHead = createRef();
    view.add(<Txt ref={ctaHead} text={\`${esc(scene.heading)}\`} fontSize={W * 0.14} fontFamily={\`${esc(brand.headingFont || 'Georgia, serif')}\`} fontWeight={400} fill={"${brand.primaryColor}"} y={H * 0.05} opacity={0} textAlign="center" />);

    // Button pill
    const ctaBtn = createRef();
    view.add(
      <Rect ref={ctaBtn} width={W * 0.7} height={H * 0.048} fill={"${brand.accentColor}"} radius={H * 0.024} y={H * 0.18} opacity={0} layout alignItems="center" justifyContent="center">
        <Txt text={\`${esc(scene.buttonText)}\`} fontSize={W * 0.045} fontWeight={600} fill={"#ffffff"} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} />
      </Rect>
    );

    ${scene.footnote ? `
    const ctaFoot = createRef();
    view.add(<Txt ref={ctaFoot} text={\`${esc(scene.footnote)}\`} fontSize={W * 0.032} fontFamily={\`${esc(brand.bodyFont || 'Segoe UI, sans-serif')}\`} fill={"${brand.secondaryColor}"} y={H * 0.28} opacity={0} textAlign="center" />);` : ''}

    yield* ctaIconBg().opacity(1, 0.4, easeOutCubic);
    ${brand.logoEmoji ? `yield* ctaIconE().opacity(1, 0.3, easeOutCubic);` : ''}
    yield* waitFor(0.1);
    yield* ctaBrand().opacity(1, 0.3, easeOutCubic);
    yield* waitFor(0.1);
    yield* ctaHead().opacity(1, 0.4, easeOutCubic);
    yield* waitFor(0.15);
    yield* ctaBtn().opacity(1, 0.3, easeOutCubic);
    ${scene.footnote ? `yield* waitFor(0.1);\n    yield* ctaFoot().opacity(1, 0.3, easeOutCubic);` : ''}

    yield* waitFor(${Math.max(0.3, scene.duration - 1.8)});
  }`;
}

function generateSceneCode(scene: ReelScene, brand: MarketingReelConfig['brand']): string {
  switch (scene.type) {
    case 'hook-text': return genHookText(scene, brand);
    case 'value-prop': return genValueProp(scene, brand);
    case 'connection-diagram': return genConnectionDiagram(scene, brand);
    case 'transaction-list': return genTransactionList(scene, brand);
    case 'report-card': return genReportCard(scene, brand);
    case 'line-chart': return genLineChart(scene, brand);
    case 'cta': return genCTA(scene, brand);
    default: return `  // Unknown scene type\n  yield* waitFor(1);`;
  }
}

// ─── Main Render Function ───────────────────────────────────

export async function renderMarketingReel(
  config: MarketingReelConfig,
  options: MarketingReelRenderOptions,
): Promise<string> {
  const width = config.width || 1080;
  const height = config.height || 1920;
  const fps = config.fps || 30;

  const tmpId = randomBytes(4).toString('hex');
  // Place temp project inside the source tree so pnpm can resolve @revideo/* deps.
  const tmpDir = resolve(import.meta.dirname, `../.revideo_tmp_${tmpId}`);
  mkdirSync(tmpDir, { recursive: true });

  const sceneBlocks = config.scenes
    .map((scene: ReelScene) => generateSceneCode(scene, config.brand))
    .join('\n\n');

  const projectContent = `
import { makeProject } from '@revideo/core';
import { makeScene2D } from '@revideo/2d';
import { Txt, Rect, Circle, Line } from '@revideo/2d/lib/components';
import { all, waitFor } from '@revideo/core/lib/flow';
import { easeOutCubic, easeInOutCubic, easeInCubic } from '@revideo/core/lib/tweening';
import { createRef } from '@revideo/core/lib/utils';

const W = ${width};
const H = ${height};

const marketingReel = makeScene2D('marketing-reel', function* (view) {
  // Background
  view.add(<Rect width={W * 2} height={H * 2} fill={"${config.brand.bgColor || '#ffffff'}"} />);

${sceneBlocks}
});

export default makeProject({
  scenes: [marketingReel],
  settings: {
    size: { x: ${width}, y: ${height} },
    fps: ${fps},
    background: '${config.brand.bgColor || '#ffffff'}',
  },
});
`;

  const projectFileAbs = join(tmpDir, 'project.tsx').replace(/\\/g, '/');
  writeFileSync(projectFileAbs, projectContent);

  const outFileName = `marketing_reel_${tmpId}`;
  mkdirSync(options.outputDir, { recursive: true });

  const originalCwd = process.cwd();
  process.chdir(options.outputDir);

  try {
    await renderVideo({
      projectFile: projectFileAbs,
      settings: {
        outFile: `${outFileName}.mp4` as `${string}.mp4`,
        outDir: '.',
        logProgress: true,
        progressCallback: (_: unknown, progress: number) => {
          options.onProgress?.(progress * 100);
        },
        // Set Puppeteer viewport to match target dimensions.
        // This ensures the browser canvas renders at the correct
        // portrait/landscape aspect ratio without post-processing.
        puppeteer: {
          defaultViewport: { width, height },
        },
        projectSettings: {
          exporter: {
            name: '@revideo/core/ffmpeg',
            options: {
              format: 'mp4',
            },
          },
        },
      },
    });

    const finalPath = resolve(options.outputDir, `${outFileName}.mp4`);

    // Verify dimensions match target. If not, FFmpeg fix.
    if (existsSync(finalPath)) {
      const probe = await execFileAsync('ffprobe', [
        '-v', 'quiet', '-print_format', 'json', '-show_streams', finalPath,
      ]);
      const streams = JSON.parse(probe.stdout);
      const vs = streams.streams?.find((s: Record<string, unknown>) => s.codec_type === 'video');
      if (vs && (vs.width !== width || vs.height !== height)) {
        const tmpFix = resolve(options.outputDir, `${outFileName}_fix.mp4`);
        // Scale to fit within target while preserving aspect ratio, then pad
        await execFileAsync('ffmpeg', [
          '-i', finalPath,
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:white`,
          '-c:a', 'copy', '-y', tmpFix,
        ]);
        rmSync(finalPath);
        const { renameSync } = await import('node:fs');
        renameSync(tmpFix, finalPath);
      }
    }

    return finalPath;
  } finally {
    process.chdir(originalCwd);
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
