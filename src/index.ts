export interface TextEdit {
  start: number;
  end: number;
  insert: string;
}

export interface TextAnchor {
  id: string;
  start: number;
  end: number;
  quote: string;
  before: string;
  after: string;
}

export interface AnchorDiagnostic {
  anchor: TextAnchor;
  status: 'exact' | 'relocated' | 'ambiguous' | 'orphan';
  candidates: number[];
}

export class AnchorError extends Error {
  constructor(
    readonly code: 'invalid' | 'capacity',
    message: string,
  ) {
    super(message);
    this.name = 'AnchorError';
  }
}

const MAX_TEXT_POINTS = 1_000_000;
const MAX_CONTEXT_POINTS = 128;

function points(text: string): string[] {
  if (typeof text !== 'string') throw new AnchorError('invalid', 'Text must be a string.');
  const result = Array.from(text);
  if (result.length > MAX_TEXT_POINTS) throw new AnchorError('capacity', 'Text exceeds its limit.');
  return result;
}

function safeId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 256;
}

function validateRange(start: number, end: number, length: number): void {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > length
  )
    throw new AnchorError('invalid', 'Range must be a nonempty Unicode code-point interval.');
}

function validateAnchor(anchor: TextAnchor): void {
  if (
    anchor === null ||
    typeof anchor !== 'object' ||
    !safeId(anchor.id) ||
    !Number.isSafeInteger(anchor.start) ||
    !Number.isSafeInteger(anchor.end) ||
    anchor.start < 0 ||
    anchor.end <= anchor.start ||
    typeof anchor.quote !== 'string' ||
    anchor.quote.length === 0 ||
    typeof anchor.before !== 'string' ||
    typeof anchor.after !== 'string'
  )
    throw new AnchorError('invalid', 'Anchor has an invalid shape.');
  if (
    Array.from(anchor.quote).length > 4096 ||
    Array.from(anchor.before).length > 128 ||
    Array.from(anchor.after).length > 128
  )
    throw new AnchorError('capacity', 'Anchor quote/context limit exceeded.');
}

export function createTextAnchor(
  text: string,
  id: string,
  start: number,
  end: number,
  contextLength = 24,
): TextAnchor {
  const chars = points(text);
  if (!safeId(id)) throw new AnchorError('invalid', 'Anchor id must be a nonempty identifier.');
  if (
    !Number.isSafeInteger(contextLength) ||
    contextLength < 0 ||
    contextLength > MAX_CONTEXT_POINTS
  )
    throw new AnchorError('invalid', 'contextLength must be from 0 to 128 code points.');
  validateRange(start, end, chars.length);
  if (end - start > 4096) throw new AnchorError('capacity', 'Quote exceeds 4096 code points.');
  return {
    id,
    start,
    end,
    quote: chars.slice(start, end).join(''),
    before: chars.slice(Math.max(0, start - contextLength), start).join(''),
    after: chars.slice(end, end + contextLength).join(''),
  };
}

export function applyTextEdit(text: string, edit: TextEdit): string {
  const chars = points(text);
  if (
    edit === null ||
    typeof edit !== 'object' ||
    typeof edit.insert !== 'string' ||
    !Number.isSafeInteger(edit.start) ||
    !Number.isSafeInteger(edit.end) ||
    edit.start < 0 ||
    edit.end < edit.start ||
    edit.end > chars.length
  )
    throw new AnchorError('invalid', 'Edit must use valid Unicode code-point boundaries.');
  const inserted = points(edit.insert);
  const result = [...chars.slice(0, edit.start), ...inserted, ...chars.slice(edit.end)];
  if (result.length > MAX_TEXT_POINTS)
    throw new AnchorError('capacity', 'Edited text exceeds its limit.');
  return result.join('');
}

function mapPosition(
  position: number,
  edit: TextEdit,
  insertedLength: number,
  affinity: 'left' | 'right',
): number {
  const removed = edit.end - edit.start;
  const delta = insertedLength - removed;
  if (position < edit.start) return position;
  if (position > edit.end) return position + delta;
  if (edit.start === edit.end && position === edit.start)
    return affinity === 'left' ? edit.start : edit.start + insertedLength;
  if (position === edit.end && edit.end > edit.start) return edit.start + insertedLength;
  return affinity === 'left' ? edit.start : edit.start + insertedLength;
}

