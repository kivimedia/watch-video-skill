/**
 * Lenient JSON recovery for LLM responses.
 *
 * Every call site in this package used to do `JSON.parse(response.content)` inside a
 * try with an empty catch, and returned a plausible-looking empty result on failure:
 * `[]` for entities and topics, `'Analysis failed'` per scene, `'could not be parsed'`
 * for the MORE AI notes. That made a truncated response indistinguishable from a video
 * that genuinely had nothing in it, and it hid the actual cause for as long as it ran.
 *
 * The cause was almost always the output token cap. The model was still answering, it
 * just got cut off mid-array, so the vision work was paid for and then discarded. On one
 * 550s screen recording that silently binned 210 of 259 scenes.
 *
 * So: raise the caps at the call sites, and use this to recover the answer that did
 * arrive. It closes unterminated arrays and objects after the last complete element,
 * which turns a truncated response into a short-but-real one instead of nothing.
 */

/** Strip ```json fences and any prose before the first structural character. */
function stripToStructure(raw: string): string | null {
  let text = (raw ?? '').trim();
  if (!text) return null;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();

  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const candidates = [firstObj, firstArr].filter((i) => i >= 0);
  if (candidates.length === 0) return null;

  return text.slice(Math.min(...candidates));
}

/**
 * Close a truncated JSON payload.
 *
 * Walks the text tracking string state and bracket depth, rewinds to the last position
 * where a complete element had just ended, then appends the closers still open.
 */
function repairTruncated(text: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastComplete = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null;
      // A nested element just closed cleanly, so the payload is valid up to here.
      if (stack.length > 0) lastComplete = i;
    }
  }

  if (stack.length === 0) return null; // Not truncated, so nothing to repair.
  if (lastComplete < 0) return null; // Nothing complete to salvage.

  let out = text.slice(0, lastComplete + 1);
  // Drop a dangling separator so the reconstruction stays valid.
  out = out.replace(/,\s*$/, '');

  const depthAt = countOpen(out);
  return out + depthAt.reverse().join('');
}

function countOpen(text: string): string[] {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  return stack;
}

export interface SalvageResult<T> {
  value: T | null;
  /** True when the payload had to be repaired, so the caller can say the result is partial. */
  truncated: boolean;
}

/**
 * Parse an LLM JSON response, recovering a truncated payload where possible.
 *
 * Returns `value: null` when nothing usable could be read. Callers must treat that as a
 * real failure worth logging, never as an empty answer.
 */
export function salvageJson<T = unknown>(raw: string): SalvageResult<T> {
  const text = stripToStructure(raw);
  if (!text) return { value: null, truncated: false };

  try {
    return { value: JSON.parse(text) as T, truncated: false };
  } catch {
    // Fall through to repair.
  }

  const repaired = repairTruncated(text);
  if (repaired) {
    try {
      return { value: JSON.parse(repaired) as T, truncated: true };
    } catch {
      // Fall through.
    }
  }

  return { value: null, truncated: false };
}
