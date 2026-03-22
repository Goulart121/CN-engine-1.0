import { SCENE_SPACE_MODES } from "./constants.mjs";
import { clamp, num } from "./utils.mjs";

export function normalizeSceneSpaceMode(mode) {
  const cleanMode = String(mode || "2d");
  return SCENE_SPACE_MODES.includes(cleanMode) ? cleanMode : "2d";
}

export function isScene3DPreview(sceneOrMode) {
  if (sceneOrMode && typeof sceneOrMode === "object") {
    return normalizeSceneSpaceMode(sceneOrMode?.space?.mode) === "3d-preview";
  }

  return normalizeSceneSpaceMode(sceneOrMode) === "3d-preview";
}

export function clampSceneDepth(z, world) {
  const depth = Math.max(1, num(world?.depth, 2000));
  return clamp(num(z, 0), 0, depth);
}

export function getSceneDepthOffset(z, world) {
  const tileSize = Math.max(16, num(world?.tileSize, 32));
  const units = clampSceneDepth(z, world) / tileSize;
  return {
    x: clamp(Math.round(units * 6), 0, 220),
    y: clamp(Math.round(units * 4), 0, 160)
  };
}

export function projectScenePoint(point, camera, scene) {
  const baseX = num(point?.x, 0) - num(camera?.x, 0);
  const baseY = num(point?.y, 0) - num(camera?.y, 0);

  if (!isScene3DPreview(scene)) {
    return { x: baseX, y: baseY };
  }

  const offset = getSceneDepthOffset(point?.z, scene?.world);
  return {
    x: baseX + offset.x,
    y: baseY - offset.y
  };
}

export function unprojectScenePoint(point, camera, z, scene) {
  const offset = isScene3DPreview(scene) ? getSceneDepthOffset(z, scene?.world) : { x: 0, y: 0 };
  return {
    x: num(point?.x, 0) + num(camera?.x, 0) - offset.x,
    y: num(point?.y, 0) + num(camera?.y, 0) + offset.y,
    z: clampSceneDepth(z, scene?.world)
  };
}

export function projectSceneRect(object, camera, scene) {
  const point = projectScenePoint(object, camera, scene);
  const offset = isScene3DPreview(scene) ? getSceneDepthOffset(object?.z, scene?.world) : { x: 0, y: 0 };
  return {
    x: point.x,
    y: point.y,
    w: Math.max(0, num(object?.w, 0)),
    h: Math.max(0, num(object?.h, 0)),
    offsetX: offset.x,
    offsetY: offset.y
  };
}
