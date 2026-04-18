import type { VUD, EditDecisionList, CaptionConfig, CaptionChunk } from '@cutsense/core';
import { detectTextDirection } from '@cutsense/core';

export function planCaptions(
  vud: VUD,
  edl: EditDecisionList,
  fps: number,
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
    relStartSec: number,
    relEndSec: number,
    highlight: boolean | undefined,
  ) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const startFrame = frameOffset + Math.round(relStartSec * fps);
    const endFromWhisper = frameOffset + Math.round(relEndSec * fps);
    const endFrame = Math.max(endFromWhisper, startFrame + 1);
    track.push({
      text,
      startFrame,
      endFrame,
      direction: detectTextDirection(text),
      ...(highlight !== undefined ? { highlight } : {}),
    });
  };

  for (const seg of keptSegments) {
    const segStart = seg.trimStart ?? seg.startTime;
    const segEnd = seg.trimEnd ?? seg.endTime;
    const words = seg.words.filter((w) => w.start >= segStart && w.end <= segEnd);

    if (edl.captionMode === 'jumbo') {
      for (const word of words) {
        pushChunk(
          word.text,
          word.start - segStart,
          word.end - segStart,
          false,
        );
      }
    } else {
      const maxWords = 5;
      const maxDuration = 2;
      let chunkWords: typeof words = [];
      let chunkStart = 0;

      for (const word of words) {
        if (chunkWords.length === 0) {
          chunkStart = word.start - segStart;
        }

        chunkWords.push(word);
        const chunkDuration = (word.end - segStart) - chunkStart;

        if (chunkWords.length >= maxWords || chunkDuration >= maxDuration) {
          pushChunk(
            chunkWords.map((w) => w.text).join(' '),
            chunkStart,
            word.end - segStart,
            undefined,
          );
          chunkWords = [];
        }
      }

      if (chunkWords.length > 0) {
        pushChunk(
          chunkWords.map((w) => w.text).join(' '),
          chunkStart,
          chunkWords[chunkWords.length - 1]!.end - segStart,
          undefined,
        );
      }
    }

    frameOffset += Math.round((segEnd - segStart) * fps);
  }

  return {
    style: edl.captionMode === 'jumbo' ? 'jumbo' : 'standard',
    track,
    direction: vud.isRTL ? 'rtl' : 'ltr',
    fontSize: edl.captionMode === 'jumbo' ? 96 : 36,
    position: edl.captionMode === 'jumbo' ? 'center' : 'bottom',
  };
}
