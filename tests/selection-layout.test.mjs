import test from "node:test";
import assert from "node:assert/strict";

import { alignSelectionEntries, distributeSelectionEntries, getGroupHandleAtPoint, getSelectionBounds, resizeSelectionEntries } from "../public/app/selection-layout.mjs";

test("getSelectionBounds calcula bounding box do grupo", () => {
  const bounds = getSelectionBounds([
    { x: 10, y: 20, w: 30, h: 40 },
    { x: 80, y: 50, w: 10, h: 10 }
  ]);

  assert.deepEqual(bounds, { x: 10, y: 20, w: 80, h: 40 });
});

test("alignSelectionEntries alinha selecao a esquerda e no centro horizontal", () => {
  const entries = [
    { x: 20, y: 20, w: 10, h: 10 },
    { x: 80, y: 40, w: 20, h: 20 }
  ];

  assert.deepEqual(alignSelectionEntries(entries, "left").map((entry) => entry.x), [20, 20]);
  assert.deepEqual(alignSelectionEntries(entries, "h-center").map((entry) => entry.x), [55, 50]);
});

test("distributeSelectionEntries distribui no eixo X", () => {
  const entries = [
    { x: 0, y: 0, w: 10, h: 10 },
    { x: 15, y: 0, w: 10, h: 10 },
    { x: 50, y: 0, w: 10, h: 10 }
  ];

  const distributed = distributeSelectionEntries(entries, "x");
  assert.deepEqual(distributed.map((entry) => entry.x), [0, 25, 50]);
});

test("getGroupHandleAtPoint detecta handles do gizmo", () => {
  const bounds = { x: 100, y: 100, w: 80, h: 60 };

  assert.equal(getGroupHandleAtPoint(bounds, { x: 94, y: 94 }), "nw");
  assert.equal(getGroupHandleAtPoint(bounds, { x: 186, y: 166 }), "se");
  assert.equal(getGroupHandleAtPoint(bounds, { x: 140, y: 140 }), null);
});

test("resizeSelectionEntries escala grupo a partir do handle", () => {
  const entries = [
    { x: 100, y: 100, w: 20, h: 20 },
    { x: 140, y: 120, w: 20, h: 20 }
  ];

  const resized = resizeSelectionEntries(entries, "se", { x: 220, y: 200 });

  assert.equal(resized[0].x, 100);
  assert.equal(resized[0].y, 100);
  assert.equal(resized[0].w > 20, true);
  assert.equal(resized[1].x > 140, true);
  assert.equal(resized[1].y > 120, true);
});
