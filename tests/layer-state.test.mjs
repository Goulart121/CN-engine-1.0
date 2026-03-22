import test from "node:test";
import assert from "node:assert/strict";

import {
  collidesWithCollisionLayer,
  collectBrushCells,
  createGameplayObject,
  createDefaultScene,
  createInitialState,
  floodFillTiles,
  getCollisionRectsForBody,
  pickAt,
  paintTile,
  paintTileLine,
  paintTileRect,
  pickArea,
  resolveAnimatedTileId,
  resolveRandomPaintTileId,
  rebuildTileMap
} from "../public/app/core-scene.mjs";
import { createNativePreviewConfig, projectNativeRect } from "../public/app/native-3d.mjs";

test("createInitialState inicia layerSettings com visibilidade e lock padrao", () => {
  const state = createInitialState();

  assert.deepEqual(state.layerSettings, {
    background: { visible: true, locked: false },
    gameplay: { visible: true, locked: false },
    collision: { visible: true, locked: false },
    foreground: { visible: true, locked: false }
  });
});

test("paintTile escreve no layer selecionado sem afetar os demais", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  const changed = paintTile(scene, state.tileMaps, "foreground", 40, 40, 3);
  assert.equal(changed, true);

  const foregroundTile = scene.layers.foreground.find((tile) => tile.x === 1 && tile.y === 1);
  assert.deepEqual(foregroundTile, { x: 1, y: 1, tile: 3 });

  const gameplayTile = scene.layers.gameplay.find((tile) => tile.x === 1 && tile.y === 1);
  assert.deepEqual(gameplayTile, { x: 1, y: 1, tile: 1 });
});

test("resolveRandomPaintTileId usa pool do tile selecionado", () => {
  assert.equal(resolveRandomPaintTileId(1, () => 0), 1);
  assert.equal(resolveRandomPaintTileId(1, () => 0.99), 9);
  assert.equal(resolveRandomPaintTileId(999, () => 0.5), 0);
});

test("paintTileRect pinta uma area inteira na layer ativa", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  const changed = paintTileRect(scene, state.tileMaps, "background", { x: 0, y: 0 }, { x: 63, y: 63 }, 4);
  assert.equal(changed, true);
  assert.equal(scene.layers.background.length, 4);
});

test("paintTileLine desenha uma linha diagonal de tiles", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  const changed = paintTileLine(scene, state.tileMaps, "foreground", { x: 0, y: 0 }, { x: 96, y: 96 }, 3);
  assert.equal(changed, true);
  assert.equal(scene.layers.foreground.length, 4);
});

test("paintTileLine aceita espessura e brush circular", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  const changed = paintTileLine(scene, state.tileMaps, "foreground", { x: 0, y: 0 }, { x: 96, y: 96 }, 3, {
    thickness: 3,
    brushShape: "circle"
  });
  assert.equal(changed, true);
  assert.equal(scene.layers.foreground.length > 4, true);
  assert.equal(scene.layers.foreground.some((tile) => tile.x === 1 && tile.y === 0), true);
});

test("collectBrushCells suporta formato circular no tilemap", () => {
  const scene = createDefaultScene();
  const cells = collectBrushCells(scene, { tx: 8, ty: 6 }, { size: 4, shape: "circle" });

  assert.equal(cells.some((cell) => cell.tx === 8 && cell.ty === 6), true);
  assert.equal(cells.length < 16, true);
});

test("floodFillTiles preenche area conectada sem vazar para outra layer", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  paintTile(scene, state.tileMaps, "background", 0, 0, 2);
  paintTile(scene, state.tileMaps, "background", 32, 0, 2);
  paintTile(scene, state.tileMaps, "background", 0, 32, 2);

  const changed = floodFillTiles(scene, state.tileMaps, "background", 0, 0, 5);
  assert.equal(changed, true);
  assert.equal(scene.layers.background.filter((tile) => tile.tile === 5).length, 3);
});

test("paintTile aplica rule tile por vizinhanca automatica", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  paintTile(scene, state.tileMaps, "background", 0, 0, 6);
  paintTile(scene, state.tileMaps, "background", 32, 0, 6);
  paintTile(scene, state.tileMaps, "background", 0, 32, 6);
  paintTile(scene, state.tileMaps, "background", 32, 32, 6);

  const centerA = scene.layers.background.find((tile) => tile.x === 0 && tile.y === 0);
  const centerB = scene.layers.background.find((tile) => tile.x === 1 && tile.y === 1);

  assert.equal(centerA.tile, 8);
  assert.equal(centerB.tile, 8);
});

