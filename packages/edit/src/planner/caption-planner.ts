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

  for (const seg of keptSegments) {
    const segStart = seg.trimStart ?? seg.startTime;
    const segEnd = seg.trimEnd ?? seg.endTime;
    const words = seg.words.filter((w) => w.start >= segStart && w.end <= segEnd);

    if (edl.captionMode === 'jumbo') {
      // One word at a time
      for (const word of words) {
        const relativeStart = word.start - segStart;
        const relativeEnd = word.end - segStart;
        track.push({
          text: word.text,
          startFrame: frameOffset + Math.round(relativeStart * fps),
          endFrame: frameOffset + Math.round(relativeEnd * fps),
          direction: detectTextDirection(word.text),
          highlight: false,
        });
      }
    } else {
      // Standard: group into chunks of max 5 words or 2 seconds
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
          const text = chunkWords.map((w) => w.text).join(' ');
          const chunkEnd = word.end - segStart;
          track.push({
            text,
            startFrame: frameOffset + Math.round(chunkStart * fps),
            endFrame: frameOffset + Math.round(chunkEnd * fps),
            direction: detectTextDirection(text),
          });
          chunkWords = [];
        }
      }

      // Flush remaining words
      if (chunkWords.length > 0) {
        const text = chunkWords.map((w) => w.text).join(' ');
        const chunkEnd = chunkWords[chunkWords.length - 1]!.end - segStart;
        track.push({
          text,
          startFrame: frameOffset + Math.round(chunkStart * fps),
          endFrame: frameOffset + Math.round(chunkEnd * fps),
          direction: detectTextDirection(text),
        });
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
