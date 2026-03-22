import { clamp, num } from "./utils.mjs";

export function createNativeCameraState(overrides = {}) {
  return normalizeNativeCameraState({
    focusX: overrides.focusX,
    focusY: overrides.focusY,
    yaw: overrides.yaw,
    pitch: overrides.pitch,
    zoom: overrides.zoom
  });
}

export function normalizeNativeCameraState(cameraState = {}) {
  const focusX = Number(cameraState?.focusX);
  const focusY = Number(cameraState?.focusY);
  return {
    focusX: Number.isFinite(focusX) ? focusX : null,
    focusY: Number.isFinite(focusY) ? focusY : null,
    yaw: clamp(Number.isFinite(Number(cameraState?.yaw)) ? Number(cameraState.yaw) : -Math.PI / 4, -Math.PI, Math.PI),
    pitch: clamp(Number.isFinite(Number(cameraState?.pitch)) ? Number(cameraState.pitch) : Math.PI / 5.4, 0.18, Math.PI / 2.25),
    zoom: clamp(Number.isFinite(Number(cameraState?.zoom)) ? Number(cameraState.zoom) : 1, 0.45, 2.4)
  };
}

export function resolveNativeCameraState(cameraState = {}, options = {}) {
  const normalized = normalizeNativeCameraState(cameraState);
  const followTarget = options?.followTarget;
  if (!followTarget || typeof followTarget !== "object") {
    return normalized;
  }

  return {
    ...normalized,
    focusX: num(followTarget?.x, 0) + Math.max(0, num(followTarget?.w, 0)) * 0.5 + num(options?.offsetX, 0),
    focusY: num(followTarget?.y, 0) + Math.max(0, num(followTarget?.h, 0)) * 0.5 + num(options?.offsetY, 0)
  };
}

export function createNativePreviewConfig(scene, camera, viewport, options = {}) {
  const width = Math.max(1, num(viewport?.width, 320));
  const height = Math.max(1, num(viewport?.height, 220));
  const viewWidth = Math.max(240, num(camera?.w, scene?.world?.width || 1200));
  const viewHeight = Math.max(240, num(camera?.h, scene?.world?.height || 700));
  const tileSize = Math.max(16, num(scene?.world?.tileSize, 32));
  const cameraState = normalizeNativeCameraState(options);
  const baseScale = clamp(Math.min(width / viewWidth, height / viewHeight) * 1.15, 0.04, 0.32);

  return {
    width,
    height,
    centerX: Math.round(width * 0.5),
    centerY: Math.round(height * 0.7),
    focusX: cameraState.focusX ?? (num(camera?.x, 0) + viewWidth * 0.5),
    focusY: cameraState.focusY ?? (num(camera?.y, 0) + viewHeight * 0.5),
    scale: clamp(baseScale * cameraState.zoom, 0.03, 0.72),
    yaw: cameraState.yaw,
    pitch: cameraState.pitch,
    fov: 520,
    tileSize,
    zoom: cameraState.zoom
  };
}

export function projectNativePoint(point, config) {
  const worldX = num(point?.x, 0) - num(config?.focusX, 0);
  const worldY = num(point?.y, 0) - num(config?.focusY, 0);
  const worldZ = num(point?.z, 0);
  const yaw = config?.yaw || 0;
  const pitch = config?.pitch || 0;

  const x1 = worldX * Math.cos(yaw) - worldY * Math.sin(yaw);
  const z1 = worldX * Math.sin(yaw) + worldY * Math.cos(yaw);
  const y1 = worldZ;

  const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const depth = z1 * Math.cos(pitch) + y1 * Math.sin(pitch);
  const perspective = (config?.scale || 0.1) * ((config?.fov || 520) / Math.max(120, (config?.fov || 520) + depth));

  return {
    x: num(config?.centerX, 0) + x1 * perspective,
    y: num(config?.centerY, 0) - y2 * perspective,
    depth
  };
}

