import type { EnergyPoint, VUDSegment, LUFSData } from '@cutsense/core';

export function buildEnergyCurve(
  segments: VUDSegment[],
  lufs?: LUFSData,
): EnergyPoint[] {
  const points: EnergyPoint[] = [];

  const speechRates = segments.map((s) => {
    if (s.duration <= 0) return 0;
    return s.words.length / s.duration;
  });
  const maxSpeechRate = Math.max(...speechRates, 1);
  const meanLUFS = lufs?.inputI ?? -23;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const speechRate = speechRates[i]! / maxSpeechRate;

    let loudnessScore = 0.5;
    if (lufs) {
      const deviation = Math.abs(meanLUFS - (lufs.inputI ?? -23));
      loudnessScore = Math.min(1, deviation / 20 + 0.3);
    }

    const silenceScore = seg.isSilent ? 0 : 0.5;

    let energy: number;
    let driver: EnergyPoint['driver'];

    if (seg.isSilent) {
      energy = 0.05;
      driver = 'silence';
    } else if (speechRate > 0.7) {
      energy = speechRate * 0.6 + loudnessScore * 0.3 + silenceScore * 0.1;
      driver = 'speech_rate';
    } else {
      energy = speechRate * 0.3 + loudnessScore * 0.5 + silenceScore * 0.2;
      driver = 'audio_level';
    }

    energy = Math.max(0, Math.min(1, energy));

    points.push({
      time: seg.startTime,
      energy,
      driver,
    });
  }

  return points;
}

export function assignSegmentEnergy(segments: VUDSegment[], curve: EnergyPoint[]): void {
  for (const seg of segments) {
    const point = curve.find((p) => Math.abs(p.time - seg.startTime) < 0.5);
    seg.energy = point?.energy ?? 0.5;
  }
}
