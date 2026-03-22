import test from "node:test";
import assert from "node:assert/strict";

import { createHistoryManager } from "../public/app/history.mjs";

test("history manager faz undo e redo com snapshots", () => {
  const restored = [];

  const manager = createHistoryManager({
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  manager.record("Move Object", { x: 10 }, { x: 40 });

  const undoEntry = manager.undo((snapshot) => {
    restored.push({ kind: "undo", snapshot });
  });
  assert.equal(undoEntry.label, "Move Object");
  assert.deepEqual(restored[0], { kind: "undo", snapshot: { x: 10 } });

  const redoEntry = manager.redo((snapshot) => {
    restored.push({ kind: "redo", snapshot });
  });
  assert.equal(redoEntry.label, "Move Object");
  assert.deepEqual(restored[1], { kind: "redo", snapshot: { x: 40 } });
});

test("history manager agrupa transacao e ignora transacao sem mudança", () => {
  const restored = [];

  const manager = createHistoryManager({
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  });

  manager.begin("Paint Tiles", { tiles: [1] });
  const changed = manager.commit({ tiles: [1, 2, 3] });
  assert.equal(changed, true);

  manager.begin("Paint Tiles", { tiles: [1, 2, 3] });
  const unchanged = manager.commit({ tiles: [1, 2, 3] });
  assert.equal(unchanged, false);

  const entry = manager.undo((snapshot) => restored.push(snapshot));
  assert.equal(entry.label, "Paint Tiles");
  assert.deepEqual(restored[0], { tiles: [1] });
});
