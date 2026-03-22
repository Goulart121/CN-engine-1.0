export const SCENE3D_VERSION = 1;
export const SCENE3D_OBJECT_TYPES = ["cube", "plane"];

export function createDefaultScene3D(options = {}) {
  const sceneId = String(options.id || "scene3d_1").trim() || "scene3d_1";
  const sceneName = String(options.name || "Cena 3D 1").trim() || "Cena 3D 1";
  const defaultObjects = [
    createScene3DObject("plane", 1, { name: "Chao", y: -120, w: 1800, h: 24, d: 1800, color: "#6f7988" }),
    createScene3DObject("cube", 2, { name: "Cubo 1", x: 0, y: 0, z: 0, w: 220, h: 220, d: 220, color: "#8ad5ff" })
  ];
  return {
    id: sceneId,
    name: sceneName,
    version: SCENE3D_VERSION,
    world: {
      width: 3200,
      depth: 3200,
      height: 1600,
      grid: 100
    },
    camera: {
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      yaw: -0.75,
      pitch: 0.48,
      distance: 1800,
      fov: 920
    },
    cameraRig: createDefaultCameraRig3D(),
    play3d: createDefaultPlay3D(defaultObjects),
    terrain: createDefaultTerrain3D(),
    objects: defaultObjects
  };
}

export function createScene3DObject(type, index = 1, overrides = {}) {
  const normalizedType = normalizeObject3DType(type);
  const defaults = normalizedType === "plane"
    ? { w: 300, h: 20, d: 300, color: "#6f7988" }
    : { w: 180, h: 180, d: 180, color: "#8ad5ff" };

  return sanitizeScene3DObject({
    id: `obj3d_${index}`,
    name: normalizedType === "plane" ? `Plano ${index}` : `Cubo ${index}`,
    type: normalizedType,
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    sx: 1,
    sy: 1,
    sz: 1,
    ...defaults,
    ...overrides
  }, index);
}

export function getScene3DById(project, sceneId) {
  if (!project || !Array.isArray(project.scenes3d)) {
    return null;
  }

  return project.scenes3d.find((scene) => scene.id === sceneId) || null;
}

export function sanitizeScenes3D(source) {
  const scenes = Array.isArray(source) ? source : [];
  if (scenes.length === 0) {
    return [createDefaultScene3D()];
  }

  const usedIds = new Set();
  return scenes.map((scene, index) => sanitizeScene3D(scene, index, usedIds));
}

export function sanitizeScene3D(scene, index = 0, usedIds = null) {
  const fallback = createDefaultScene3D({ id: `scene3d_${index + 1}`, name: `Cena 3D ${index + 1}` });
  const source = scene && typeof scene === "object" ? scene : {};
  let sceneId = String(source.id || fallback.id).trim() || fallback.id;
  if (usedIds instanceof Set) {
    while (usedIds.has(sceneId)) {
      sceneId = `${sceneId}_copy`;
    }
    usedIds.add(sceneId);
  }

  const worldSource = source.world && typeof source.world === "object" ? source.world : {};
  const world = {
    width: clampMinNumber(worldSource.width, fallback.world.width, 400),
    depth: clampMinNumber(worldSource.depth, fallback.world.depth, 400),
    height: clampMinNumber(worldSource.height, fallback.world.height, 200),
    grid: clampMinNumber(worldSource.grid, fallback.world.grid, 20)
  };

  const cameraSource = source.camera && typeof source.camera === "object" ? source.camera : {};
  const camera = {
    targetX: sanitizeNumber(cameraSource.targetX, fallback.camera.targetX),
    targetY: sanitizeNumber(cameraSource.targetY, fallback.camera.targetY),
    targetZ: sanitizeNumber(cameraSource.targetZ, fallback.camera.targetZ),
    yaw: sanitizeNumber(cameraSource.yaw, fallback.camera.yaw),
    pitch: clampNumber(cameraSource.pitch, fallback.camera.pitch, -Math.PI, Math.PI),
    distance: clampNumber(cameraSource.distance, fallback.camera.distance, 180, 9000),
    fov: clampNumber(cameraSource.fov, fallback.camera.fov, 280, 1800)
  };

  const objectsSource = Array.isArray(source.objects) ? source.objects : [];
  const usedObjectIds = new Set();
  const objects = objectsSource
    .map((entry, objectIndex) => {
      const next = sanitizeScene3DObject(entry, objectIndex + 1);
      if (!next) {
        return null;
      }

      let objectId = String(next.id || "").trim() || `obj3d_${objectIndex + 1}`;
      while (usedObjectIds.has(objectId)) {
        objectId = `${objectId}_copy`;
      }
      usedObjectIds.add(objectId);
      next.id = objectId;
      return next;
    })
    .filter(Boolean);
  const safeObjects = objects.length > 0 ? objects : fallback.objects.map((entry) => ({ ...entry }));
  const cameraRig = sanitizeCameraRig3D(source.cameraRig, fallback.cameraRig);
  const terrain = sanitizeTerrain3D(source.terrain, fallback.terrain);
  const play3d = sanitizePlay3D(source.play3d, fallback.play3d, safeObjects);

  return {
    id: sceneId,
    name: String(source.name || fallback.name),
    version: SCENE3D_VERSION,
    world,
    camera,
    cameraRig,
    play3d,
    terrain,
    objects: safeObjects
  };
}

