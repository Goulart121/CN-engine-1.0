import { RIGIDBODY_TYPES, SCENE_VERSION, SORTING_LAYERS, SURFACE_MATERIAL_IDS, TILE_BY_ID, TILE_LAYERS, TRIGGER_ACTION_TYPES, TRIGGER_CONDITION_TYPES, VARIABLE_PRESETS, VARIABLE_TYPES } from "./constants.mjs";
import { migrateSceneData } from "./scene-migrations.mjs";
import { createNativePreviewConfig, projectNativeRect } from "./native-3d.mjs";
import { clampSceneDepth, normalizeSceneSpaceMode, projectSceneRect } from "./scene-space.mjs";
import { clampWorld, collides, num, overlap, sameRef, snap } from "./utils.mjs";

export function createInitialState() {
  return {
    mode: "edit",
    workspaceMode: "2d",
    viewportRenderer: "scene",
    tool: "select",
    paintTool: "brush",
    paintBrushShape: "square",
    paintBrushSize: 1,
    paintLineThickness: 1,
    autoTileEnabled: true,
    showGrid: true,
    showColliders: true,
    showLabels: true,
    tileLayer: "gameplay",
    tileId: 1,
    selected: { kind: "entity", id: "player" },
    selectedRefs: [{ kind: "entity", id: "player" }],
    tileMaps: createLayerMapState(),
    layerSettings: createLayerSettingsState(),
    paintPreview: { active: false, start: null, end: null, erase: false, shape: "rect", brushShape: "square", lineThickness: 1 },
    selectionBox: { active: false, projected: false, start: null, end: null },
    snapGuides: { ttl: 0, vertical: [], horizontal: [] },
    playSnapshot: null,
    playRuntime: createPlayRuntimeState(),
    wallCounter: 4,
    gameplayCounter: 1,
    cam: { x: 0, y: 0, w: 1, h: 1 },
    editorCameraManual: null,
    editorZoomOverride: null,
    nativeCamera: { focusX: null, focusY: null, yaw: -Math.PI / 4, pitch: Math.PI / 5.4, zoom: 1 },
    input: { up: false, down: false, left: false, right: false, run: false, interactQueued: false, pauseQueued: false },
    drag: { active: false, ref: null, ox: 0, oy: 0 },
    fpsTick: 0,
    fpsFrames: 0,
    fpsValue: 0,
    last: performance.now()
  };
}

export function createDefaultScene(options = {}) {
  const gameplayTiles = [];
  for (let x = 0; x < 32; x += 1) {
    for (let y = 0; y < 18; y += 1) {
      gameplayTiles.push({ x, y, tile: 1 });
    }
  }

  const scene = {
    id: String(options.id || "scene_1"),
    name: String(options.name || "Cena 1"),
    version: SCENE_VERSION,
    world: { width: 3200, height: 1800, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    physics: {
      compositeCollider: true,
      pixelPerfect: false,
      pixelScale: 1,
      surfaceFriction: createDefaultSurfaceFriction()
    },
    sortingY: false,
    camera2D: {
      mode: "follow",
      damping: 0.16,
      deadZoneW: 220,
      deadZoneH: 132,
      lookAheadX: 24,
      lookAheadY: 16,
      confineToWorld: true,
      zoom: 1,
      followDuringEdit: true,
      shakeEnabled: true,
      shakeIntensity: 12,
      shakeDuration: 0.28,
      shakeFrequency: 32
    },
    lighting2D: {
      enabled: false,
      ambientColor: "#0b1220",
      ambientAlpha: 0.58,
      shadowLength: 110,
      shadowAlpha: 0.36
    },
    ui2D: {
      showHud: true,
      showHints: true,
      showPauseOverlay: true
    },
    audio2D: {
      enabled: true,
      masterVolume: 0.85,
      sfxVolume: 0.9,
      musicVolume: 0
    },
    player: {
      id: "player",
      name: "Jogador",
      type: "player",
      x: 140,
      y: 140,
      z: 0,
      w: 34,
      h: 34,
      speed: 210,
      runMultiplier: 1.75,
      color: "#8ad5ff",
      sortingLayer: "default",
      orderInLayer: 10,
      spriteId: "demo:player",
      flipX: false,
      flipY: false,
      pivotX: 0,
      pivotY: 0,
      animationId: "",
      animationFps: 8,
      animationLoop: true,
      animationMode: "loop",
      animationPlaying: true,
      animationOffset: 0,
      spriteOpacity: 1,
      rigidbodyType: "kinematic",
      gravityScale: 0,
      linearDamping: 0,
      restitution: 0,
      colliderEnabled: true,
      colliderIsTrigger: false,
      colliderOffsetX: 0,
      colliderOffsetY: 0,
      colliderW: 34,
      colliderH: 34,
      prefabRef: "",
      parentRef: "",
      parentOffsetX: 0,
      parentOffsetY: 0,
      parentOffsetZ: 0,
      bones2D: "",
      bonesAnimate: false
    },
    enemy: {
      id: "enemy",
      name: "Inimigo",
      type: "enemy",
      x: 680,
      y: 360,
      z: 0,
      w: 34,
      h: 34,
      speed: 130,
      color: "#ff7a66",
      sortingLayer: "default",
      orderInLayer: 9,
      spriteId: "demo:enemy",
      flipX: false,
      flipY: false,
      pivotX: 0,
      pivotY: 0,
      animationId: "",
      animationFps: 8,
      animationLoop: true,
      animationMode: "loop",
      animationPlaying: true,
      animationOffset: 0,
      spriteOpacity: 1,
      rigidbodyType: "kinematic",
      gravityScale: 0,
      linearDamping: 0,
      restitution: 0,
      colliderEnabled: true,
      colliderIsTrigger: false,
      colliderOffsetX: 0,
      colliderOffsetY: 0,
      colliderW: 34,
      colliderH: 34,
      prefabRef: "",
      parentRef: "",
      parentOffsetX: 0,
      parentOffsetY: 0,
      parentOffsetZ: 0,
      bones2D: "",
      bonesAnimate: false,
      patrolIndex: 0,
      patrol: [
        { x: 680, y: 360, z: 0 },
        { x: 980, y: 360, z: 0 },
        { x: 980, y: 640, z: 0 },
        { x: 680, y: 640, z: 0 }
      ]
    },
    walls: [
      {
        id: "wall_1",
        name: "Parede 1",
        type: "wall",
        x: 300,
        y: 300,
        z: 0,
        w: 340,
        h: 30,
        color: "#7d8895",
        sortingLayer: "default",
        orderInLayer: 0,
        spriteId: "demo:wall",
        flipX: false,
        flipY: false,
        pivotX: 0,
        pivotY: 0,
        animationId: "",
        animationFps: 8,
        animationLoop: true,
        animationMode: "loop",
        animationPlaying: true,
        animationOffset: 0,
        spriteOpacity: 1,
        rigidbodyType: "static",
        gravityScale: 0,
        linearDamping: 0,
        restitution: 0,
        colliderEnabled: true,
        colliderIsTrigger: false,
        colliderOffsetX: 0,
        colliderOffsetY: 0,
        colliderW: 340,
        colliderH: 30,
        prefabRef: "",
        parentRef: "",
        parentOffsetX: 0,
        parentOffsetY: 0,
        parentOffsetZ: 0,
        bones2D: "",
        bonesAnimate: false
      },
      {
        id: "wall_2",
        name: "Parede 2",
        type: "wall",
        x: 1120,
        y: 560,
        z: 0,
        w: 34,
        h: 280,
        color: "#7d8895",
        sortingLayer: "default",
        orderInLayer: 0,
        spriteId: "demo:wall",
        flipX: false,
        flipY: false,
        pivotX: 0,
        pivotY: 0,
        animationId: "",
        animationFps: 8,
        animationLoop: true,
        animationMode: "loop",
        animationPlaying: true,
        animationOffset: 0,
        spriteOpacity: 1,
        rigidbodyType: "static",
        gravityScale: 0,
        linearDamping: 0,
        restitution: 0,
        colliderEnabled: true,
        colliderIsTrigger: false,
        colliderOffsetX: 0,
        colliderOffsetY: 0,
        colliderW: 34,
        colliderH: 280,
        prefabRef: "",
        parentRef: "",
        parentOffsetX: 0,
        parentOffsetY: 0,
        parentOffsetZ: 0,
        bones2D: "",
        bonesAnimate: false
      },
      {
        id: "wall_3",
        name: "Parede 3",
        type: "wall",
        x: 1520,
        y: 400,
        z: 0,
        w: 300,
        h: 34,
        color: "#7d8895",
        sortingLayer: "default",
        orderInLayer: 0,
        spriteId: "demo:wall",
        flipX: false,
        flipY: false,
        pivotX: 0,
        pivotY: 0,
        animationId: "",
        animationFps: 8,
        animationLoop: true,
        animationMode: "loop",
        animationPlaying: true,
        animationOffset: 0,
        spriteOpacity: 1,
        rigidbodyType: "static",
        gravityScale: 0,
        linearDamping: 0,
        restitution: 0,
        colliderEnabled: true,
        colliderIsTrigger: false,
        colliderOffsetX: 0,
        colliderOffsetY: 0,
        colliderW: 300,
        colliderH: 34,
        prefabRef: "",
        parentRef: "",
        parentOffsetX: 0,
        parentOffsetY: 0,
        parentOffsetZ: 0,
        bones2D: "",
        bonesAnimate: false
      }
    ],
    variables: {},
    variableMeta: {},
    gameObjects: [],
    layers: {
      background: [],
      gameplay: gameplayTiles,
      collision: [],
      foreground: []
    }
  };

  if (options.includeDemoKit === true) {
    scene.gameObjects = createDefaultDemoKit(scene);
  }

  return scene;
}

export function rebuildTileMap(scene, tileMaps) {
  const safeTileMaps = ensureLayerMaps(tileMaps);
  const layers = readSceneLayers(scene);

  TILE_LAYERS.forEach((layer) => {
    safeTileMaps[layer].clear();

    (layers[layer] || []).forEach((tile) => {
      const x = Number(tile.x);
      const y = Number(tile.y);
      const tileId = Number(tile.tile);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !TILE_BY_ID.has(tileId)) {
        return;
      }

      safeTileMaps[layer].set(`${x},${y}`, tileId);
    });

    layers[layer] = mapToLayerArray(safeTileMaps[layer]);
  });

  scene.layers = layers;
  delete scene.tiles;
}

export function syncWallCounter(scene) {
  return nextCounterFromIds(scene.walls, "wall_");
}

export function syncGameplayCounter(scene) {
  return nextCounterFromIds(scene.gameObjects, "go_");
}

export function worldToCell(scene, wx, wy) {
  if (wx < 0 || wy < 0 || wx >= scene.world.width || wy >= scene.world.height) {
    return null;
  }

  return {
    tx: Math.floor(wx / scene.world.tileSize),
    ty: Math.floor(wy / scene.world.tileSize)
  };
}

export function getTileAt(scene, tileMaps, layer, wx, wy) {
  if (!TILE_LAYERS.includes(layer)) {
    return 0;
  }

  const cell = worldToCell(scene, wx, wy);
  if (!cell) {
    return 0;
  }

  const layerMap = getLayerMap(scene, tileMaps, layer);
  return layerMap.has(`${cell.tx},${cell.ty}`) ? Number(layerMap.get(`${cell.tx},${cell.ty}`)) : 0;
}

