import type { VUD } from '@cutsense/core';
import { checkVUDGate, type GateResult } from '@cutsense/core';

export function checkCompleteness(vud: VUD): GateResult {
  return checkVUDGate(vud);
}