test("resolveAnimatedTileId alterna frames com base no tempo", () => {
  assert.equal(resolveAnimatedTileId(11, 0), 11);
  assert.equal(resolveAnimatedTileId(11, 0.23), 12);
  assert.equal(resolveAnimatedTileId(11, 0.46), 13);
  assert.equal(resolveAnimatedTileId(2, 1.2), 2);
});

test("collidesWithCollisionLayer detecta tiles solidos da layer collision", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  paintTile(scene, state.tileMaps, "collision", 64, 64, 2);

  const collides = collidesWithCollisionLayer({ x: 64, y: 64, w: 30, h: 30 }, scene, state.tileMaps);
  assert.equal(collides, true);
});

test("getCollisionRectsForBody usa composite collider quando habilitado", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  rebuildTileMap(scene, state.tileMaps);

  paintTile(scene, state.tileMaps, "collision", 64, 64, 2);
  paintTile(scene, state.tileMaps, "collision", 96, 64, 2);
  paintTile(scene, state.tileMaps, "collision", 64, 96, 2);
  paintTile(scene, state.tileMaps, "collision", 96, 96, 2);

  const body = { x: 64, y: 64, w: 64, h: 64 };
  scene.physics = { compositeCollider: true, pixelPerfect: false, pixelScale: 1 };
  const merged = getCollisionRectsForBody(scene, state.tileMaps, body);
  scene.physics.compositeCollider = false;
  const singleTiles = getCollisionRectsForBody(scene, state.tileMaps, body);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], { x: 64, y: 64, w: 64, h: 64 });
  assert.equal(singleTiles.length, 4);
});

test("createGameplayObject cria portal com targetSceneId padrao", () => {
  const scene = createDefaultScene({ id: "scene_test", name: "Scene Test" });
  const portal = createGameplayObject(scene, 2, "portal", { x: 64, y: 96 });

  assert.equal(portal.id, "go_2");
  assert.equal(portal.type, "portal");
  assert.equal(portal.targetSceneId, "scene_test");
  assert.equal(portal.targetSpawnTag, "player_start");
  assert.equal(portal.fallbackMode, "priority");
});

test("pickArea seleciona gameplay object na frente e informa quantidade", () => {
  const scene = createDefaultScene();
  const portal = createGameplayObject(scene, 1, "portal", { x: 320, y: 320 });
  scene.gameObjects.push(portal);

  const result = pickArea(scene, { x: 300, y: 300 }, { x: 360, y: 400 });

  assert.deepEqual(result, {
    ref: { kind: "gameplayObject", id: portal.id },
    refs: [{ kind: "wall", id: "wall_1" }, { kind: "gameplayObject", id: portal.id }],
    count: 2
  });
});

test("pickAt usa projeção do 3d-preview quando camera e z estao ativos", () => {
  const scene = createDefaultScene();
  scene.space.mode = "3d-preview";
  const portal = createGameplayObject(scene, 1, "portal", { x: 320, y: 320 });
  portal.z = 96;
  scene.gameObjects.push(portal);

  const hit = pickAt(scene, 338, 308, { camera: { x: 0, y: 0 } });

  assert.deepEqual(hit, { kind: "gameplayObject", id: portal.id });
});

test("pickAt suporta bounds do viewport native-3d", () => {
  const scene = createDefaultScene();
  const portal = createGameplayObject(scene, 2, "portal", { x: 320, y: 240 });
  portal.z = 64;
  scene.gameObjects.push(portal);
  const viewport = { width: 480, height: 320 };
  const camera = { x: 0, y: 0, w: 640, h: 360 };
  const config = createNativePreviewConfig(scene, camera, viewport);
  const projected = projectNativeRect(portal, scene, config);
  const point = {
    x: projected.rect.x + projected.rect.w / 2,
    y: projected.rect.y + projected.rect.h / 2
  };

  const hit = pickAt(scene, point.x, point.y, {
    camera,
    viewportRenderer: "native-3d",
    viewport
  });

  assert.deepEqual(hit, { kind: "gameplayObject", id: portal.id });
});
