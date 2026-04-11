import type { VUD, EditDecisionList } from '@cutsense/core';

export function analyzePacing(vud: VUD, edl: EditDecisionList): string[] {
  const warnings: string[] = [];

  const keptDecisions = edl.decisions.filter((d) => d.action !== 'remove');
  if (keptDecisions.length === 0) {
    warnings.push('No segments kept - the edit would produce empty output');
    return warnings;
  }

  const keptSegments = keptDecisions
    .map((d) => vud.segments.find((s) => s.id === d.segmentId))
    .filter(Boolean) as typeof vud.segments;

  // Check for consecutive low-energy segments
  for (let i = 1; i < keptSegments.length; i++) {
    const prev = keptSegments[i - 1]!;
    const curr = keptSegments[i]!;
    if (prev.energy < 0.3 && curr.energy < 0.3 && prev.duration > 10 && curr.duration > 10) {
      warnings.push(
        `Low energy stretch: segments ${prev.id} and ${curr.id} are both low-energy and long - consider trimming`,
      );
    }
  }

  // Check if it ends on a low note
  const lastSeg = keptSegments[keptSegments.length - 1]!;
  if (lastSeg.energy < 0.3) {
    warnings.push('Edit ends on a low-energy segment - consider ending with a stronger moment');
  }

  // Check for monotonous scene types
  const sceneTypes = keptSegments.map((s) => s.sceneType).filter(Boolean);
  if (sceneTypes.length > 3) {
    const uniqueTypes = new Set(sceneTypes);
    if (uniqueTypes.size === 1) {
      warnings.push(`All kept segments are ${sceneTypes[0]} - consider adding visual variety`);
    }
  }

  return warnings;
}
