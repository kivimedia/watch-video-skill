import type { VUDSegment, TranscriptWord } from '@cutsense/core';
import type { SceneInfo, TranscriptResult } from '@cutsense/core';

export function buildSegments(
  transcript: TranscriptResult,
  scenes: SceneInfo[],
  duration: number,
): VUDSegment[] {
  if (!scenes.length) {
    return buildFromTranscriptOnly(transcript, duration);
  }

  const segments: VUDSegment[] = [];
  let segIndex = 0;

  for (const scene of scenes) {
    const wordsInScene = transcript.words.filter(
      (w) => w.start >= scene.startTime && w.end <= scene.endTime,
    );

    if (scene.duration > 60 && wordsInScene.length > 0) {
      const chunks = splitLongScene(scene, wordsInScene);
      for (const chunk of chunks) {
        segments.push(createSegment(segIndex++, chunk.start, chunk.end, chunk.words, scene.id, transcript.isRTL));
      }
    } else {
      segments.push(createSegment(segIndex++, scene.startTime, scene.endTime, wordsInScene, scene.id, transcript.isRTL));
    }
  }

  return segments;
}

function createSegment(
  index: number,
  startTime: number,
  endTime: number,
  words: TranscriptWord[],
  sceneId: string,
  isRTL: boolean,
): VUDSegment {
  const text = words.map((w) => w.text).join(' ');
  const speakers = [...new Set(words.map((w) => w.speaker).filter(Boolean))];

  return {
    id: `seg_${String(index).padStart(3, '0')}`,
    startTime,
    endTime,
    duration: endTime - startTime,
    transcript: text,
    words,
    speaker: speakers[0],
    sceneId,
    topics: [],
    entities: [],
    energy: 0,
    isSilent: words.length === 0,
    isBlurry: false,
    isDuplicate: false,
    isRTL,
  };
}

function splitLongScene(
  scene: SceneInfo,
  words: TranscriptWord[],
): Array<{ start: number; end: number; words: TranscriptWord[] }> {
  const chunks: Array<{ start: number; end: number; words: TranscriptWord[] }> = [];
  const targetChunkDuration = 30;
  let chunkStart = scene.startTime;

  while (chunkStart < scene.endTime) {
    const chunkEnd = Math.min(chunkStart + targetChunkDuration, scene.endTime);
    const chunkWords = words.filter((w) => w.start >= chunkStart && w.end <= chunkEnd);

    const actualEnd = chunkWords.length > 0
      ? Math.max(chunkEnd, chunkWords[chunkWords.length - 1]!.end)
      : chunkEnd;

    chunks.push({ start: chunkStart, end: actualEnd, words: chunkWords });
    chunkStart = actualEnd;
  }

  return chunks;
}

function buildFromTranscriptOnly(transcript: TranscriptResult, duration: number): VUDSegment[] {
  const segments: VUDSegment[] = [];
  const chunkDuration = 15;
  let index = 0;

  for (let start = 0; start < duration; start += chunkDuration) {
    const end = Math.min(start + chunkDuration, duration);
    const words = transcript.words.filter((w) => w.start >= start && w.end <= end);
    segments.push(createSegment(index++, start, end, words, `auto_${index}`, transcript.isRTL));
  }

  return segments;
}
