import { Command } from 'commander';
import chalk from 'chalk';
import { loadJSON, saveJSON } from '@cutsense/storage';
import type { VUD } from '@cutsense/core';

interface FixSpec {
  text: string;
  timestamp: number;
  replacement: string;
  raw: string;
}

function parseFixSpec(raw: string): FixSpec {
  const eqIdx = raw.lastIndexOf('=');
  if (eqIdx === -1) throw new Error(`Invalid --fix format "${raw}": missing "=" separator`);
  const replacement = raw.slice(eqIdx + 1);
  const left = raw.slice(0, eqIdx);
  const atIdx = left.lastIndexOf('@');
  if (atIdx === -1) throw new Error(`Invalid --fix format "${raw}": missing "@" separator`);
  const text = left.slice(0, atIdx);
  const timestamp = parseFloat(left.slice(atIdx + 1));
  if (isNaN(timestamp)) throw new Error(`Invalid timestamp in --fix "${raw}"`);
  return { text, timestamp, replacement, raw };
}

export const correctTranscriptCommand = new Command('correct-transcript')
  .description('Review and fix low-confidence Whisper transcript words before editing')
  .argument('<job-id>', 'Job ID with a completed VUD stage')
  .option('--threshold <n>', 'Confidence threshold for flagging (0-1)', parseFloat, 0.7)
  .option(
    '--fix <correction>',
    'Fix a word: "Text@timestamp=Replacement" e.g. "Looks@27.1=Loops" (repeatable)',
    (v: string, acc: string[]) => [...acc, v],
    [] as string[],
  )
  .action(async (jobId: string, opts: { threshold: number; fix: string[] }) => {
    let vud: VUD;
    try {
      vud = await loadJSON<VUD>(jobId, 'vud', 'vud.json');
    } catch {
      console.error(chalk.red(`Could not load VUD for job "${jobId}". Run "cutsense understand" first.`));
      process.exit(1);
    }

    const threshold = opts.threshold;

    // Collect all low-confidence words across all segments
    const lowConfWords: Array<{ segIdx: number; wordIdx: number; word: { text: string; start: number; end: number; confidence?: number } }> = [];
    for (let si = 0; si < vud.segments.length; si++) {
      const seg = vud.segments[si]!;
      for (let wi = 0; wi < seg.words.length; wi++) {
        const w = seg.words[wi]!;
        if (w.confidence !== undefined && w.confidence < threshold) {
          lowConfWords.push({ segIdx: si, wordIdx: wi, word: w });
        }
      }
    }

    if (opts.fix.length === 0) {
      // Report mode - print flagged words and exit
      if (lowConfWords.length === 0) {
        console.log(chalk.green(`No low-confidence words found (threshold: ${threshold})`));
        return;
      }
      console.log(chalk.yellow(`\n${lowConfWords.length} low-confidence word(s) in job ${jobId} (threshold: ${threshold}):\n`));
      for (const { segIdx, word } of lowConfWords) {
        const seg = vud.segments[segIdx]!;
        const confPct = ((word.confidence ?? 0) * 100).toFixed(0);
        console.log(
          chalk.gray(`  seg_${String(segIdx + 1).padStart(3, '0')} @${word.start.toFixed(2)}s`) +
          '  ' +
          chalk.red(`"${word.text.trim()}"`) +
          chalk.gray(` (${confPct}%)`),
        );
        if (seg.transcript) {
          // Show surrounding context (±20 chars)
          const idx = seg.transcript.indexOf(word.text.trim());
          if (idx >= 0) {
            const ctxStart = Math.max(0, idx - 20);
            const ctxEnd = Math.min(seg.transcript.length, idx + word.text.length + 20);
            console.log(chalk.dim(`           ...${seg.transcript.slice(ctxStart, ctxEnd)}...`));
          }
        }
      }
      console.log(chalk.cyan('\nTo fix: cutsense correct-transcript ' + jobId + ' --fix "Word@timestamp=Correct"'));
      return;
    }

    // Parse all fix specs up front - fail fast before mutating anything
    const specs: FixSpec[] = [];
    for (const raw of opts.fix) {
      try {
        specs.push(parseFixSpec(raw));
      } catch (e) {
        console.error(chalk.red(String(e)));
        process.exit(1);
      }
    }

    // Apply fixes
    const applied: Array<{ spec: FixSpec; old: string }> = [];
    const notFound: FixSpec[] = [];

    for (const spec of specs) {
      let found = false;
      for (const seg of vud.segments) {
        for (const word of seg.words) {
          if (
            word.text.trim() === spec.text &&
            Math.abs(word.start - spec.timestamp) < 0.5
          ) {
            const old = word.text;
            // Preserve leading/trailing whitespace from original
            const leading = word.text.match(/^\s*/)?.[0] ?? '';
            const trailing = word.text.match(/\s*$/)?.[0] ?? '';
            word.text = leading + spec.replacement + trailing;
            applied.push({ spec, old });
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) notFound.push(spec);
    }

    if (notFound.length > 0) {
      console.error(chalk.red('\nCould not match the following --fix specs (word not found within 0.5s):'));
      for (const s of notFound) {
        console.error(chalk.red(`  ${s.raw}`));
      }
      console.error(chalk.yellow('Run without --fix to see all timestamps for low-confidence words.'));
      process.exit(1);
    }

    // Rebuild segment transcripts to reflect word-level corrections
    for (const seg of vud.segments) {
      if (seg.words.length > 0) {
        seg.transcript = seg.words.map((w) => w.text.trim()).join(' ');
      }
    }

    await saveJSON(jobId, 'vud', 'vud.json', vud);

    console.log(chalk.green(`\n${applied.length} correction(s) applied to job ${jobId}:\n`));
    for (const { spec, old } of applied) {
      console.log(
        chalk.gray(`  @${spec.timestamp.toFixed(1)}s`) +
        '  ' +
        chalk.red(`"${old.trim()}"`) +
        chalk.gray(' -> ') +
        chalk.green(`"${spec.replacement}"`),
      );
    }
    console.log(chalk.dim('\nvud.json updated. Run "cutsense edit" to use corrected transcript.\n'));
  });