function contextScore(chars: string[], start: number, end: number, anchor: TextAnchor): number {
  const before = chars.slice(Math.max(0, start - Array.from(anchor.before).length), start).join('');
  const after = chars.slice(end, end + Array.from(anchor.after).length).join('');
  let score = 0;
  if (anchor.before && before === anchor.before) score += 1;
  if (anchor.after && after === anchor.after) score += 1;
  return score;
}

export function mapTextAnchor(
  anchor: TextAnchor,
  oldText: string,
  edit: TextEdit,
  newText = applyTextEdit(oldText, edit),
): AnchorDiagnostic {
  validateAnchor(anchor);
  const oldChars = points(oldText);
  const newChars = points(newText);
  if (edit.start < 0 || edit.end > oldChars.length)
    throw new AnchorError('invalid', 'Edit is outside the old text.');
  const expectedText = applyTextEdit(oldText, edit);
  if (expectedText !== newText)
    throw new AnchorError('invalid', 'newText must be the result of applying this edit.');
  const insertedLength = points(edit.insert).length;
  const mappedStart = mapPosition(anchor.start, edit, insertedLength, 'left');
  const mappedEnd = mapPosition(anchor.end, edit, insertedLength, 'right');
  if (mappedEnd > mappedStart && newChars.slice(mappedStart, mappedEnd).join('') === anchor.quote) {
    return {
      anchor: { ...anchor, start: mappedStart, end: mappedEnd },
      status: 'exact',
      candidates: [mappedStart],
    };
  }

  const quote = Array.from(anchor.quote);
  const candidates: number[] = [];
  for (let index = 0; index <= newChars.length - quote.length; index += 1)
    if (newChars.slice(index, index + quote.length).join('') === anchor.quote)
      candidates.push(index);
  if (candidates.length === 0)
    return {
      anchor: {
        ...anchor,
        start: Math.max(0, Math.min(mappedStart, newChars.length)),
        end: Math.max(0, Math.min(mappedEnd, newChars.length)),
      },
      status: 'orphan',
      candidates: [],
    };

  const ranked = candidates
    .map((start) => ({ start, score: contextScore(newChars, start, start + quote.length, anchor) }))
    .sort((a, b) => b.score - a.score || a.start - b.start);
  const best = ranked[0]!;
  const ties = ranked.filter((candidate) => candidate.score === best.score);
  if (ties.length !== 1)
    return {
      anchor: { ...anchor, start: mappedStart, end: mappedEnd },
      status: 'ambiguous',
      candidates,
    };
  return {
    anchor: { ...anchor, start: best.start, end: best.start + quote.length },
    status: 'relocated',
    candidates,
  };
}

export function inspectTextAnchor(anchor: TextAnchor, text: string): AnchorDiagnostic {
  validateAnchor(anchor);
  const chars = points(text);
  const quoteLength = Array.from(anchor.quote).length;
  const candidates: number[] = [];
  for (let index = 0; index <= chars.length - quoteLength; index += 1)
    if (chars.slice(index, index + quoteLength).join('') === anchor.quote) candidates.push(index);
  if (chars.slice(anchor.start, anchor.end).join('') === anchor.quote)
    return { anchor: { ...anchor }, status: 'exact', candidates: [anchor.start] };
  if (candidates.length === 0) return { anchor: { ...anchor }, status: 'orphan', candidates };
  const ranked = candidates
    .map((start) => ({
      start,
      score: contextScore(chars, start, start + quoteLength, anchor),
    }))
    .sort((a, b) => b.score - a.score || a.start - b.start);
  const best = ranked[0]!;
  const ties = ranked.filter((candidate) => candidate.score === best.score);
  if (ties.length !== 1) return { anchor: { ...anchor }, status: 'ambiguous', candidates };
  return {
    anchor: { ...anchor, start: best.start, end: best.start + quoteLength },
    status: 'relocated',
    candidates,
  };
}