export function resolveRandomPaintTileId(tileId, random = Math.random) {
  const tile = TILE_BY_ID.get(Number(tileId));
  if (!tile) {
    return 0;
  }

  const pool = Array.isArray(tile.randomPool) && tile.randomPool.length > 0
    ? tile.randomPool.filter((id) => TILE_BY_ID.has(Number(id))).map((id) => Number(id))
    : Array.isArray(tile.ruleVariants) && tile.ruleVariants.length > 0
      ? tile.ruleVariants.filter((id) => TILE_BY_ID.has(Number(id))).map((id) => Number(id))
      : [Number(tile.id)];

  if (pool.length === 0) {
    return Number(tile.id);
  }

  const sample = typeof random === "function" ? random() : Math.random();
  const randomValue = Number.isFinite(Number(sample)) ? Number(sample) : Math.random();
  const index = Math.max(0, Math.min(pool.length - 1, Math.floor(randomValue * pool.length)));
  return pool[index];
}

export function resolveAnimatedTileId(tileId, timeSeconds) {
  const tile = TILE_BY_ID.get(Number(tileId));
  if (!tile || !Array.isArray(tile.animatedFrames) || tile.animatedFrames.length === 0) {
    return Number(tileId);
  }

  const frames = tile.animatedFrames.filter((id) => TILE_BY_ID.has(Number(id))).map((id) => Number(id));
  if (frames.length === 0) {
    return Number(tileId);
  }

  const frameDuration = Math.max(0.05, Number.isFinite(Number(tile.frameDuration)) ? Number(tile.frameDuration) : 0.2);
  const safeTime = Math.max(0, Number.isFinite(Number(timeSeconds)) ? Number(timeSeconds) : 0);
  const frameIndex = Math.floor(safeTime / frameDuration) % frames.length;
  return frames[frameIndex];
}

export function collectBrushCells(scene, centerCell, options = {}) {
  if (!scene || !centerCell || !Number.isInteger(centerCell.tx) || !Number.isInteger(centerCell.ty)) {
    return [];
  }

  const shape = normalizePaintBrushShape(options.shape);
  const brushSize = normalizePaintBrushSize(options.size, 1, 24);
  const maxTx = Math.max(0, Math.ceil(scene.world.width / scene.world.tileSize) - 1);
  const maxTy = Math.max(0, Math.ceil(scene.world.height / scene.world.tileSize) - 1);
  const half = (brushSize - 1) * 0.5;
  const radius = brushSize * 0.5;
  const cells = [];

  for (let offsetX = 0; offsetX < brushSize; offsetX += 1) {
    for (let offsetY = 0; offsetY < brushSize; offsetY += 1) {
      if (shape === "circle") {
        const dx = offsetX - half;
        const dy = offsetY - half;
        if (Math.hypot(dx, dy) > radius) {
          continue;
        }
      }

      const tx = centerCell.tx - Math.floor(brushSize / 2) + offsetX;
      const ty = centerCell.ty - Math.floor(brushSize / 2) + offsetY;
      if (tx < 0 || ty < 0 || tx > maxTx || ty > maxTy) {
        continue;
      }

      cells.push({ tx, ty });
    }
  }

  return dedupeCellList(cells);
}

export function traceLineBrushCells(scene, startWorld, endWorld, options = {}) {
  const base = traceLineCells(scene, startWorld, endWorld);
  if (base.length === 0) {
    return [];
  }

  const thickness = normalizePaintBrushSize(options.thickness, 1, 24);
  if (thickness === 1) {
    return base;
  }

  const shape = normalizePaintBrushShape(options.brushShape);
  const expanded = [];
  base.forEach((cell) => {
    expanded.push(...collectBrushCells(scene, cell, { size: thickness, shape }));
  });

  return dedupeCellList(expanded);
}

export function paintTile(scene, tileMaps, layer, wx, wy, tileId, options = {}) {
  if (!TILE_LAYERS.includes(layer)) {
    return false;
  }

  const cell = worldToCell(scene, wx, wy);
  if (!cell) {
    return false;
  }

  const safeTileMaps = ensureLayerMaps(tileMaps);
  const layerMap = safeTileMaps[layer];
  const changed = applyTileChange(scene, layerMap, layer, cell.tx, cell.ty, normalizeTileId(tileId));
  if (changed && options.autoTile !== false) {
    applyRuleVariantsForCells(scene, layerMap, layer, [{ tx: cell.tx, ty: cell.ty }]);
  }
  return changed;
}

export function paintTileRect(scene, tileMaps, layer, startWorld, endWorld, tileId, options = {}) {
  if (!TILE_LAYERS.includes(layer) || !startWorld || !endWorld) {
    return false;
  }

  const startCell = clampWorldToCell(scene, startWorld.x, startWorld.y);
  const endCell = clampWorldToCell(scene, endWorld.x, endWorld.y);
  if (!startCell || !endCell) {
    return false;
  }

  const safeTileMaps = ensureLayerMaps(tileMaps);
  const layerMap = safeTileMaps[layer];
  const nextTileId = normalizeTileId(tileId);
  let changed = false;
  const touched = [];

  const minX = Math.min(startCell.tx, endCell.tx);
  const maxX = Math.max(startCell.tx, endCell.tx);
  const minY = Math.min(startCell.ty, endCell.ty);
  const maxY = Math.max(startCell.ty, endCell.ty);

  for (let tx = minX; tx <= maxX; tx += 1) {
    for (let ty = minY; ty <= maxY; ty += 1) {
      const didChange = applyTileChange(scene, layerMap, layer, tx, ty, nextTileId);
      if (didChange) {
        touched.push({ tx, ty });
      }
      changed = didChange || changed;
    }
  }

  if (changed && options.autoTile !== false) {
    applyRuleVariantsForCells(scene, layerMap, layer, touched);
  }

  return changed;
}

export function paintTileLine(scene, tileMaps, layer, startWorld, endWorld, tileId, options = {}) {
  if (!TILE_LAYERS.includes(layer) || !startWorld || !endWorld) {
    return false;
  }

  const safeTileMaps = ensureLayerMaps(tileMaps);
  const layerMap = safeTileMaps[layer];
  const nextTileId = normalizeTileId(tileId);
  const cells = traceLineBrushCells(scene, startWorld, endWorld, {
    thickness: options.thickness,
    brushShape: options.brushShape
  });
  let changed = false;
  const touched = [];

  cells.forEach((cell) => {
    const didChange = applyTileChange(scene, layerMap, layer, cell.tx, cell.ty, nextTileId);
    if (didChange) {
      touched.push({ tx: cell.tx, ty: cell.ty });
    }
    changed = didChange || changed;
  });

  if (changed && options.autoTile !== false) {
    applyRuleVariantsForCells(scene, layerMap, layer, touched);
  }

  return changed;
}

export function floodFillTiles(scene, tileMaps, layer, wx, wy, tileId, options = {}) {
  if (!TILE_LAYERS.includes(layer)) {
    return false;
  }

  const startCell = worldToCell(scene, wx, wy);
  if (!startCell) {
    return false;
  }

  const safeTileMaps = ensureLayerMaps(tileMaps);
  const layerMap = safeTileMaps[layer];
  const nextTileId = normalizeTileId(tileId);
  const startKey = `${startCell.tx},${startCell.ty}`;
  const targetTileId = layerMap.has(startKey) ? Number(layerMap.get(startKey)) : 0;

  if (targetTileId === nextTileId) {
    return false;
  }

  const maxTx = Math.max(0, Math.ceil(scene.world.width / scene.world.tileSize) - 1);
  const maxTy = Math.max(0, Math.ceil(scene.world.height / scene.world.tileSize) - 1);
  const queue = [startKey];
  const visited = new Set(queue);
  let changed = false;
  const touched = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const [tx, ty] = current.split(",").map(Number);
    const currentTileId = layerMap.has(current) ? Number(layerMap.get(current)) : 0;
    if (currentTileId !== targetTileId) {
      continue;
    }

    const didChange = applyTileChange(scene, layerMap, layer, tx, ty, nextTileId);
    if (didChange) {
      touched.push({ tx, ty });
    }
    changed = didChange || changed;

    const neighbors = [
      [tx + 1, ty],
      [tx - 1, ty],
      [tx, ty + 1],
      [tx, ty - 1]
    ];

    neighbors.forEach(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx > maxTx || ny > maxTy) {
        return;
      }

      const key = `${nx},${ny}`;
      if (visited.has(key)) {
        return;
      }

      visited.add(key);
      queue.push(key);
    });
  }

  if (changed && options.autoTile !== false) {
    applyRuleVariantsForCells(scene, layerMap, layer, touched);
  }

  return changed;
}

export function traceLineCells(scene, startWorld, endWorld) {
  const startCell = clampWorldToCell(scene, startWorld.x, startWorld.y);
  const endCell = clampWorldToCell(scene, endWorld.x, endWorld.y);
  if (!startCell || !endCell) {
    return [];
  }

  const cells = [];
  let x0 = startCell.tx;
  let y0 = startCell.ty;
  const x1 = endCell.tx;
  const y1 = endCell.ty;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ tx: x0, ty: y0 });
    if (x0 === x1 && y0 === y1) {
      break;
    }

    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return cells;
}

export function getCollisionRectsForBody(scene, tileMaps, body) {
  const collisionMap = getLayerMap(scene, tileMaps, "collision");
  const tileSize = scene.world.tileSize;
  const minTx = Math.max(0, Math.floor(body.x / tileSize));
  const minTy = Math.max(0, Math.floor(body.y / tileSize));
  const maxTx = Math.max(0, Math.floor((body.x + body.w - 1) / tileSize));
  const maxTy = Math.max(0, Math.floor((body.y + body.h - 1) / tileSize));
  const useComposite = scene?.physics?.compositeCollider !== false;
  if (!useComposite) {
    return collectCollisionTileRects(collisionMap, minTx, minTy, maxTx, maxTy, tileSize);
  }

  const spansByRow = new Map();
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    const spans = [];
    let start = null;

    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const filled = collisionMap.has(`${tx},${ty}`);
      if (filled && start === null) {
        start = tx;
      }
      if (!filled && start !== null) {
        spans.push({ txStart: start, txEnd: tx - 1 });
        start = null;
      }
    }

    if (start !== null) {
      spans.push({ txStart: start, txEnd: maxTx });
    }

    if (spans.length > 0) {
      spansByRow.set(ty, spans);
    }
  }

  const active = new Map();
  const merged = [];
  const sortedRows = Array.from(spansByRow.keys()).sort((a, b) => a - b);

  sortedRows.forEach((ty) => {
    const spans = spansByRow.get(ty) || [];
    const seen = new Set();

    spans.forEach((span) => {
      const key = `${span.txStart}:${span.txEnd}`;
      const current = active.get(key);
      if (current && current.lastTy === ty - 1) {
        current.lastTy = ty;
        current.h += tileSize;
        seen.add(key);
        return;
      }

      const rect = {
        x: span.txStart * tileSize,
        y: ty * tileSize,
        w: (span.txEnd - span.txStart + 1) * tileSize,
        h: tileSize,
        lastTy: ty
      };
      active.set(key, rect);
      seen.add(key);
    });

    Array.from(active.keys()).forEach((key) => {
      if (!seen.has(key)) {
        const rect = active.get(key);
        if (rect) {
          merged.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
        }
        active.delete(key);
      }
    });
  });

  active.forEach((rect) => {
    merged.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  });

  return merged;
}

