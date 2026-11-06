import {
  createTextAnchor,
  applyTextEdit,
  mapTextAnchor,
  inspectTextAnchor,
  AnchorError,
} from '@lp-labs/annotation-anchors';
const publicAPI = [createTextAnchor, applyTextEdit, mapTextAnchor, inspectTextAnchor, AnchorError];
const apiCount: number = publicAPI.length;
void apiCount;
const anchor = createTextAnchor('abc', 'id', 0, 1);
const status: 'exact' | 'relocated' | 'ambiguous' | 'orphan' = inspectTextAnchor(
  anchor,
  'abc',
).status;
void status;
