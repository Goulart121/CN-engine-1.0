import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultScene, validTransform, validateScene } from "../public/app/core-scene.mjs";

function createBaseJson() {
  return {
    world: { width: 1200, height: 800, tileSize: 32 },
    player: { x: 80, y: 80, w: 30, h: 30, speed: 180 },
    enemy: { x: 500, y: 400, w: 30, h: 30, speed: 120, patrol: [{ x: 500, y: 400 }] },
    walls: [{ id: "wall_1", x: 700, y: 120, w: 100, h: 32 }],
    tiles: []
  };
}

test("validateScene rejeita quando player colide com wall", () => {
  const json = createBaseJson();
  json.walls = [{ id: "wall_1", x: 70, y: 70, w: 80, h: 80 }];

  const result = validateScene(json);

  assert.equal(result.ok, false);
  assert.match(result.message, /colidindo/i);
});

test("validateScene aceita cena valida sem colisao", () => {
  const json = createBaseJson();
  json.variables = { gate_open: 1 };
  const result = validateScene(json);

  assert.equal(result.ok, true);
  assert.ok(result.scene);
  assert.equal(Array.isArray(result.scene.layers.gameplay), true);
  assert.equal("tiles" in result.scene, false);
  assert.deepEqual(result.scene.variables, { gate_open: "1" });
  assert.deepEqual(result.scene.variableMeta, { gate_open: { type: "number", preset: "none" } });
});

test("validateScene rejeita quando player nasce em collision tile", () => {
  const json = createBaseJson();
  json.layers = {
    background: [],
    gameplay: [],
    collision: [{ x: 2, y: 2, tile: 2 }],
    foreground: []
  };

  const result = validateScene(json);

  assert.equal(result.ok, false);
  assert.match(result.message, /tiles de colisao/i);
});

test("validateScene rejeita gameplay object solido em collision tile", () => {
  const json = createBaseJson();
  json.gameObjects = [
    {
      id: "go_1",
      name: "Portal 1",
      type: "portal",
      x: 320,
      y: 320,
      w: 32,
      h: 64,
      targetSceneId: "scene_2"
    }
  ];
  json.layers = {
    background: [],
    gameplay: [],
    collision: [{ x: 10, y: 10, tile: 2 }],
    foreground: []
  };

  const result = validateScene(json);

  assert.equal(result.ok, false);
  assert.match(result.message, /gameObject invalido/i);
});

test("validTransform bloqueia mover player para dentro de wall", () => {
  const scene = createDefaultScene();
  const wall = scene.walls[0];

  const candidatePlayer = {
    ...scene.player,
    x: wall.x + 2,
    y: wall.y + 2
  };

  const isValid = validTransform(scene, { kind: "entity", id: "player" }, candidatePlayer);
  assert.equal(isValid, false);
});

test("validTransform bloqueia wall sobre enemy", () => {
  const scene = createDefaultScene();
  const candidateWall = {
    ...scene.walls[0],
    id: "wall_new",
    x: scene.enemy.x,
    y: scene.enemy.y,
    w: scene.enemy.w,
    h: scene.enemy.h
  };

  const isValid = validTransform(scene, { kind: "wall", id: "wall_new" }, candidateWall);
  assert.equal(isValid, false);
});