export function collidesWithCollisionLayer(body, scene, tileMaps) {
  return getCollisionRectsForBody(scene, tileMaps, body).some((tileRect) => overlap(body, tileRect));
}

function collectCollisionTileRects(collisionMap, minTx, minTy, maxTx, maxTy, tileSize) {
  const rects = [];
  for (let tx = minTx; tx <= maxTx; tx += 1) {
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      if (!collisionMap.has(`${tx},${ty}`)) {
        continue;
      }
      rects.push({
        x: tx * tileSize,
        y: ty * tileSize,
        w: tileSize,
        h: tileSize
      });
    }
  }
  return rects;
}

export function getColliderRect(object, options = {}) {
  if (!object || typeof object !== "object") {
    return null;
  }

  const includeDisabled = options.includeDisabled === true;
  if (object.colliderEnabled === false && !includeDisabled) {
    return null;
  }

  const bodyW = Math.max(1, num(object.w, 0));
  const bodyH = Math.max(1, num(object.h, 0));
  const width = Math.max(1, num(object.colliderW, bodyW));
  const height = Math.max(1, num(object.colliderH, bodyH));
  const offsetX = Number.isFinite(Number(object.colliderOffsetX)) ? Number(object.colliderOffsetX) : 0;
  const offsetY = Number.isFinite(Number(object.colliderOffsetY)) ? Number(object.colliderOffsetY) : 0;

  return {
    x: num(object.x, 0) + offsetX,
    y: num(object.y, 0) + offsetY,
    w: width,
    h: height
  };
}

export function getObjectByRef(scene, ref) {
  if (!ref) {
    return null;
  }

  if (ref.kind === "entity" && ref.id === "player") {
    return scene.player;
  }

  if (ref.kind === "entity" && ref.id === "enemy") {
    return scene.enemy;
  }

  if (ref.kind === "wall") {
    return scene.walls.find((wall) => wall.id === ref.id) || null;
  }

  if (ref.kind === "gameplayObject") {
    return (scene.gameObjects || []).find((item) => item.id === ref.id) || null;
  }

  return null;
}

export function resolveObjectByKey(scene, key) {
  const cleanKey = String(key || "").trim();
  if (!cleanKey) {
    return null;
  }

  const [kind, id] = cleanKey.split(":");
  if (!kind || !id) {
    return null;
  }

  return getObjectByRef(scene, { kind, id });
}

export function listSceneHierarchyObjects(scene, options = {}) {
  const includeEntities = options.includeEntities !== false;
  const entries = [];

  if (includeEntities && scene?.player) {
    entries.push({ key: "entity:player", ref: { kind: "entity", id: "player" }, object: scene.player });
  }
  if (includeEntities && scene?.enemy) {
    entries.push({ key: "entity:enemy", ref: { kind: "entity", id: "enemy" }, object: scene.enemy });
  }

  (scene?.walls || []).forEach((wall) => {
    entries.push({ key: `wall:${wall.id}`, ref: { kind: "wall", id: wall.id }, object: wall });
  });

  (scene?.gameObjects || []).forEach((item) => {
    entries.push({ key: `gameplayObject:${item.id}`, ref: { kind: "gameplayObject", id: item.id }, object: item });
  });

  return entries;
}

export function syncParentHierarchy(scene, options = {}) {
  const entries = listSceneHierarchyObjects(scene, { includeEntities: options.includeEntities !== false });
  const byKey = new Map(entries.map((entry) => [entry.key, entry.object]));
  const passes = Math.max(1, Number.isFinite(Number(options.maxPasses)) ? Math.round(Number(options.maxPasses)) : 6);
  let changed = false;

  for (let pass = 0; pass < passes; pass += 1) {
    let passChanged = false;
    entries.forEach((entry) => {
      const child = entry.object;
      const parentKey = String(child?.parentRef || "").trim();
      if (!parentKey) {
        return;
      }

      const parent = byKey.get(parentKey);
      if (!parent || parent === child) {
        return;
      }

      const offsetX = Number.isFinite(Number(child.parentOffsetX)) ? Number(child.parentOffsetX) : child.x - parent.x;
      const offsetY = Number.isFinite(Number(child.parentOffsetY)) ? Number(child.parentOffsetY) : child.y - parent.y;
      const offsetZ = Number.isFinite(Number(child.parentOffsetZ)) ? Number(child.parentOffsetZ) : (child.z || 0) - (parent.z || 0);
      child.parentOffsetX = offsetX;
      child.parentOffsetY = offsetY;
      child.parentOffsetZ = offsetZ;

      const nextX = Math.round(parent.x + offsetX);
      const nextY = Math.round(parent.y + offsetY);
      const nextZ = Number(parent.z || 0) + offsetZ;
      if (child.x === nextX && child.y === nextY && Number(child.z || 0) === nextZ) {
        return;
      }

      child.x = nextX;
      child.y = nextY;
      child.z = nextZ;
      passChanged = true;
      changed = true;
    });

    if (!passChanged) {
      break;
    }
  }

  return changed;
}

export function getGameplayObjectsByType(scene, type) {
  if (!scene || !Array.isArray(scene.gameObjects)) {
    return [];
  }

  if (!type) {
    return scene.gameObjects;
  }

  return scene.gameObjects.filter((item) => item.type === type);
}

export function pickAt(scene, x, y, options = {}) {
  const ordered = getPickableItems(scene, options);

  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const item = ordered[i];
    const rect = item.rect || item.object;
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return item.ref;
    }
  }

  return null;
}

export function pickArea(scene, startPoint, endPoint, options = {}) {
  if (!startPoint || !endPoint) {
    return { ref: null, refs: [], count: 0 };
  }

  const minX = Math.min(startPoint.x, endPoint.x);
  const minY = Math.min(startPoint.y, endPoint.y);
  const box = {
    x: minX,
    y: minY,
    w: Math.abs(startPoint.x - endPoint.x),
    h: Math.abs(startPoint.y - endPoint.y)
  };

  const hits = getPickableItems(scene, options).filter((item) => overlap(box, item.rect || item.object));
  if (hits.length === 0) {
    return { ref: null, refs: [], count: 0 };
  }

  return {
    ref: hits[hits.length - 1].ref,
    refs: hits.map((item) => item.ref),
    count: hits.length
  };
}