export function sanitizeScene3DObject(source, index = 1) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const type = normalizeObject3DType(source.type);
  const fallback = type === "plane"
    ? { w: 300, h: 20, d: 300, color: "#6f7988" }
    : { w: 180, h: 180, d: 180, color: "#8ad5ff" };

  return {
    id: String(source.id || `obj3d_${index}`),
    name: String(source.name || (type === "plane" ? `Plano ${index}` : `Cubo ${index}`)),
    type,
    x: sanitizeNumber(source.x, 0),
    y: sanitizeNumber(source.y, 0),
    z: sanitizeNumber(source.z, 0),
    rx: sanitizeNumber(source.rx, 0),
    ry: sanitizeNumber(source.ry, 0),
    rz: sanitizeNumber(source.rz, 0),
    sx: clampNumber(source.sx, 1, 0.05, 20),
    sy: clampNumber(source.sy, 1, 0.05, 20),
    sz: clampNumber(source.sz, 1, 0.05, 20),
    w: clampMinNumber(source.w, fallback.w, 10),
    h: clampMinNumber(source.h, fallback.h, 10),
    d: clampMinNumber(source.d, fallback.d, 10),
    color: sanitizeColor(source.color, fallback.color)
  };
}

export function normalizeObject3DType(type) {
  const clean = String(type || "cube").trim().toLowerCase();
  return SCENE3D_OBJECT_TYPES.includes(clean) ? clean : "cube";
}

export function nextScene3DId(project) {
  const ids = new Set((project?.scenes3d || []).map((scene) => scene.id));
  let index = 1;
  while (ids.has(`scene3d_${index}`)) {
    index += 1;
  }
  return `scene3d_${index}`;
}

export function nextScene3DName(project, baseName = "Cena 3D") {
  const names = new Set((project?.scenes3d || []).map((scene) => scene.name));
  if (!names.has(baseName)) {
    return baseName;
  }

  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (names.has(candidate)) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }
  return candidate;
}

export function nextObject3DCounter(scene) {
  const ids = new Set((scene?.objects || []).map((item) => String(item.id || "")));
  let index = 1;
  while (ids.has(`obj3d_${index}`)) {
    index += 1;
  }
  return index;
}

function sanitizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value, fallback, min, max) {
  const numeric = sanitizeNumber(value, fallback);
  return Math.max(min, Math.min(max, numeric));
}

function clampMinNumber(value, fallback, min) {
  const numeric = sanitizeNumber(value, fallback);
  return Math.max(min, numeric);
}

function sanitizeColor(value, fallback = "#8ad5ff") {
  const color = String(value || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    return color;
  }

  return fallback;
}

function createDefaultCameraRig3D() {
  return {
    mode: "third-person",
    minPitch: -1.45,
    maxPitch: 1.45,
    firstPerson: {
      eyeHeight: 64,
      bobAmplitude: 7,
      bobSpeed: 8.5,
      smooth: 0.24
    },
    thirdPerson: {
      distance: 620,
      height: 180,
      shoulder: 70,
      smooth: 0.16
    }
  };
}

function sanitizeCameraRig3D(source, fallback = createDefaultCameraRig3D()) {
  const safe = source && typeof source === "object" ? source : {};
  const firstPersonSource = safe.firstPerson && typeof safe.firstPerson === "object" ? safe.firstPerson : {};
  const thirdPersonSource = safe.thirdPerson && typeof safe.thirdPerson === "object" ? safe.thirdPerson : {};
  return {
    mode: String(safe.mode || fallback.mode).trim().toLowerCase() === "first-person" ? "first-person" : "third-person",
    minPitch: clampNumber(safe.minPitch, fallback.minPitch, -Math.PI, Math.PI),
    maxPitch: clampNumber(safe.maxPitch, fallback.maxPitch, -Math.PI, Math.PI),
    firstPerson: {
      eyeHeight: clampNumber(firstPersonSource.eyeHeight, fallback.firstPerson.eyeHeight, 0, 320),
      bobAmplitude: clampNumber(firstPersonSource.bobAmplitude, fallback.firstPerson.bobAmplitude, 0, 80),
      bobSpeed: clampNumber(firstPersonSource.bobSpeed, fallback.firstPerson.bobSpeed, 0, 30),
      smooth: clampNumber(firstPersonSource.smooth, fallback.firstPerson.smooth, 0.01, 1)
    },
    thirdPerson: {
      distance: clampNumber(thirdPersonSource.distance, fallback.thirdPerson.distance, 120, 3000),
      height: clampNumber(thirdPersonSource.height, fallback.thirdPerson.height, -300, 1200),
      shoulder: clampNumber(thirdPersonSource.shoulder, fallback.thirdPerson.shoulder, -300, 300),
      smooth: clampNumber(thirdPersonSource.smooth, fallback.thirdPerson.smooth, 0.01, 1)
    }
  };
}

