# @lp-labs/annotation-anchors

Unicode code-point text anchors with edit mapping and quote/context fallback.

Original independent MIT TypeScript implementation with **zero runtime/peer dependencies**. ESM and CommonJS with separate declarations, Node 18+ (browser use when adapters/APIs are available). Development dependencies are not consumer runtime dependencies.

## Install

```sh
npm install @lp-labs/annotation-anchors
```

## Complete example

```js
import assert from 'node:assert/strict';
import {
  createTextAnchor,
  applyTextEdit,
  mapTextAnchor,
  inspectTextAnchor,
  AnchorError,
} from '@lp-labs/annotation-anchors';
const text = 'Hello world';
const anchor = createTextAnchor(text, 'comment', 6, 11);
const edit = { start: 0, end: 0, insert: 'A ' };
const updated = applyTextEdit(text, edit);
const mapped = mapTextAnchor(anchor, text, edit, updated);
assert.equal(mapped.anchor.start, 8);
assert.equal(mapped.status, 'exact');
assert.equal(inspectTextAnchor(mapped.anchor, updated).status, 'exact');
```

CommonJS exposes the same API: `const api = require('@lp-labs/annotation-anchors')`.

## Scope, customization and performance

Text-only anchors; no structural node anchors. Offsets count Unicode code points, not UTF-16 units or grapheme clusters. Text ceiling 1,000,000 points; context max 128, quote max 4,096 for bounded fallback search. Exact mapping first, then quote matches ranked by before/after context. Tied best candidates are ambiguous; missing quote is orphan. Orphan/ambiguous result must be resolved before reusing anchor. Caller supplies exact edit and resulting text; no diff inference. Search may cost O(text length times quote length).

Configure explicit limits, clocks, policies and adapters through the API below. Error classes and standard TypeError/RangeError reject malformed input; adapter/handler errors propagate. Await asynchronous methods and handle rejection in your application; no success-shaped fallback on failed work. Inputs must be trusted ordinary data, not hostile proxies; adapters must meet documented atomicity, isolation and ownership contracts. This package never publishes data, loads external code or starts background services at import time.

## API reference

The complete exported TypeScript contract (including option defaults discussed above, method return shapes, and error codes) is included below. TypeScript users import interfaces using `import type`; JavaScript users pass matching ordinary objects. Signature optionals indicate intentionally optional fields, not silent recovery.

```ts
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
export declare class AnchorError extends Error {
  readonly code: 'invalid' | 'capacity';
  constructor(code: 'invalid' | 'capacity', message: string);
}
export declare function createTextAnchor(
  text: string,
  id: string,
  start: number,
  end: number,
  contextLength?: number,
): TextAnchor;
export declare function applyTextEdit(text: string, edit: TextEdit): string;
export declare function mapTextAnchor(
  anchor: TextAnchor,
  oldText: string,
  edit: TextEdit,
  newText?: string,
): AnchorDiagnostic;
export declare function inspectTextAnchor(anchor: TextAnchor, text: string): AnchorDiagnostic;
```

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