export function createGameplayObject(scene, counter, type, position) {
  const tileSize = scene.world.tileSize;
  const presets = {
    spawn: {
      color: "#6ddfa3",
      w: tileSize,
      h: tileSize,
      name: "Ponto Inicial",
      spawnTag: "player_start",
      teamId: "",
      priority: 0,
      sortingLayer: "default",
      orderInLayer: 6,
      spriteId: "demo:spawn",
      rigidbodyType: "static",
      colliderEnabled: true,
      colliderIsTrigger: false
    },
    trigger: {
      color: "#ffcb6b",
      w: tileSize * 2,
      h: tileSize * 2,
      name: "Gatilho",
      triggerTag: "trigger_enter",
      conditionType: "always",
      conditionTargetTag: "",
      conditionValue: "",
      actionType: "message",
      actionValue: "",
      actionSceneId: "",
      actionSpawnTag: "",
      actionTargetTag: "",
      actionSpeaker: "",
      actionLines: ["", "", ""],
      actionX: 0,
      actionY: 0,
      actionDuration: 0.6,
      actions: [{ type: "message", value: "", sceneId: "", spawnTag: "", targetTag: "" }],
      interactionOnly: false,
      once: false,
      enabled: true,
      sortingLayer: "default",
      orderInLayer: 5,
      spriteId: "demo:trigger",
      rigidbodyType: "static",
      colliderEnabled: true,
      colliderIsTrigger: true
    },
    portal: {
      color: "#76b7ff",
      w: tileSize,
      h: tileSize * 2,
      name: "Portal",
      targetSceneId: scene.id,
      targetSpawnTag: "player_start",
      targetTeamId: "",
      fallbackMode: "priority",
      sortingLayer: "default",
      orderInLayer: 7,
      spriteId: "demo:portal",
      rigidbodyType: "static",
      colliderEnabled: true,
      colliderIsTrigger: false
    },
    checkpoint: {
      color: "#f6a75a",
      w: tileSize,
      h: tileSize,
      name: "Ponto de Controle",
      checkpointId: `checkpoint_${counter}`,
      sortingLayer: "default",
      orderInLayer: 8,
      spriteId: "demo:checkpoint",
      rigidbodyType: "static",
      colliderEnabled: true,
      colliderIsTrigger: false
    },
    door: {
      color: "#b8793d",
      w: tileSize,
      h: tileSize * 2,
      name: "Porta",
      doorTag: `door_${counter}`,
      startsOpen: false,
      isOpen: false,
      sortingLayer: "default",
      orderInLayer: 7,
      spriteId: "demo:door",
      rigidbodyType: "static",
      colliderEnabled: true,
      colliderIsTrigger: false
    },
    spriteShape: {
      color: "#4cab6b",
      w: tileSize * 8,
      h: tileSize * 4,
      name: "Sprite Shape",
      shapePoints: "0,64;64,24;128,52;192,12;256,84",
      shapeClosed: true,
      shapeSmooth: true,
      shapeSegments: 12,
      shapeFill: "#4cab6b",
      shapeStroke: "#2f6f45",
      shapeThickness: 3,
      sortingLayer: "background",
      orderInLayer: -2,
      spriteId: "",
      rigidbodyType: "static",
      colliderEnabled: false,
      colliderIsTrigger: false
    },
    cameraZone: {
      color: "#7baeff",
      w: tileSize * 8,
      h: tileSize * 6,
      name: "Zona de Camera",
      cameraZonePriority: 0,
      cameraZoneZoom: 0,
      cameraZoneOffsetX: 0,
      cameraZoneOffsetY: 0,
      shakeOnEnter: false,
      shakeIntensity: 14,
      shakeDuration: 0.28,
      shakeFrequency: 32,
      enabled: true,
      sortingLayer: "foreground",
      orderInLayer: 2,
      spriteId: "",
      rigidbodyType: "static",
      colliderEnabled: true,
      colliderIsTrigger: true
    },
    light2d: {
      color: "#ffd77a",
      w: tileSize,
      h: tileSize,
      name: "Luz 2D",
      sortingLayer: "foreground",
      orderInLayer: 20,
      spriteId: "",
      rigidbodyType: "static",
      colliderEnabled: false,
      colliderIsTrigger: true,
      lightRadius: 180,
      lightIntensity: 0.92,
      lightColor: "#ffe3a6",
      lightFlicker: 0.12,
      castShadows: true
    }
  };

  const preset = presets[type] || presets.trigger;
  return {
    id: `go_${counter}`,
    name: `${preset.name} ${counter}`,
    type,
    x: Math.round(position.x),
    y: Math.round(position.y),
    z: 0,
    w: preset.w,
    h: preset.h,
    color: preset.color,
    spawnTag: preset.spawnTag,
    teamId: preset.teamId,
    priority: preset.priority,
    triggerTag: preset.triggerTag,
    conditionType: preset.conditionType,
    conditionTargetTag: preset.conditionTargetTag,
    conditionValue: preset.conditionValue,
    actionType: preset.actionType,
    actionValue: preset.actionValue,
    actionSceneId: preset.actionSceneId,
    actionSpawnTag: preset.actionSpawnTag,
    actionTargetTag: preset.actionTargetTag,
    actionSpeaker: preset.actionSpeaker,
    actionLines: Array.isArray(preset.actionLines) ? preset.actionLines.slice(0, 3) : ["", "", ""],
    actionX: preset.actionX,
    actionY: preset.actionY,
    actionDuration: preset.actionDuration,
    actionTimelineId: String(preset.actionTimelineId || ""),
    actions: Array.isArray(preset.actions) ? preset.actions.map((action) => ({ ...action })) : [],
    interactionOnly: preset.interactionOnly === true,
    once: preset.once,
    enabled: preset.enabled,
    doorTag: preset.doorTag,
    startsOpen: preset.startsOpen,
    isOpen: preset.isOpen,
    targetSceneId: preset.targetSceneId,
    targetSpawnTag: preset.targetSpawnTag,
    targetTeamId: preset.targetTeamId,
    fallbackMode: preset.fallbackMode,
    checkpointId: preset.checkpointId,
    sortingLayer: normalizeSortingLayer(preset.sortingLayer),
    orderInLayer: normalizeOrderInLayer(preset.orderInLayer),
    spriteId: String(preset.spriteId || ""),
    flipX: false,
    flipY: false,
    pivotX: 0,
    pivotY: 0,
    animationId: String(preset.animationId || ""),
    animationFps: Math.max(1, Number.isFinite(Number(preset.animationFps)) ? Number(preset.animationFps) : 8),
    animationLoop: preset.animationLoop !== false,
    animationMode: normalizeAnimationMode(preset.animationMode || "loop"),
    animationPlaying: preset.animationPlaying !== false,
    animationOffset: Number.isFinite(Number(preset.animationOffset)) ? Number(preset.animationOffset) : 0,
    spriteOpacity: clamp01(preset.spriteOpacity, 1),
    rigidbodyType: normalizeRigidbodyType(preset.rigidbodyType || "static"),
    gravityScale: Number.isFinite(Number(preset.gravityScale)) ? Number(preset.gravityScale) : 0,
    linearDamping: Math.max(0, Number.isFinite(Number(preset.linearDamping)) ? Number(preset.linearDamping) : 0),
    restitution: clamp01(preset.restitution, 0),
    colliderEnabled: preset.colliderEnabled !== false,
    colliderIsTrigger: preset.colliderIsTrigger === true,
    colliderOffsetX: Number.isFinite(Number(preset.colliderOffsetX)) ? Number(preset.colliderOffsetX) : 0,
    colliderOffsetY: Number.isFinite(Number(preset.colliderOffsetY)) ? Number(preset.colliderOffsetY) : 0,
    colliderW: Math.max(4, Number.isFinite(Number(preset.colliderW)) ? Number(preset.colliderW) : preset.w),
    colliderH: Math.max(4, Number.isFinite(Number(preset.colliderH)) ? Number(preset.colliderH) : preset.h),
    prefabRef: "",
    parentRef: "",
    parentOffsetX: 0,
    parentOffsetY: 0,
    parentOffsetZ: 0,
    bones2D: "",
    bonesAnimate: false,
    shapePoints: String(preset.shapePoints || ""),
    shapeClosed: preset.shapeClosed !== false,
    shapeSmooth: preset.shapeSmooth !== false,
    shapeSegments: Math.max(2, Number.isFinite(Number(preset.shapeSegments)) ? Math.round(Number(preset.shapeSegments)) : 12),
    shapeFill: String(preset.shapeFill || preset.color || "#4cab6b"),
    shapeStroke: String(preset.shapeStroke || "#2f6f45"),
    shapeThickness: Math.max(1, Number.isFinite(Number(preset.shapeThickness)) ? Number(preset.shapeThickness) : 3),
    cameraZonePriority: Number.isFinite(Number(preset.cameraZonePriority)) ? Math.round(Number(preset.cameraZonePriority)) : 0,
    cameraZoneZoom: Number.isFinite(Number(preset.cameraZoneZoom)) ? Number(preset.cameraZoneZoom) : 0,
    cameraZoneOffsetX: Number.isFinite(Number(preset.cameraZoneOffsetX)) ? Number(preset.cameraZoneOffsetX) : 0,
    cameraZoneOffsetY: Number.isFinite(Number(preset.cameraZoneOffsetY)) ? Number(preset.cameraZoneOffsetY) : 0,
    shakeOnEnter: preset.shakeOnEnter === true,
    shakeIntensity: Math.max(0, Number.isFinite(Number(preset.shakeIntensity)) ? Number(preset.shakeIntensity) : 14),
    shakeDuration: Math.max(0.01, Number.isFinite(Number(preset.shakeDuration)) ? Number(preset.shakeDuration) : 0.28),
    shakeFrequency: Math.max(1, Number.isFinite(Number(preset.shakeFrequency)) ? Number(preset.shakeFrequency) : 32),
    lightRadius: Math.max(16, Number.isFinite(Number(preset.lightRadius)) ? Number(preset.lightRadius) : 180),
    lightIntensity: clamp01(preset.lightIntensity, 0.92),
    lightColor: String(preset.lightColor || preset.color || "#ffe3a6"),
    lightFlicker: clamp01(preset.lightFlicker, 0),
    castShadows: preset.castShadows !== false
  };
}

function createDefaultDemoKit(scene) {
  const spawn = createGameplayObject(scene, 1, "spawn", { x: 128, y: 128 });
  spawn.name = "Ponto Inicial Demo";
  spawn.spawnTag = "entrada_demo";

  const trigger = createGameplayObject(scene, 2, "trigger", { x: 224, y: 128 });
  trigger.name = "Gatilho Demo";
  trigger.triggerTag = "gatilho_demo";
  trigger.interactionOnly = true;
  trigger.actions = [
    {
      type: "start-dialogue",
      value: "",
      sceneId: "",
      spawnTag: "",
      targetTag: "",
      speaker: "Guia",
      lines: [
        "Bem-vindo a CN Engine.",
        "Aproxime-se do gatilho e pressione E no modo JOGAR.",
        "Agora vamos abrir a porta e mover a camera."
      ]
    },
    {
      type: "move-camera",
      value: "",
      sceneId: "",
      spawnTag: "",
      targetTag: "",
      x: 544,
      y: 168,
      duration: 0.9
    },
    {
      type: "open-door",
      value: "",
      sceneId: "",
      spawnTag: "",
      targetTag: "porta_demo"
    }
  ];
  trigger.actionType = "start-dialogue";
  trigger.actionSpeaker = "Guia";
  trigger.actionLines = [
    "Bem-vindo a CN Engine.",
    "Aproxime-se do gatilho e pressione E no modo JOGAR.",
    "Agora vamos abrir a porta e mover a camera."
  ];

  const checkpoint = createGameplayObject(scene, 3, "checkpoint", { x: 416, y: 128 });
  checkpoint.name = "Ponto de Controle Demo";
  checkpoint.checkpointId = "checkpoint_demo";

  const door = createGameplayObject(scene, 4, "door", { x: 560, y: 96 });
  door.name = "Porta Demo";
  door.doorTag = "porta_demo";
  door.w = 40;
  door.h = 96;
  door.startsOpen = false;
  door.isOpen = false;

  return [spawn, trigger, checkpoint, door];
}

export function getTriggerActions(trigger, options = {}) {
  const maxActions = Math.max(1, num(options.maxActions, 8));
  const useExplicitArray = Array.isArray(trigger?.actions);
  const sourceActions = useExplicitArray ? trigger.actions : [trigger];

  const actions = sourceActions
    .map((entry) => sanitizeTriggerAction(entry))
    .filter(Boolean)
    .slice(0, maxActions);

  if (useExplicitArray) {
    return actions;
  }

  return actions.length > 0 ? actions : [createDefaultTriggerAction()];
}

export function evaluateTriggerCondition(trigger, context = {}) {
  const conditionType = normalizeTriggerConditionType(trigger?.conditionType);
  const conditionTargetTag = String(trigger?.conditionTargetTag || "").trim();
  const conditionValue = String(trigger?.conditionValue || "").trim();
  const playerTeamId = String(context.playerTeamId || "").trim();
  const sceneId = String(context.sceneId || "").trim();
  const hasCheckpoint = context.hasCheckpoint === true;
  const variables = context.variables && typeof context.variables === "object" ? context.variables : {};

  if (conditionType === "team-is") {
    return conditionValue.length > 0 && playerTeamId === conditionValue;
  }

  if (conditionType === "team-not") {
    return conditionValue.length > 0 && playerTeamId !== conditionValue;
  }

  if (conditionType === "scene-is") {
    return conditionValue.length > 0 && sceneId === conditionValue;
  }

  if (conditionType === "has-checkpoint") {
    return hasCheckpoint;
  }

  if (conditionType === "var-is") {
    if (!conditionTargetTag) {
      return false;
    }
    return String(variables[conditionTargetTag] ?? "") === conditionValue;
  }

  if (conditionType === "var-not") {
    if (!conditionTargetTag) {
      return false;
    }
    return String(variables[conditionTargetTag] ?? "") !== conditionValue;
  }

  return true;
}

export function collectMutableSceneRefs(scene, refs) {
  const sourceRefs = Array.isArray(refs) ? refs : [];
  const unique = [];

  sourceRefs.forEach((ref) => {
    if (!ref || !["wall", "gameplayObject"].includes(ref.kind)) {
      return;
    }

    if (!getObjectByRef(scene, ref)) {
      return;
    }

    if (unique.some((entry) => sameRef(entry, ref))) {
      return;
    }

    unique.push({ ...ref });
  });

  return unique;
}

export function deleteMutableSceneObjects(scene, refs) {
  const removableRefs = collectMutableSceneRefs(scene, refs);
  if (removableRefs.length === 0) {
    return { removedCount: 0, removedRefs: [] };
  }

  const removeSet = new Set(removableRefs.map((ref) => `${ref.kind}:${ref.id}`));
  scene.walls = scene.walls.filter((wall) => !removeSet.has(`wall:${wall.id}`));
  scene.gameObjects = (scene.gameObjects || []).filter((item) => !removeSet.has(`gameplayObject:${item.id}`));

  return {
    removedCount: removableRefs.length,
    removedRefs: removableRefs.map((ref) => ({ ...ref }))
  };
}