export function unprojectNativePoint(point, config, z = 0) {
  const screenX = Number(point?.x ?? 0) - Number(config?.centerX ?? 0);
  const screenY = Number(config?.centerY ?? 0) - Number(point?.y ?? 0);
  const worldZ = Number(z ?? 0);
  const yaw = config?.yaw || 0;
  const pitch = config?.pitch || 0;
  const scale = Math.max(0.0001, Number(config?.scale ?? 0.1));
  const fov = Math.max(120, Number(config?.fov ?? 520));
  const k = scale * fov;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const denominator = screenY * cosPitch + k * sinPitch;
  const safeDenominator = Math.abs(denominator) < 0.0001 ? (denominator < 0 ? -0.0001 : 0.0001) : denominator;
  const z1 = (k * worldZ * cosPitch - screenY * (fov + worldZ * sinPitch)) / safeDenominator;
  const perspective = k / Math.max(120, fov + z1 * cosPitch + worldZ * sinPitch);
  const x1 = screenX / Math.max(0.0001, perspective);

  return {
    x: Number(config?.focusX ?? 0) + x1 * cosYaw + z1 * sinYaw,
    y: Number(config?.focusY ?? 0) - x1 * sinYaw + z1 * cosYaw,
    z: worldZ
  };
}

export function projectNativeGuideSegment(axis, guide, config, z = 0) {
  if (!guide) {
    return null;
  }

  const normalizedAxis = axis === "horizontal" ? "horizontal" : "vertical";
  const startPoint = normalizedAxis === "vertical"
    ? { x: num(guide?.value, 0), y: num(guide?.start, 0), z }
    : { x: num(guide?.start, 0), y: num(guide?.value, 0), z };
  const endPoint = normalizedAxis === "vertical"
    ? { x: num(guide?.value, 0), y: num(guide?.end, 0), z }
    : { x: num(guide?.end, 0), y: num(guide?.value, 0), z };

  return {
    start: projectNativePoint(startPoint, config),
    end: projectNativePoint(endPoint, config)
  };
}

export function getNativeObjectHeight(object, scene, options = {}) {
  const tileSize = Math.max(16, num(scene?.world?.tileSize, 32));
  const objectType = String(object?.type || "");
  const doorOpenAmount = clamp(num(options?.doorOpenAmount, object?.isOpen === true ? 1 : 0), 0, 1);

  if (objectType === "player" || objectType === "enemy") {
    return Math.round(tileSize * 1.5);
  }

  if (objectType === "door") {
    return Math.max(8, Math.round(tileSize * 2.2 * (1 - doorOpenAmount * 0.82)));
  }

  if (objectType === "trigger" || objectType === "spawn" || objectType === "checkpoint" || objectType === "portal") {
    return Math.round(tileSize * 0.85);
  }

  return Math.max(12, Math.round(tileSize * 1.2));
}

export function createNativePrism(object, scene, config, options = {}) {
  const baseZ = num(object?.z, 0);
  const topZ = baseZ + getNativeObjectHeight(object, scene, options);
  const x = num(object?.x, 0);
  const y = num(object?.y, 0);
  const w = Math.max(4, num(object?.w, 8));
  const h = Math.max(4, num(object?.h, 8));

  const base = [
    { x, y, z: baseZ },
    { x: x + w, y, z: baseZ },
    { x: x + w, y: y + h, z: baseZ },
    { x, y: y + h, z: baseZ }
  ];
  const top = base.map((point) => ({ ...point, z: topZ }));

  const projectedBase = base.map((point) => projectNativePoint(point, config));
  const projectedTop = top.map((point) => projectNativePoint(point, config));
  const avgDepth =
    [...projectedBase, ...projectedTop].reduce((total, point) => total + point.depth, 0) / Math.max(1, projectedBase.length + projectedTop.length);

  return {
    object,
    base,
    top,
    projectedBase,
    projectedTop,
    depth: avgDepth
  };
}

export function getNativePrismBounds(prism) {
  const points = [...(prism?.projectedBase || []), ...(prism?.projectedTop || [])];
  if (points.length === 0) {
    return null;
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.max(1, Math.round(maxX - minX)),
    h: Math.max(1, Math.round(maxY - minY)),
    depth: prism?.depth || 0
  };
}

export function projectNativeRect(object, scene, config, options = {}) {
  const prism = createNativePrism(object, scene, config, options);
  return {
    prism,
    rect: getNativePrismBounds(prism)
  };
}
