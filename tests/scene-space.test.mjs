import test from "node:test";
import assert from "node:assert/strict";

import { projectScenePoint, projectSceneRect, normalizeSceneSpaceMode } from "../public/app/scene-space.mjs";

test("normalizeSceneSpaceMode aceita apenas modos suportados", () => {
  assert.equal(normalizeSceneSpaceMode("3d-preview"), "3d-preview");
  assert.equal(normalizeSceneSpaceMode("wireframe"), "2d");
});

test("projectScenePoint aplica offset quando a cena esta em 3d-preview", () => {
  const scene = {
    world: { depth: 2000, tileSize: 32 },
    space: { mode: "3d-preview" }
  };
  const projected = projectScenePoint({ x: 160, y: 120, z: 96 }, { x: 100, y: 80 }, scene);

  assert.equal(projected.x > 60, true);
  assert.equal(projected.y < 40, true);
});

test("projectSceneRect preserva tamanho do objeto no preview", () => {
  const scene = {
    world: { depth: 2000, tileSize: 32 },
    space: { mode: "3d-preview" }
  };
  const rect = projectSceneRect({ x: 200, y: 140, z: 128, w: 48, h: 64 }, { x: 120, y: 90 }, scene);

  assert.equal(rect.w, 48);
  assert.equal(rect.h, 64);
  assert.equal(rect.offsetX > 0, true);
  assert.equal(rect.offsetY > 0, true);
});