export function duplicateMutableSceneObjects(scene, refs, tileMaps, counters, options = {}) {
  scene.gameObjects = Array.isArray(scene.gameObjects) ? scene.gameObjects : [];

  const sources = collectMutableSceneRefs(scene, refs)
    .map((ref) => ({ ref, object: getObjectByRef(scene, ref) }))
    .filter((entry) => entry.object);

  if (sources.length === 0) {
    return { createdCount: 0, createdRefs: [], wallCounter: counters.wallCounter, gameplayCounter: counters.gameplayCounter };
  }

  const tileSize = Math.max(1, num(options.tileSize, scene.world.tileSize || 32));
  const maxAttempts = Math.max(1, num(options.maxAttempts, 8));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const offsetX = tileSize * attempt;
    const offsetY = tileSize * attempt;
    const nextCounters = {
      wallCounter: counters.wallCounter,
      gameplayCounter: counters.gameplayCounter
    };
    const candidates = sources.map((entry) => buildDuplicateCandidate(scene, entry, nextCounters, offsetX, offsetY));

    if (!validateDuplicateCandidates(scene, candidates, tileMaps)) {
      continue;
    }

    candidates.forEach((entry) => {
      if (entry.ref.kind === "wall") {
        scene.walls.push(entry.object);
      } else if (entry.ref.kind === "gameplayObject") {
        scene.gameObjects.push(entry.object);
      }
    });

    return {
      createdCount: candidates.length,
      createdRefs: candidates.map((entry) => ({ ...entry.ref })),
      wallCounter: nextCounters.wallCounter,
      gameplayCounter: nextCounters.gameplayCounter
    };
  }

  return { createdCount: 0, createdRefs: [], wallCounter: counters.wallCounter, gameplayCounter: counters.gameplayCounter };
}

export function findSpawnPoint(scene, preferredTag = "player_start", options = {}) {
  const spawns = getGameplayObjectsByType(scene, "spawn");
  if (spawns.length === 0) {
    return null;
  }

  const fallbackMode = ["priority", "default", "strict"].includes(options.fallbackMode) ? options.fallbackMode : "default";
  const teamId = String(options.teamId || "").trim();

  const sameTeam = spawns.filter((spawn) => {
    const spawnTeam = String(spawn.teamId || "").trim();
    return !teamId || !spawnTeam || spawnTeam === teamId;
  });
  const teamPool = sameTeam.length > 0 ? sameTeam : spawns;

  const tagged = filterSpawnsByTag(teamPool, preferredTag);
  if (tagged.length > 0) {
    return pickSpawnByPriority(tagged);
  }

  if (fallbackMode === "strict") {
    return null;
  }

  if (fallbackMode === "priority") {
    return pickSpawnByPriority(teamPool);
  }

  const defaultTagged = filterSpawnsByTag(teamPool, "player_start");
  if (defaultTagged.length > 0) {
    return pickSpawnByPriority(defaultTagged);
  }

  return teamPool[0] || spawns[0];
}

export function findCheckpointById(scene, checkpointId) {
  return getGameplayObjectsByType(scene, "checkpoint").find((item) => item.id === checkpointId || item.checkpointId === checkpointId) || null;
}

export function getOverlappingGameplayObjects(scene, body, type = null) {
  const bodyRect = getColliderRect(body, { includeDisabled: true }) || body;
  return getGameplayObjectsByType(scene, type).filter((item) => {
    const itemRect = getColliderRect(item);
    if (!itemRect) {
      return false;
    }
    return overlap(bodyRect, itemRect);
  });
}

export function getClosedDoors(scene) {
  return getGameplayObjectsByType(scene, "door").filter((door) => door.isOpen !== true);
}

export function placeBodyAtMarker(body, marker, world) {
  if (!body || !marker) {
    return false;
  }

  body.x = Math.round(marker.x + (marker.w - body.w) / 2);
  body.y = Math.round(marker.y + (marker.h - body.h) / 2);

  if (world) {
    clampWorld(body, world);
  }

  return true;
}

export function validTransform(scene, ref, candidate, tileMaps, options = {}) {
  const ignoreRefs = Array.isArray(options.ignoreRefs) ? options.ignoreRefs : [];
  const ignoreSet = new Set(ignoreRefs.map((entry) => `${entry.kind}:${entry.id}`));
  const candidateZ = num(candidate?.z, 0);

  if (
    candidate.x < 0 ||
    candidate.y < 0 ||
    candidate.x + candidate.w > scene.world.width ||
    candidate.y + candidate.h > scene.world.height ||
    candidateZ < 0 ||
    candidateZ > scene.world.depth
  ) {
    return false;
  }

  if (ref.kind === "entity") {
    return !collides(candidate, scene.walls.concat(getClosedDoors(scene))) && !collidesWithCollisionLayer(candidate, scene, tileMaps);
  }

  if (ref.kind === "wall") {
    const otherWalls = scene.walls.filter((wall) => wall.id !== ref.id && !ignoreSet.has(`wall:${wall.id}`));
    const playerIgnored = ignoreSet.has("entity:player");
    const enemyIgnored = ignoreSet.has("entity:enemy");
    return !collides(candidate, otherWalls) && (playerIgnored || !overlap(candidate, scene.player)) && (enemyIgnored || !overlap(candidate, scene.enemy));
  }

  if (ref.kind === "gameplayObject") {
    if (candidate.type === "spriteShape" || candidate.type === "light2d" || candidate.colliderEnabled === false || candidate.colliderIsTrigger === true) {
      return true;
    }

    const otherWalls = scene.walls.filter((wall) => !ignoreSet.has(`wall:${wall.id}`));
    const otherDoors = getClosedDoors(scene).filter((door) => door.id !== ref.id && !ignoreSet.has(`gameplayObject:${door.id}`));
    return !collides(candidate, otherWalls.concat(otherDoors)) && !collidesWithCollisionLayer(candidate, scene, tileMaps);
  }

  return true;
}

export function validateScene(data) {
  const migrated = migrateSceneData(data, SCENE_VERSION);
  if (!migrated.ok) {
    return migrated;
  }

  const source = migrated.scene;

  if (!source.world || !source.player || !source.enemy || !Array.isArray(source.walls)) {
    return { ok: false, message: "faltam campos obrigatorios" };
  }

  const world = {
    width: num(source.world.width, Number.NaN),
    height: num(source.world.height, Number.NaN),
    depth: Math.max(1, num(source.world.depth, 2000)),
    tileSize: Math.max(8, num(source.world.tileSize, 32))
  };

  if (!Number.isFinite(world.width) || !Number.isFinite(world.height) || world.width <= 0 || world.height <= 0) {
    return { ok: false, message: "world invalido" };
  }

  const player = sanitizeActor(source.player, "player", "Jogador", "#8ad5ff");
  const enemy = sanitizeActor(source.enemy, "enemy", "Inimigo", "#ff7a66");

  if (!player || !enemy) {
    return { ok: false, message: "jogador/inimigo invalidos" };
  }

  const walls = [];
  for (let i = 0; i < source.walls.length; i += 1) {
    const wallSource = source.walls[i];
    const wall = sanitizeRect(wallSource, String(wallSource.id || `wall_${i + 1}`), String(wallSource.name || `Parede ${i + 1}`), "#7d8895");
    if (!wall) {
      return { ok: false, message: `wall invalida no indice ${i}` };
    }
    wall.type = "wall";
    walls.push(wall);
  }

  const patrol = Array.isArray(source.enemy.patrol)
    ? source.enemy.patrol
        .map((point) => ({
          x: num(point?.x, Number.NaN),
          y: num(point?.y, Number.NaN),
          z: num(point?.z, 0)
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];

  enemy.patrol = patrol.length > 0 ? patrol : [{ x: enemy.x, y: enemy.y, z: enemy.z }];
  enemy.patrolIndex = Number.isInteger(source.enemy.patrolIndex) ? source.enemy.patrolIndex : 0;

  const layers = {
    background: sanitizeLayer(source.layers?.background),
    gameplay: sanitizeLayer(source.layers?.gameplay),
    collision: sanitizeLayer(source.layers?.collision),
    foreground: sanitizeLayer(source.layers?.foreground)
  };

  const gameObjects = Array.isArray(source.gameObjects)
    ? source.gameObjects.map((item, index) => sanitizeGameplayObject(item, index)).filter(Boolean)
    : [];

  const scene = {
    id: String(source.id || "scene_1"),
    name: String(source.name || "Cena 1"),
    version: SCENE_VERSION,
    world,
    space: {
      upAxis: "y",
      forwardAxis: "z",
      ...(source.space || {}),
      mode: normalizeSceneSpaceMode(source.space?.mode)
    },
    physics: sanitizeScenePhysics(source.physics),
    sortingY: source.sortingY === true,
    camera2D: sanitizeSceneCamera2D(source.camera2D),
    lighting2D: sanitizeSceneLighting2D(source.lighting2D),
    ui2D: sanitizeSceneUi2D(source.ui2D),
    audio2D: sanitizeSceneAudio2D(source.audio2D),
    player,
    enemy,
    walls,
    variables: sanitizeVariables(source.variables),
    variableMeta: sanitizeVariableMeta(source.variableMeta, source.variables),
    gameObjects,
    layers
  };

  clampWorld(scene.player, world);
  clampWorld(scene.enemy, world);
  scene.player.z = clampSceneDepth(scene.player.z, world);
  scene.enemy.z = clampSceneDepth(scene.enemy.z, world);
  scene.walls.forEach((wall) => clampWorld(wall, world));
  scene.walls.forEach((wall) => {
    wall.z = clampSceneDepth(wall.z, world);
  });
  scene.gameObjects.forEach((item) => clampWorld(item, world));
  scene.gameObjects.forEach((item) => {
    item.z = clampSceneDepth(item.z, world);
  });
  scene.enemy.patrol.forEach((point) => {
    point.z = clampSceneDepth(point.z, world);
  });

  syncParentHierarchy(scene, { includeEntities: true });
  clampWorld(scene.player, world);
  clampWorld(scene.enemy, world);
  scene.walls.forEach((wall) => clampWorld(wall, world));
  scene.gameObjects.forEach((item) => clampWorld(item, world));

  if (collides(scene.player, scene.walls) || collides(scene.enemy, scene.walls)) {
    return { ok: false, message: "jogador/inimigo colidindo com paredes" };
  }

  if (collidesWithCollisionLayer(scene.player, scene) || collidesWithCollisionLayer(scene.enemy, scene)) {
    return { ok: false, message: "jogador/inimigo colidindo com tiles de colisao" };
  }

  const invalidGameplayObject = scene.gameObjects.find((item) => {
    const nonSolid = item.type === "spriteShape" || item.type === "light2d" || item.colliderEnabled === false || item.colliderIsTrigger === true;
    if (nonSolid) {
      return false;
    }
    return collides(item, scene.walls) || collidesWithCollisionLayer(item, scene);
  });
  if (invalidGameplayObject) {
    return { ok: false, message: `gameObject invalido: ${invalidGameplayObject.name}` };
  }

  if (scene.walls.some((wall) => overlap(wall, scene.player) || overlap(wall, scene.enemy))) {
    return { ok: false, message: "wall sobre player/enemy" };
  }

  return { ok: true, scene };
}

function createLayerMapState() {
  return {
    background: new Map(),
    gameplay: new Map(),
    collision: new Map(),
    foreground: new Map()
  };
}

function createLayerSettingsState() {
  return {
    background: { visible: true, locked: false },
    gameplay: { visible: true, locked: false },
    collision: { visible: true, locked: false },
    foreground: { visible: true, locked: false }
  };
}

function createPlayRuntimeState() {
  return {
    checkpoint: null,
    activeTriggerKeys: {},
    consumedTriggerKeys: {},
    portalLockKey: null,
    portalCooldown: 0,
    respawnInvuln: 0,
    playerTeamId: "",
    variables: {},
    animationFx: {},
    doorFx: {},
    dialogue: null,
    actionQueue: [],
    activeAction: null,
    cameraOverride: null,
    interactionHint: null,
    sequenceLabel: ""
  };
}

function ensureLayerMaps(tileMaps) {
  const safe = tileMaps || {};
  TILE_LAYERS.forEach((layer) => {
    if (!(safe[layer] instanceof Map)) {
      safe[layer] = new Map();
    }
  });
  return safe;
}

function getLayerMap(scene, tileMaps, layer) {
  const safeTileMaps = ensureLayerMaps(tileMaps);
  if (safeTileMaps[layer].size > 0 || !scene) {
    return safeTileMaps[layer];
  }

  const sceneLayers = readSceneLayers(scene);
  sceneLayers[layer].forEach((tile) => {
    safeTileMaps[layer].set(`${tile.x},${tile.y}`, Number(tile.tile));
  });
  return safeTileMaps[layer];
}

function readSceneLayers(scene) {
  const layers = {
    background: [],
    gameplay: [],
    collision: [],
    foreground: []
  };

  if (scene.layers && typeof scene.layers === "object") {
    TILE_LAYERS.forEach((layer) => {
      if (Array.isArray(scene.layers[layer])) {
        layers[layer] = scene.layers[layer];
      }
    });
  }

  if (Array.isArray(scene.tiles) && layers.gameplay.length === 0) {
    layers.gameplay = scene.tiles;
  }

  return layers;
}

function sanitizeLayer(layerEntries) {
  if (!Array.isArray(layerEntries)) {
    return [];
  }

  return layerEntries
    .map((tile) => ({
      x: num(tile?.x, Number.NaN),
      y: num(tile?.y, Number.NaN),
      tile: num(tile?.tile, Number.NaN)
    }))
    .filter((tile) => Number.isInteger(tile.x) && Number.isInteger(tile.y) && TILE_BY_ID.has(tile.tile))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function sanitizeVariables(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.entries(source).reduce((acc, [rawKey, rawValue]) => {
    const key = String(rawKey || "").trim();
    if (!key) {
      return acc;
    }

    acc[key] = String(rawValue ?? "");
    return acc;
  }, {});
}

export function sanitizeVariableMeta(source, variables = null) {
  const normalizedVariables = sanitizeVariables(variables);
  const keys = new Set([
    ...Object.keys(normalizedVariables),
    ...(source && typeof source === "object" && !Array.isArray(source) ? Object.keys(source) : [])
  ]);

  const nextMeta = {};
  keys.forEach((rawKey) => {
    const key = String(rawKey || "").trim();
    if (!key) {
      return;
    }

    const rawType = source && typeof source === "object" && !Array.isArray(source) ? source[key]?.type : null;
    const rawPreset = source && typeof source === "object" && !Array.isArray(source) ? source[key]?.preset : null;
    nextMeta[key] = {
      type: normalizeVariableType(rawType || inferVariableType(normalizedVariables[key])),
      preset: normalizeVariablePreset(rawPreset)
    };
  });

  return nextMeta;
}

export function normalizeVariableType(type) {
  const cleanType = String(type || "string").trim().toLowerCase();
  return VARIABLE_TYPES.includes(cleanType) ? cleanType : "string";
}

export function normalizeVariablePreset(preset) {
  const cleanPreset = String(preset || "none").trim().toLowerCase();
  return VARIABLE_PRESETS.includes(cleanPreset) ? cleanPreset : "none";
}

export function inferVariableType(value) {
  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true" || text === "false") {
    return "boolean";
  }

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) {
    return "color";
  }

  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      JSON.parse(text);
      return "json";
    } catch {
      // Keep falling through to simpler types when JSON parse fails.
    }
  }

  if (text !== "" && Number.isFinite(Number(text))) {
    return "number";
  }

  return "string";
}

