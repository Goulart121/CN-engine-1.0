import test from "node:test";
import assert from "node:assert/strict";

import { collectSnapLines, snapMoveBounds, snapResizeBounds } from "../public/app/selection-snap.mjs";

test("collectSnapLines gera linhas de objetos e mundo", () => {
  const lines = collectSnapLines([{ x: 10, y: 20, w: 30, h: 40 }], { width: 200, height: 100 });

  assert.equal(lines.vertical.some((line) => line.value === 10), true);
  assert.equal(lines.vertical.some((line) => line.value === 200), true);
  assert.equal(lines.horizontal.some((line) => line.value === 20), true);
  assert.equal(lines.horizontal.some((line) => line.value === 100), true);
});

test("snapMoveBounds aproxima grupo de linha mais proxima", () => {
  const lines = collectSnapLines([{ x: 100, y: 0, w: 20, h: 20 }], null);
  const snapped = snapMoveBounds({ x: 93, y: 10, w: 20, h: 20 }, lines, { threshold: 8 });

  assert.equal(snapped.bounds.x, 90);
  assert.equal(snapped.guides.vertical.length, 1);
});

test("snapResizeBounds aproxima handle leste ao alvo", () => {
  const lines = collectSnapLines([{ x: 180, y: 0, w: 20, h: 20 }], null);
  const snapped = snapResizeBounds({ x: 100, y: 100, w: 74, h: 40 }, "se", lines, { threshold: 8 });

  assert.equal(snapped.bounds.w, 80);
  assert.equal(snapped.guides.vertical.length, 1);
});
