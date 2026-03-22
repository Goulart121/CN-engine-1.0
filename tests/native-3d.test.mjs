import test from "node:test";
import assert from "node:assert/strict";

import { createNativeCameraState, createNativePreviewConfig, createNativePrism, getNativeObjectHeight, projectNativeGuideSegment, projectNativePoint, projectNativeRect, resolveNativeCameraState, unprojectNativePoint } from "../public/app/native-3d.mjs";
import { createDefaultScene, createGameplayObject } from "../public/app/core-scene.mjs";

test("createNativePreviewConfig usa camera atual como foco", () => {
  const scene = createDefaultScene();
  const config = createNativePreviewConfig(scene, { x: 120, y: 80, w: 640, h: 360 }, { width: 320, height: 220 });

  assert.equal(config.focusX, 440);
  assert.equal(config.focusY, 260);
  assert.equal(config.width, 320);
});

test("createNativeCameraState normaliza foco, angulos e zoom customizados", () => {
  const camera = createNativeCameraState({
    focusX: "420",
    focusY: 260,
    yaw: -0.7,
    pitch: 0.55,
    zoom: 1.4
  });
  const scene = createDefaultScene();
  const config = createNativePreviewConfig(scene, { x: 0, y: 0, w: 640, h: 360 }, { width: 320, height: 220 }, camera);

  assert.equal(camera.focusX, 420);
  assert.equal(camera.focusY, 260);
  assert.equal(camera.zoom, 1.4);
  assert.equal(config.focusX, 420);
  assert.equal(config.focusY, 260);
  assert.equal(config.zoom, 1.4);
});

test("resolveNativeCameraState segue o alvo sem perder orientacao", () => {
  const camera = createNativeCameraState({ yaw: -0.7, pitch: 0.55, zoom: 1.2 });
  const resolved = resolveNativeCameraState(camera, {
    followTarget: { x: 100, y: 220, w: 40, h: 60 }
  });

  assert.equal(resolved.focusX, 120);
  assert.equal(resolved.focusY, 250);
  assert.equal(resolved.yaw, camera.yaw);
  assert.equal(resolved.zoom, camera.zoom);
});

test("projectNativePoint projeta ponto 3D em coordenadas de tela", () => {
  const scene = createDefaultScene();
  const config = createNativePreviewConfig(scene, { x: 0, y: 0, w: 640, h: 360 }, { width: 320, height: 220 });
  const point = projectNativePoint({ x: 320, y: 180, z: 64 }, config);

  assert.equal(Number.isFinite(point.x), true);
  assert.equal(Number.isFinite(point.y), true);
  assert.equal(Number.isFinite(point.depth), true);
});

test("createNativePrism gera base e topo para objetos do mapa", () => {
  const scene = createDefaultScene();
  const door = createGameplayObject(scene, 1, "door", { x: 320, y: 320 });
  const config = createNativePreviewConfig(scene, { x: 0, y: 0, w: 640, h: 360 }, { width: 320, height: 220 });
  const prism = createNativePrism(door, scene, config, { doorOpenAmount: 0.5 });

  assert.equal(prism.projectedBase.length, 4);
  assert.equal(prism.projectedTop.length, 4);
  assert.equal(getNativeObjectHeight(door, scene, { doorOpenAmount: 0.5 }) < getNativeObjectHeight(door, scene, { doorOpenAmount: 0 }), true);
});

test("unprojectNativePoint recupera o ponto original no mesmo plano z", () => {
  const scene = createDefaultScene();
  const config = createNativePreviewConfig(scene, { x: 0, y: 0, w: 640, h: 360 }, { width: 480, height: 320 });
  const source = { x: 420, y: 260, z: 96 };
  const projected = projectNativePoint(source, config);
  const restored = unprojectNativePoint(projected, config, source.z);

  assert.equal(Math.abs(restored.x - source.x) <= 1, true);
  assert.equal(Math.abs(restored.y - source.y) <= 1, true);
});

test("projectNativeRect gera bounds de selecao para o viewport nativo", () => {
  const scene = createDefaultScene();
  const portal = createGameplayObject(scene, 2, "portal", { x: 320, y: 240 });
  portal.z = 64;
  const config = createNativePreviewConfig(scene, { x: 0, y: 0, w: 640, h: 360 }, { width: 480, height: 320 });
  const projected = projectNativeRect(portal, scene, config);

  assert.equal(projected.rect.w > 0, true);
  assert.equal(projected.rect.h > 0, true);
  assert.equal(Number.isFinite(projected.rect.depth), true);
});

test("projectNativeGuideSegment projeta linhas de snap no viewport nativo", () => {
  const scene = createDefaultScene();
  const config = createNativePreviewConfig(scene, { x: 0, y: 0, w: 640, h: 360 }, { width: 480, height: 320 });
  const vertical = projectNativeGuideSegment("vertical", { value: 320, start: 64, end: 480 }, config);
  const horizontal = projectNativeGuideSegment("horizontal", { value: 240, start: 64, end: 480 }, config);

  assert.equal(Number.isFinite(vertical.start.x), true);
  assert.equal(Number.isFinite(vertical.end.y), true);
  assert.equal(Number.isFinite(horizontal.start.x), true);
  assert.equal(Number.isFinite(horizontal.end.y), true);
});
