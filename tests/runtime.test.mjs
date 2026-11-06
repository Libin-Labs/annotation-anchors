import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTextAnchor,
  applyTextEdit,
  mapTextAnchor,
  inspectTextAnchor,
  AnchorError,
} from '../dist/esm/index.js';

test('documented workflow produces required outputs', async () => {
  const text = 'Hello world';
  const anchor = createTextAnchor(text, 'comment', 6, 11);
  const edit = { start: 0, end: 0, insert: 'A ' };
  const updated = applyTextEdit(text, edit);
  const mapped = mapTextAnchor(anchor, text, edit, updated);
  assert.equal(mapped.anchor.start, 8);
  assert.equal(mapped.status, 'exact');
  assert.equal(inspectTextAnchor(mapped.anchor, updated).status, 'exact');
});
test('code point offsets preserve emoji', () => {
  const a = createTextAnchor('a😀b', 'x', 1, 2);
  assert.equal(a.quote, '😀');
  assert.equal(applyTextEdit('a😀b', { start: 1, end: 2, insert: 'x' }), 'axb');
});
test('missing quote produces orphan', () => {
  const a = createTextAnchor('abc', 'x', 1, 2);
  assert.equal(mapTextAnchor(a, 'abc', { start: 1, end: 2, insert: '' }).status, 'orphan');
});
test('quote fallback detects ambiguity', () => {
  const a = createTextAnchor('xx', 'x', 0, 1, 0);
  a.start = 9;
  a.end = 10;
  assert.equal(inspectTextAnchor(a, 'xx').status, 'ambiguous');
});
test('mismatched edits and invalid ranges reject', () => {
  assert.throws(() => createTextAnchor('a', 'x', 0, 2), AnchorError);
  const a = createTextAnchor('a', 'x', 0, 1);
  assert.throws(() => mapTextAnchor(a, 'a', { start: 0, end: 0, insert: 'b' }, 'wrong'));
});