function createDefaultPlay3D(objects = []) {
  const preferredPlayer = Array.isArray(objects)
    ? objects.find((entry) => entry.type !== "plane") || objects[0]
    : null;

  return {
    playerObjectId: String(preferredPlayer?.id || ""),
    moveSpeed: 280,
    sprintMultiplier: 1.7,
    lookSensitivity: 0.0045
  };
}

function sanitizePlay3D(source, fallback = createDefaultPlay3D(), objects = []) {
  const safe = source && typeof source === "object" ? source : {};
  const defaultPlayer = createDefaultPlay3D(objects).playerObjectId;
  const objectIds = new Set((Array.isArray(objects) ? objects : []).map((entry) => String(entry.id || "")));
  const candidatePlayerId = String(safe.playerObjectId || fallback.playerObjectId || defaultPlayer || "");
  const playerObjectId = objectIds.has(candidatePlayerId) ? candidatePlayerId : defaultPlayer;
  return {
    playerObjectId,
    moveSpeed: clampNumber(safe.moveSpeed, fallback.moveSpeed, 20, 1800),
    sprintMultiplier: clampNumber(safe.sprintMultiplier, fallback.sprintMultiplier, 1, 4),
    lookSensitivity: clampNumber(safe.lookSensitivity, fallback.lookSensitivity, 0.001, 0.03)
  };
}

function createDefaultTerrain3D() {
  const resolutionX = 33;
  const resolutionZ = 33;
  const length = resolutionX * resolutionZ;
  return {
    enabled: true,
    resolutionX,
    resolutionZ,
    cellSize: 120,
    maxHeight: 420,
    brush: {
      preset: "soft-circle",
      radius: 3,
      strength: 0.9,
      targetHeight: 0,
      shape: "circle",
      hardness: 0.3,
      spacing: 0.08,
      noiseScale: 0.24,
      erosionStrength: 1
    },
    heights: Array.from({ length }, () => 0)
  };
}

function sanitizeTerrain3D(source, fallback = createDefaultTerrain3D()) {
  const safe = source && typeof source === "object" ? source : {};
  const resolutionX = Math.max(8, Math.min(129, Math.round(clampMinNumber(safe.resolutionX, fallback.resolutionX, 8))));
  const resolutionZ = Math.max(8, Math.min(129, Math.round(clampMinNumber(safe.resolutionZ, fallback.resolutionZ, 8))));
  const expected = resolutionX * resolutionZ;
  const sourceHeights = Array.isArray(safe.heights) ? safe.heights : fallback.heights;
  const brushSource = safe.brush && typeof safe.brush === "object" ? safe.brush : {};
  const shape = String(brushSource.shape || fallback.brush.shape).trim().toLowerCase();
  const heights = Array.from({ length: expected }, (_, index) => {
    const value = Number(sourceHeights[index]);
    return Number.isFinite(value) ? value : 0;
  });
  return {
    enabled: safe.enabled !== false,
    resolutionX,
    resolutionZ,
    cellSize: clampNumber(safe.cellSize, fallback.cellSize, 20, 400),
    maxHeight: clampNumber(safe.maxHeight, fallback.maxHeight, 20, 2000),
    brush: {
      preset: String(brushSource.preset || fallback.brush.preset || "soft-circle"),
      radius: Math.max(1, Math.min(20, Math.round(clampNumber(brushSource.radius, fallback.brush.radius, 1, 20)))),
      strength: clampNumber(brushSource.strength, fallback.brush.strength, 0.05, 4),
      targetHeight: clampNumber(brushSource.targetHeight, fallback.brush.targetHeight, -2000, 2000),
      shape: ["circle", "square", "diamond"].includes(shape) ? shape : "circle",
      hardness: clampNumber(brushSource.hardness, fallback.brush.hardness, 0, 1),
      spacing: clampNumber(brushSource.spacing, fallback.brush.spacing, 0, 2),
      noiseScale: clampNumber(brushSource.noiseScale, fallback.brush.noiseScale, 0.01, 3),
      erosionStrength: clampNumber(brushSource.erosionStrength, fallback.brush.erosionStrength, 0.1, 4)
    },
    heights
  };
}