export function normalizeVariableValueByType(type, value) {
  const normalizedType = normalizeVariableType(type);
  const text = String(value ?? "");

  if (normalizedType === "boolean") {
    return text === "true" ? "true" : "false";
  }

  if (normalizedType === "number") {
    const trimmed = text.trim();
    if (!trimmed) {
      return "";
    }
    return Number.isFinite(Number(trimmed)) ? String(Number(trimmed)) : "0";
  }

  if (normalizedType === "color") {
    const trimmed = text.trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed.toLowerCase() : "#8ad5ff";
  }

  if (normalizedType === "json") {
    const trimmed = text.trim();
    if (!trimmed) {
      return "{}";
    }
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  return text;
}

function mapToLayerArray(layerMap) {
  return Array.from(layerMap.entries())
    .map(([index, tile]) => {
      const [x, y] = index.split(",").map(Number);
      return { x, y, tile: Number(tile) };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function normalizeTileId(tileId) {
  return !tileId || !TILE_BY_ID.has(tileId) ? 0 : Number(tileId);
}

function normalizePaintBrushShape(shape) {
  return String(shape || "square").trim().toLowerCase() === "circle" ? "circle" : "square";
}

function normalizePaintBrushSize(value, min = 1, max = 8) {
  const safeMin = Math.max(1, Number.isFinite(Number(min)) ? Math.round(Number(min)) : 1);
  const safeMax = Math.max(safeMin, Number.isFinite(Number(max)) ? Math.round(Number(max)) : 8);
  const safeValue = Number.isFinite(Number(value)) ? Math.round(Number(value)) : safeMin;
  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function dedupeCellList(cells) {
  const seen = new Set();
  const unique = [];
  (Array.isArray(cells) ? cells : []).forEach((cell) => {
    const tx = Number(cell?.tx);
    const ty = Number(cell?.ty);
    if (!Number.isInteger(tx) || !Number.isInteger(ty)) {
      return;
    }

    const key = `${tx},${ty}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push({ tx, ty });
  });

  return unique;
}

function clampWorldToCell(scene, wx, wy) {
  const maxX = Math.max(0, scene.world.width - 1);
  const maxY = Math.max(0, scene.world.height - 1);
  const clampedX = Math.max(0, Math.min(maxX, Math.round(wx)));
  const clampedY = Math.max(0, Math.min(maxY, Math.round(wy)));
  return worldToCell(scene, clampedX, clampedY);
}

function applyTileChange(scene, layerMap, layer, tx, ty, nextTileId) {
  const key = `${tx},${ty}`;
  const prevTileId = layerMap.has(key) ? Number(layerMap.get(key)) : 0;

  if (prevTileId === nextTileId) {
    return false;
  }

  if (nextTileId === 0) {
    layerMap.delete(key);
  } else {
    layerMap.set(key, nextTileId);
  }

  const layers = readSceneLayers(scene);
  layers[layer] = mapToLayerArray(layerMap);
  scene.layers = layers;
  delete scene.tiles;
  return true;
}

function applyRuleVariantsForCells(scene, layerMap, layer, cells) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return;
  }

  const targets = new Set();
  cells.forEach((cell) => {
    if (!cell || !Number.isInteger(cell.tx) || !Number.isInteger(cell.ty)) {
      return;
    }

    [
      [cell.tx, cell.ty],
      [cell.tx + 1, cell.ty],
      [cell.tx - 1, cell.ty],
      [cell.tx, cell.ty + 1],
      [cell.tx, cell.ty - 1]
    ].forEach(([tx, ty]) => {
      targets.add(`${tx},${ty}`);
    });
  });

  let touched = false;
  targets.forEach((key) => {
    if (!layerMap.has(key)) {
      return;
    }

    const [tx, ty] = key.split(",").map(Number);
    const currentId = Number(layerMap.get(key));
    const nextId = resolveRuleVariantTileId(layerMap, tx, ty, currentId);
    if (nextId === currentId) {
      return;
    }

    layerMap.set(key, nextId);
    touched = true;
  });

  if (!touched) {
    return;
  }

  const layers = readSceneLayers(scene);
  layers[layer] = mapToLayerArray(layerMap);
  scene.layers = layers;
  delete scene.tiles;
}

function resolveRuleVariantTileId(layerMap, tx, ty, tileId) {
  const tile = TILE_BY_ID.get(Number(tileId));
  const variants = Array.isArray(tile?.ruleVariants) ? tile.ruleVariants.filter((id) => TILE_BY_ID.has(Number(id))).map((id) => Number(id)) : [];
  const group = String(tile?.ruleGroup || "").trim();
  if (!group || variants.length === 0) {
    return Number(tileId);
  }

  const neighbors = [
    [tx + 1, ty],
    [tx - 1, ty],
    [tx, ty + 1],
    [tx, ty - 1]
  ];

  const count = neighbors.reduce((total, [nx, ny]) => {
    const key = `${nx},${ny}`;
    if (!layerMap.has(key)) {
      return total;
    }

    const neighborId = Number(layerMap.get(key));
    const neighborTile = TILE_BY_ID.get(neighborId);
    return String(neighborTile?.ruleGroup || "") === group ? total + 1 : total;
  }, 0);

  const index = Math.max(0, Math.min(variants.length - 1, count));
  return variants[index];
}

function getPickableItems(scene, options = {}) {
  const camera = options?.camera || null;
  const viewportRenderer = options?.viewportRenderer === "native-3d" ? "native-3d" : "scene";
  const nativeConfig = viewportRenderer === "native-3d" ? createNativePreviewConfig(scene, camera, options?.viewport, options?.nativeCamera) : null;
  const mapItem = (ref, object) => ({
    ref,
    object,
    ...(nativeConfig
      ? (() => {
          const projected = projectNativeRect(object, scene, nativeConfig, {
            doorOpenAmount: object?.type === "door" && object?.isOpen === true ? 1 : 0
          });
          return {
            rect: projected.rect || object,
            depth: projected.rect?.depth ?? projected.prism?.depth ?? 0
          };
        })()
      : {
          rect: camera ? projectSceneRect(object, camera, scene) : object,
          depth: num(object?.z, 0)
        })
  });

  return [
    mapItem({ kind: "entity", id: "player" }, scene.player),
    mapItem({ kind: "entity", id: "enemy" }, scene.enemy),
    ...scene.walls.map((wall) => mapItem({ kind: "wall", id: wall.id }, wall)),
    ...(scene.gameObjects || []).map((item) => mapItem({ kind: "gameplayObject", id: item.id }, item))
  ].sort((left, right) => {
    const leftLayer = sortingLayerWeight(left.object?.sortingLayer);
    const rightLayer = sortingLayerWeight(right.object?.sortingLayer);
    if (leftLayer !== rightLayer) {
      return leftLayer - rightLayer;
    }

    const leftOrder = normalizeOrderInLayer(left.object?.orderInLayer);
    const rightOrder = normalizeOrderInLayer(right.object?.orderInLayer);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftDepth = num(left.depth, num(left.object?.z, 0));
    const rightDepth = num(right.depth, num(right.object?.z, 0));
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }

    return num(left.object?.y, 0) + num(left.object?.h, 0) - (num(right.object?.y, 0) + num(right.object?.h, 0));
  });
}

function sortingLayerWeight(layer) {
  const safeLayer = normalizeSortingLayer(layer);
  const index = SORTING_LAYERS.indexOf(safeLayer);
  return index >= 0 ? index : SORTING_LAYERS.indexOf("default");
}

function buildDuplicateCandidate(scene, sourceEntry, counters, offsetX, offsetY) {
  const source = sourceEntry.object;
  const duplicated = {
    ...source,
    x: Math.round(source.x + offsetX),
    y: Math.round(source.y + offsetY),
    actions: Array.isArray(source.actions) ? source.actions.map((action) => ({ ...action })) : []
  };

  if (sourceEntry.ref.kind === "wall") {
    const counter = counters.wallCounter;
    counters.wallCounter += 1;
    duplicated.id = `wall_${counter}`;
    duplicated.name = `${source.name || "Parede"} Copia`;
  } else {
    const counter = counters.gameplayCounter;
    counters.gameplayCounter += 1;
    duplicated.id = `go_${counter}`;
    duplicated.name = `${source.name || source.type || "Objeto"} Copia`;
    if (duplicated.type === "checkpoint") {
      duplicated.checkpointId = `checkpoint_${counter}`;
    }
  }

  duplicated.z = num(duplicated.z, 0);
  duplicated.x = snap(duplicated.x, scene.world.tileSize);
  duplicated.y = snap(duplicated.y, scene.world.tileSize);
  clampWorld(duplicated, scene.world);

  return {
    ref: {
      kind: sourceEntry.ref.kind,
      id: duplicated.id
    },
    object: duplicated
  };
}

function validateDuplicateCandidates(scene, candidates, tileMaps) {
  if (candidates.length === 0) {
    return false;
  }

  const allValid = candidates.every((entry) => validTransform(scene, entry.ref, entry.object, tileMaps));
  if (!allValid) {
    return false;
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const left = candidates[index];
    if (left.ref.kind !== "wall") {
      continue;
    }

    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      const right = candidates[otherIndex];
      if (right.ref.kind !== "wall") {
        continue;
      }

      if (overlap(left.object, right.object)) {
        return false;
      }
    }
  }

  return true;
}

function nextCounterFromIds(items, prefix) {
  let max = 0;
  (items || []).forEach((item) => {
    const match = String(item.id).match(new RegExp(`^${prefix.replace("_", "\\_")}(\\d+)$`, "i"));
    if (!match) {
      return;
    }

    const value = Number(match[1]);
    if (value > max) {
      max = value;
    }
  });

  return max + 1;
}

function filterSpawnsByTag(spawns, preferredTag) {
  const cleanTag = String(preferredTag || "").trim();
  if (!cleanTag) {
    return [];
  }

  return spawns.filter((spawn) => String(spawn.spawnTag || "").trim() === cleanTag);
}

function pickSpawnByPriority(spawns) {
  return [...spawns].sort((a, b) => num(b.priority, 0) - num(a.priority, 0) || a.y - b.y || a.x - b.x)[0] || null;
}

function sanitizeActor(source, id, name, color) {
  const actor = sanitizeRect(source, id, name, color);
  if (!actor) {
    return null;
  }

  actor.id = id;
  actor.type = id;
  actor.speed = Math.max(20, num(source.speed, id === "player" ? 210 : 130));
  actor.runMultiplier = Math.max(1, Number(source.runMultiplier || 1.75));
  actor.rigidbodyType = normalizeRigidbodyType(source.rigidbodyType || "kinematic");
  actor.colliderEnabled = source.colliderEnabled !== false;
  actor.colliderIsTrigger = source.colliderIsTrigger === true;
  return actor;
}

function sanitizeGameplayObject(source, index) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const type = String(source.type || "trigger");
  const defaults = {
    spawn: "#6ddfa3",
    trigger: "#ffcb6b",
    portal: "#76b7ff",
    checkpoint: "#f6a75a",
    door: "#b8793d",
    spriteShape: "#4cab6b",
    cameraZone: "#7baeff",
    light2d: "#ffd77a"
  };
  const color = defaults[type] || "#ffcb6b";
  const object = sanitizeRect(
    source,
    String(source.id || `go_${index + 1}`),
    String(source.name || `${type} ${index + 1}`),
    color
  );

  if (!object) {
    return null;
  }

  object.type = type;
  object.spawnTag = String(source.spawnTag || "");
  object.teamId = String(source.teamId || "");
  object.priority = num(source.priority, 0);
  object.triggerTag = String(source.triggerTag || "");
  object.conditionType = type === "trigger" ? normalizeTriggerConditionType(source.conditionType) : "always";
  object.conditionTargetTag = type === "trigger" ? String(source.conditionTargetTag || source.conditionKey || "") : "";
  object.conditionValue = type === "trigger" ? String(source.conditionValue || "") : "";
  object.actions = type === "trigger" ? getTriggerActions(source) : [];
  const primaryAction = object.actions[0] || createDefaultTriggerAction();
  object.actionType = primaryAction.type;
  object.actionValue = primaryAction.value;
  object.actionSceneId = primaryAction.sceneId;
  object.actionSpawnTag = primaryAction.spawnTag;
  object.actionTargetTag = primaryAction.targetTag;
  object.actionSpeaker = String(primaryAction.speaker || "");
  object.actionLines = Array.isArray(primaryAction.lines) ? primaryAction.lines.slice(0, 3) : ["", "", ""];
  object.actionX = Number.isFinite(Number(primaryAction.x)) ? Number(primaryAction.x) : 0;
  object.actionY = Number.isFinite(Number(primaryAction.y)) ? Number(primaryAction.y) : 0;
  object.actionDuration = Number.isFinite(Number(primaryAction.duration)) ? Number(primaryAction.duration) : 0.6;
  object.actionTimelineId = String(primaryAction.timelineId || "");
  object.interactionOnly = type === "trigger" ? source.interactionOnly === true : false;
  object.once = source.once === true;
  object.enabled = source.enabled !== false;
  object.doorTag = type === "door" ? String(source.doorTag || object.id) : "";
  object.startsOpen = type === "door" ? source.startsOpen === true : false;
  object.isOpen = type === "door" ? source.isOpen === true || object.startsOpen : false;
  object.targetSceneId = String(source.targetSceneId || "");
  object.targetSpawnTag = String(source.targetSpawnTag || "");
  object.targetTeamId = String(source.targetTeamId || "");
  object.fallbackMode = String(source.fallbackMode || "priority");
  object.checkpointId = String(source.checkpointId || "");
  object.sortingLayer = normalizeSortingLayer(source.sortingLayer);
  object.orderInLayer = normalizeOrderInLayer(source.orderInLayer);
  object.spriteId = String(source.spriteId || "");
  object.flipX = source.flipX === true;
  object.flipY = source.flipY === true;
  object.pivotX = normalizePivot(source.pivotX, 0);
  object.pivotY = normalizePivot(source.pivotY, 0);
  object.shapePoints = type === "spriteShape" ? String(source.shapePoints || "0,64;64,24;128,52;192,12;256,84") : "";
  object.shapeClosed = type === "spriteShape" ? source.shapeClosed !== false : false;
  object.shapeSmooth = type === "spriteShape" ? source.shapeSmooth !== false : false;
  object.shapeSegments = type === "spriteShape" ? Math.max(2, Number.isFinite(Number(source.shapeSegments)) ? Math.round(Number(source.shapeSegments)) : 12) : 0;
  object.shapeFill = type === "spriteShape" ? String(source.shapeFill || object.color || "#4cab6b") : "";
  object.shapeStroke = type === "spriteShape" ? String(source.shapeStroke || "#2f6f45") : "";
  object.shapeThickness = type === "spriteShape" ? Math.max(1, Number.isFinite(Number(source.shapeThickness)) ? Number(source.shapeThickness) : 3) : 0;
  object.cameraZonePriority = type === "cameraZone" ? (Number.isFinite(Number(source.cameraZonePriority)) ? Math.round(Number(source.cameraZonePriority)) : 0) : 0;
  object.cameraZoneZoom = type === "cameraZone" ? Math.max(0, Math.min(3, Number.isFinite(Number(source.cameraZoneZoom)) ? Number(source.cameraZoneZoom) : 0)) : 0;
  object.cameraZoneOffsetX = type === "cameraZone" ? (Number.isFinite(Number(source.cameraZoneOffsetX)) ? Number(source.cameraZoneOffsetX) : 0) : 0;
  object.cameraZoneOffsetY = type === "cameraZone" ? (Number.isFinite(Number(source.cameraZoneOffsetY)) ? Number(source.cameraZoneOffsetY) : 0) : 0;
  object.shakeOnEnter = type === "cameraZone" ? source.shakeOnEnter === true : false;
  object.shakeIntensity = type === "cameraZone" ? Math.max(0, Number.isFinite(Number(source.shakeIntensity)) ? Number(source.shakeIntensity) : 14) : 0;
  object.shakeDuration = type === "cameraZone" ? Math.max(0.01, Number.isFinite(Number(source.shakeDuration)) ? Number(source.shakeDuration) : 0.28) : 0;
  object.shakeFrequency = type === "cameraZone" ? Math.max(1, Number.isFinite(Number(source.shakeFrequency)) ? Number(source.shakeFrequency) : 32) : 0;
  object.lightRadius = type === "light2d" ? Math.max(16, Number.isFinite(Number(source.lightRadius)) ? Number(source.lightRadius) : 180) : 0;
  object.lightIntensity = type === "light2d" ? clamp01(source.lightIntensity, 0.92) : 0;
  object.lightColor = type === "light2d" ? String(source.lightColor || object.color || "#ffe3a6") : "";
  object.lightFlicker = type === "light2d" ? clamp01(source.lightFlicker, 0) : 0;
  object.castShadows = type === "light2d" ? source.castShadows !== false : false;

  const triggerLikeTypes = ["trigger", "cameraZone"];
  if (type === "spriteShape" || type === "light2d") {
    object.colliderEnabled = source.colliderEnabled === true;
    object.colliderIsTrigger = type === "light2d" ? true : false;
  } else if (type === "door" || type === "wall") {
    object.colliderEnabled = source.colliderEnabled !== false;
    object.colliderIsTrigger = false;
  } else {
    object.colliderEnabled = source.colliderEnabled !== false;
    object.colliderIsTrigger = source.colliderIsTrigger === true || triggerLikeTypes.includes(type);
  }

  const fallbackBodyType = type === "spriteShape" || type === "light2d" ? "static" : type === "spawn" || type === "checkpoint" || type === "trigger" || type === "portal" || type === "door" || type === "cameraZone" ? "static" : "kinematic";
  object.rigidbodyType = normalizeRigidbodyType(source.rigidbodyType || object.rigidbodyType || fallbackBodyType);
  object.gravityScale = Number.isFinite(Number(source.gravityScale)) ? Number(source.gravityScale) : Number(object.gravityScale || 0);
  object.linearDamping = Math.max(0, Number.isFinite(Number(source.linearDamping)) ? Number(source.linearDamping) : Number(object.linearDamping || 0));
  object.restitution = clamp01(source.restitution ?? object.restitution, 0);
  object.colliderW = Math.max(4, Number.isFinite(Number(source.colliderW)) ? Number(source.colliderW) : Number(object.colliderW || object.w));
  object.colliderH = Math.max(4, Number.isFinite(Number(source.colliderH)) ? Number(source.colliderH) : Number(object.colliderH || object.h));
  object.colliderOffsetX = Number.isFinite(Number(source.colliderOffsetX)) ? Number(source.colliderOffsetX) : Number(object.colliderOffsetX || 0);
  object.colliderOffsetY = Number.isFinite(Number(source.colliderOffsetY)) ? Number(source.colliderOffsetY) : Number(object.colliderOffsetY || 0);
  object.animationId = String(source.animationId || object.animationId || "");
  object.animationFps = Math.max(1, Number.isFinite(Number(source.animationFps)) ? Number(source.animationFps) : Number(object.animationFps || 8));
  object.animationLoop = source.animationLoop !== false;
  object.animationMode = normalizeAnimationMode(source.animationMode || object.animationMode || "loop");
  object.animationPlaying = source.animationPlaying !== false;
  object.animationOffset = Number.isFinite(Number(source.animationOffset)) ? Number(source.animationOffset) : Number(object.animationOffset || 0);
  object.spriteOpacity = clamp01(source.spriteOpacity ?? object.spriteOpacity, 1);
  object.prefabRef = String(source.prefabRef || object.prefabRef || "");
  object.parentRef = String(source.parentRef || object.parentRef || "");
  object.parentOffsetX = Number.isFinite(Number(source.parentOffsetX)) ? Number(source.parentOffsetX) : Number(object.parentOffsetX || 0);
  object.parentOffsetY = Number.isFinite(Number(source.parentOffsetY)) ? Number(source.parentOffsetY) : Number(object.parentOffsetY || 0);
  object.parentOffsetZ = Number.isFinite(Number(source.parentOffsetZ)) ? Number(source.parentOffsetZ) : Number(object.parentOffsetZ || 0);
  object.bones2D = String(source.bones2D || object.bones2D || "");
  object.bonesAnimate = source.bonesAnimate === true || object.bonesAnimate === true;
  return object;
}

function createDefaultTriggerAction() {
  return {
    type: "message",
    value: "",
    sceneId: "",
    spawnTag: "",
    targetTag: "",
    timelineId: ""
  };
}

function sanitizeTriggerAction(source) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const type = normalizeTriggerActionType(source.actionType || source.type || "message");
  if (type === "none") {
    return null;
  }

  const action = {
    type,
    value: String(source.value ?? source.actionValue ?? ""),
    sceneId: String(source.sceneId ?? source.actionSceneId ?? ""),
    spawnTag: String(source.spawnTag ?? source.actionSpawnTag ?? ""),
    targetTag: String(source.targetTag ?? source.actionTargetTag ?? "")
  };

  if (type === "play-timeline") {
    action.timelineId = String(source.timelineId ?? source.actionTimelineId ?? action.value ?? "");
    if (!action.value) {
      action.value = action.timelineId;
    }
  }

  if (type === "start-dialogue") {
    action.speaker = String(source.speaker ?? source.actionSpeaker ?? "");
    action.lines = sanitizeActionLines(source.lines ?? source.actionLines);
  }

  if (type === "move-player" || type === "move-camera") {
    action.x = Number.isFinite(Number(source.x ?? source.actionX)) ? Math.round(Number(source.x ?? source.actionX)) : 0;
    action.y = Number.isFinite(Number(source.y ?? source.actionY)) ? Math.round(Number(source.y ?? source.actionY)) : 0;
    action.duration = Math.max(0.05, Number.isFinite(Number(source.duration ?? source.actionDuration)) ? Number(source.duration ?? source.actionDuration) : 0.6);
  }

  return action;
}

function normalizeTriggerActionType(type) {
  const cleanType = String(type || "message");
  return TRIGGER_ACTION_TYPES.includes(cleanType) ? cleanType : "message";
}

function normalizeTriggerConditionType(type) {
  const cleanType = String(type || "always");
  return TRIGGER_CONDITION_TYPES.includes(cleanType) ? cleanType : "always";
}

function sanitizeActionLines(source) {
  const rawLines = Array.isArray(source) ? source : typeof source === "string" ? source.split("\n") : [];
  const lines = rawLines.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 3);
  while (lines.length < 3) {
    lines.push("");
  }
  return lines;
}

function normalizeSortingLayer(layer) {
  const clean = String(layer || "default").trim().toLowerCase();
  return SORTING_LAYERS.includes(clean) ? clean : "default";
}

function normalizeOrderInLayer(order) {
  return Number.isFinite(Number(order)) ? Math.round(Number(order)) : 0;
}

function normalizePivot(value, fallback) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function normalizeAnimationMode(mode) {
  const clean = String(mode || "loop").trim().toLowerCase();
  if (clean === "once" || clean === "pingpong" || clean === "loop") {
    return clean;
  }
  return "loop";
}

function clamp01(value, fallback = 0) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function clampSurfaceFriction(value, fallback = 0.22) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }

  return Math.max(0, Math.min(2, Number(value)));
}

function createDefaultSurfaceFriction() {
  return {
    default: 0.22,
    grass: 0.28,
    stone: 0.16,
    sand: 0.56,
    water: 0.86,
    lava: 0.94
  };
}

function sanitizeSurfaceFriction(source) {
  const defaults = createDefaultSurfaceFriction();
  const safeSource = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  return SURFACE_MATERIAL_IDS.reduce((acc, materialId) => {
    acc[materialId] = clampSurfaceFriction(safeSource[materialId], defaults[materialId]);
    return acc;
  }, {});
}

function sanitizeScenePhysics(source) {
  const safeSource = source && typeof source === "object" ? source : {};
  return {
    compositeCollider: safeSource.compositeCollider !== false,
    pixelPerfect: safeSource.pixelPerfect === true,
    pixelScale: Math.max(1, Number.isFinite(Number(safeSource.pixelScale)) ? Math.round(Number(safeSource.pixelScale)) : 1),
    surfaceFriction: sanitizeSurfaceFriction(safeSource.surfaceFriction)
  };
}

function sanitizeSceneCamera2D(source) {
  const mode = String(source?.mode || "follow").trim().toLowerCase();
  return {
    mode: mode === "snap" ? "snap" : "follow",
    damping: Math.max(0.01, Number.isFinite(Number(source?.damping)) ? Number(source.damping) : 0.16),
    deadZoneW: Math.max(0, Number.isFinite(Number(source?.deadZoneW)) ? Number(source.deadZoneW) : 220),
    deadZoneH: Math.max(0, Number.isFinite(Number(source?.deadZoneH)) ? Number(source.deadZoneH) : 132),
    lookAheadX: Number.isFinite(Number(source?.lookAheadX)) ? Number(source.lookAheadX) : 24,
    lookAheadY: Number.isFinite(Number(source?.lookAheadY)) ? Number(source.lookAheadY) : 16,
    confineToWorld: source?.confineToWorld !== false,
    zoom: Math.max(0.35, Math.min(3, Number.isFinite(Number(source?.zoom)) ? Number(source.zoom) : 1)),
    followDuringEdit: source?.followDuringEdit !== false,
    shakeEnabled: source?.shakeEnabled !== false,
    shakeIntensity: Math.max(0, Number.isFinite(Number(source?.shakeIntensity)) ? Number(source.shakeIntensity) : 12),
    shakeDuration: Math.max(0.01, Number.isFinite(Number(source?.shakeDuration)) ? Number(source.shakeDuration) : 0.28),
    shakeFrequency: Math.max(1, Number.isFinite(Number(source?.shakeFrequency)) ? Number(source.shakeFrequency) : 32)
  };
}

function sanitizeSceneLighting2D(source) {
  const ambientAlpha = Number.isFinite(Number(source?.ambientAlpha)) ? Number(source.ambientAlpha) : 0.58;
  const shadowAlpha = Number.isFinite(Number(source?.shadowAlpha)) ? Number(source.shadowAlpha) : 0.36;
  return {
    enabled: source?.enabled === true,
    ambientColor: String(source?.ambientColor || "#0b1220"),
    ambientAlpha: Math.max(0, Math.min(1, ambientAlpha)),
    shadowLength: Math.max(20, Number.isFinite(Number(source?.shadowLength)) ? Number(source.shadowLength) : 110),
    shadowAlpha: Math.max(0, Math.min(1, shadowAlpha))
  };
}

function sanitizeSceneUi2D(source) {
  return {
    showHud: source?.showHud !== false,
    showHints: source?.showHints !== false,
    showPauseOverlay: source?.showPauseOverlay !== false
  };
}

function sanitizeSceneAudio2D(source) {
  return {
    enabled: source?.enabled !== false,
    masterVolume: clamp01(source?.masterVolume, 0.85),
    sfxVolume: clamp01(source?.sfxVolume, 0.9),
    musicVolume: clamp01(source?.musicVolume, 0)
  };
}

function normalizeRigidbodyType(type) {
  const clean = String(type || "static").trim().toLowerCase();
  return RIGIDBODY_TYPES.includes(clean) ? clean : "static";
}

function sanitizeRect(source, id, name, color) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const x = num(source.x, Number.NaN);
  const y = num(source.y, Number.NaN);
  const z = num(source.z, 0);
  const w = Math.max(8, num(source.w, Number.NaN));
  const h = Math.max(8, num(source.h, Number.NaN));

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return null;
  }

  return {
    id,
    name,
    type: source.type || "wall",
    x,
    y,
    z,
    w,
    h,
    color: String(source.color || color),
    sortingLayer: normalizeSortingLayer(source.sortingLayer),
    orderInLayer: normalizeOrderInLayer(source.orderInLayer),
    spriteId: String(source.spriteId || ""),
    flipX: source.flipX === true,
    flipY: source.flipY === true,
    pivotX: normalizePivot(source.pivotX, 0),
    pivotY: normalizePivot(source.pivotY, 0),
    animationId: String(source.animationId || ""),
    animationFps: Math.max(1, Number.isFinite(Number(source.animationFps)) ? Number(source.animationFps) : 8),
    animationLoop: source.animationLoop !== false,
    animationMode: normalizeAnimationMode(source.animationMode || "loop"),
    animationPlaying: source.animationPlaying !== false,
    animationOffset: Number.isFinite(Number(source.animationOffset)) ? Number(source.animationOffset) : 0,
    spriteOpacity: clamp01(source.spriteOpacity, 1),
    rigidbodyType: normalizeRigidbodyType(source.rigidbodyType || "static"),
    gravityScale: Number.isFinite(Number(source.gravityScale)) ? Number(source.gravityScale) : 0,
    linearDamping: Math.max(0, Number.isFinite(Number(source.linearDamping)) ? Number(source.linearDamping) : 0),
    restitution: clamp01(source.restitution, 0),
    colliderEnabled: source.colliderEnabled !== false,
    colliderIsTrigger: source.colliderIsTrigger === true,
    colliderOffsetX: Number.isFinite(Number(source.colliderOffsetX)) ? Number(source.colliderOffsetX) : 0,
    colliderOffsetY: Number.isFinite(Number(source.colliderOffsetY)) ? Number(source.colliderOffsetY) : 0,
    colliderW: Math.max(4, Number.isFinite(Number(source.colliderW)) ? Number(source.colliderW) : w),
    colliderH: Math.max(4, Number.isFinite(Number(source.colliderH)) ? Number(source.colliderH) : h),
    prefabRef: String(source.prefabRef || ""),
    parentRef: String(source.parentRef || ""),
    parentOffsetX: Number.isFinite(Number(source.parentOffsetX)) ? Number(source.parentOffsetX) : 0,
    parentOffsetY: Number.isFinite(Number(source.parentOffsetY)) ? Number(source.parentOffsetY) : 0,
    parentOffsetZ: Number.isFinite(Number(source.parentOffsetZ)) ? Number(source.parentOffsetZ) : 0,
    bones2D: String(source.bones2D || ""),
    bonesAnimate: source.bonesAnimate === true
  };
}
