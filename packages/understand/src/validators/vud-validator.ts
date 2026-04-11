import type { VUD } from '@cutsense/core';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateVUD(vud: VUD): ValidationResult {
  const errors: string[] = [];

  if (vud.version !== '1.0') {
    errors.push(`Invalid VUD version: ${vud.version}`);
  }

  if (!vud.jobId) errors.push('Missing jobId');
  if (!vud.language) errors.push('Missing language');
  if (vud.duration <= 0) errors.push(`Invalid duration: ${vud.duration}`);

  if (!vud.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!vud.metadata.fps || vud.metadata.fps <= 0) errors.push('Invalid fps');
    if (!vud.metadata.width || vud.metadata.width <= 0) errors.push('Invalid width');
    if (!vud.metadata.height || vud.metadata.height <= 0) errors.push('Invalid height');
  }

  if (!vud.segments || vud.segments.length === 0) {
    errors.push('No segments');
  } else {
    for (let i = 0; i < vud.segments.length; i++) {
      const seg = vud.segments[i]!;
      if (!seg.id) errors.push(`Segment ${i}: missing id`);
      if (seg.startTime < 0) errors.push(`Segment ${seg.id}: negative startTime`);
      if (seg.endTime <= seg.startTime) errors.push(`Segment ${seg.id}: endTime <= startTime`);
      if (seg.duration <= 0) errors.push(`Segment ${seg.id}: non-positive duration`);

      if (i > 0) {
        const prev = vud.segments[i - 1]!;
        if (seg.startTime < prev.endTime - 0.01) {
          errors.push(`Segments ${prev.id} and ${seg.id} overlap`);
        }
      }
    }
  }

  if (!Array.isArray(vud.entities)) errors.push('Missing entities array');
  if (!Array.isArray(vud.topics)) errors.push('Missing topics array');
  if (!Array.isArray(vud.energyCurve)) errors.push('Missing energyCurve array');

  return { valid: errors.length === 0, errors };
}
