import type { VUD, EditDecisionList, CaptionConfig, CaptionChunk } from '@cutsense/core';
import { detectTextDirection } from '@cutsense/core';
import { getSpeechIslands, islandsTotalDuration } from './silence-trimmer.js';

export function planCaptions(
  vud: VUD,
  edl: EditDecisionList,
  fps: number,
  silenceThresholdSec?: number,
): CaptionConfig | undefined {
  if (edl.captionMode === 'none') return undefined;

  const keptSegments = edl.decisions
    .filter((d) => d.action !== 'remove')
    .map((d) => {
      const seg = vud.segments.find((s) => s.id === d.segmentId);
      return seg ? { ...seg, trimStart: d.trimStart, trimEnd: d.trimEnd } : null;
    })
    .filter(Boolean) as Array<typeof vud.segments[0] & { trimStart?: number; trimEnd?: number }>;

  const track: CaptionChunk[] = [];
  let frameOffset = 0;

  // Whisper occasionally emits words with start == end (typical for tiny
  // interjections or alignment artifacts like a leading-space " that").
  // Remotion requires endFrame > startFrame or durationInFrames is 0 and
  // the whole render crashes. We guarantee a minimum 1-frame duration
  // here and drop whitespace-only tokens entirely.
  const pushChunk = (
    text: string,
    outputStartSec: number,
    outputEndSec: number,
    highlight: boolean | undefined,
  ) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const startFrame = frameOffset + Math.round(outputStartSec * fps);
    const endFromWhisper = frameOffset + Math.round(outputEndSec * fps);
    const endFrame = Math.max(endFromWhisper, startFrame + 1);
    track.push({
      text,
      startFrame,
      endFrame,
      direction: detectTextDirection(text),
      ...(highlight !== undefined ? { highlight } : {}),
    });
  };

  const threshold = silenceThresholdSec ?? 0;

  for (const seg of keptSegments) {
    const segStart = seg.trimStart ?? seg.startTime;
    const segEnd = seg.trimEnd ?? seg.endTime;
    const words = seg.words.filter((w) => w.start >= segStart && w.end <= segEnd);
    const islands = getSpeechIslands(words, segStart, segEnd, threshold);

    if (edl.captionMode === 'jumbo') {
      for (const island of islands) {
        for (const word of island.words) {
          // Map source time -> output time via island offset.
          const outputStart = island.outputOffsetSec + (word.start - island.startSec);
          const outputEnd = island.outputOffsetSec + (word.end - island.startSec);
          pushChunk(word.text, outputStart, outputEnd, false);
        }
      }
    } else {
      const maxWords = 5;
      const maxDuration = 2;

      for (const island of islands) {
        let chunkWords: typeof words = [];
        let chunkOutputStart = 0;

        for (const word of island.words) {
          const wordOutputStart = island.outputOffsetSec + (word.start - island.startSec);
          const wordOutputEnd = island.outputOffsetSec + (word.end - island.startSec);

          if (chunkWords.length === 0) {
            chunkOutputStart = wordOutputStart;
          }

          chunkWords.push(word);
          const chunkDuration = wordOutputEnd - chunkOutputStart;

          if (chunkWords.length >= maxWords || chunkDuration >= maxDuration) {
            pushChunk(
              chunkWords.map((w) => w.text).join(' '),
              chunkOutputStart,
              wordOutputEnd,
              undefined,
            );
            chunkWords = [];
          }
        }

        if (chunkWords.length > 0) {
          const lastWord = chunkWords[chunkWords.length - 1]!;
          const lastOutputEnd = island.outputOffsetSec + (lastWord.end - island.startSec);
          pushChunk(
            chunkWords.map((w) => w.text).join(' '),
            chunkOutputStart,
            lastOutputEnd,
            undefined,
          );
        }
      }
    }

    // Advance frameOffset by total output duration of this segment's islands.
    frameOffset += Math.round(islandsTotalDuration(islands) * fps);
  }

  // De-overlap pass: guarantee each caption ends at-or-before the next one
  // starts. Otherwise two <Sequence> overlays can render in the same frame
  // and the words stack on top of each other (happens when the zero-duration
  // fix above pushes endFrame past the next chunk's startFrame).
  for (let i = 0; i < track.length - 1; i++) {
    const curr = track[i]!;
    const next = track[i + 1]!;
    if (curr.endFrame > next.startFrame) {
      curr.endFrame = Math.max(curr.startFrame + 1, next.startFrame);
    }
  }

  return {
    style: edl.captionMode === 'jumbo' ? 'jumbo' : 'standard',
    track,
    direction: vud.isRTL ? 'rtl' : 'ltr',
    fontSize: edl.captionMode === 'jumbo' ? 96 : 36,
    // Jumbo defaults to 'bottom' (lower third) so dead-center words don't
    // sit on the speaker's face in 9:16 talking-head recordings. Standard
    // captions also live at the bottom.
    position: 'bottom',
  };
}
