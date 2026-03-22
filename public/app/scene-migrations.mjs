import { SCENE_VERSION, SURFACE_MATERIAL_IDS, TILE_LAYERS, TRIGGER_ACTION_TYPES, TRIGGER_CONDITION_TYPES, VARIABLE_PRESETS, VARIABLE_TYPES } from "./constants.mjs";
import { normalizeSceneSpaceMode } from "./scene-space.mjs";

const MIGRATIONS = new Map([
  [0, migrateV0toV1],
  [1, migrateV1toV2],
  [2, migrateV2toV3],
  [3, migrateV3toV4],
  [4, migrateV4toV5],
  [5, migrateV5toV6],
  [6, migrateV6toV7],
  [7, migrateV7toV8],
  [8, migrateV8toV9],
  [9, migrateV9toV10],
  [10, migrateV10toV11],
  [11, migrateV11toV12],
  [12, migrateV12toV13],
  [13, migrateV13toV14],
  [14, migrateV14toV15],
  [15, migrateV15toV16],
  [16, migrateV16toV17],
  [17, migrateV17toV18]
]);

export function migrateSceneData(rawScene, targetVersion = SCENE_VERSION) {
  if (!rawScene || typeof rawScene !== "object") {
    return { ok: false, message: "estrutura principal ausente" };
  }

  const source = JSON.parse(JSON.stringify(rawScene));
  let scene = source;
  let version = Number.isInteger(scene.version) ? scene.version : 0;

  if (version > targetVersion) {
    return {
      ok: false,
      message: `versao ${version} nao suportada por este editor (maximo ${targetVersion})`
    };
  }

  while (version < targetVersion) {
    const migrateStep = MIGRATIONS.get(version);
    if (!migrateStep) {
      return {
        ok: false,
        message: `pipeline de migracao ausente para versao ${version}`
      };
    }

    scene = migrateStep(scene);
    version += 1;
    scene.version = version;
  }

  return { ok: true, scene };
}

function migrateV0toV1(scene) {
  return {
    ...scene,
    version: 1
  };
}

function migrateV1toV2(scene) {
  const next = {
    ...scene,
    version: 2,
    world: {
      ...(scene.world || {}),
      depth: Number.isFinite(Number(scene?.world?.depth)) ? Math.round(Number(scene.world.depth)) : 2000
    },
    space: {
      upAxis: "y",
      forwardAxis: "z",
      ...(scene.space || {}),
      mode: normalizeSceneSpaceMode(scene?.space?.mode)
    }
  };

  if (next.player && typeof next.player === "object") {
    next.player.z = Number.isFinite(Number(next.player.z)) ? Math.round(Number(next.player.z)) : 0;
  }

  if (next.enemy && typeof next.enemy === "object") {
    next.enemy.z = Number.isFinite(Number(next.enemy.z)) ? Math.round(Number(next.enemy.z)) : 0;

    if (Array.isArray(next.enemy.patrol)) {
      next.enemy.patrol = next.enemy.patrol.map((point) => ({
        ...point,
        z: Number.isFinite(Number(point?.z)) ? Math.round(Number(point.z)) : 0
      }));
    }
  }

  if (Array.isArray(next.walls)) {
    next.walls = next.walls.map((wall) => ({
      ...wall,
      z: Number.isFinite(Number(wall?.z)) ? Math.round(Number(wall.z)) : 0
    }));
  }

  return next;
}

function migrateV2toV3(scene) {
  const next = {
    ...scene,
    version: 3,
    layers: createEmptyLayers()
  };

  if (scene.layers && typeof scene.layers === "object") {
    TILE_LAYERS.forEach((layer) => {
      next.layers[layer] = normalizeLayerTiles(scene.layers[layer]);
    });
  } else {
    next.layers.gameplay = normalizeLayerTiles(scene.tiles);
  }

  if (Array.isArray(scene.tiles) && next.layers.gameplay.length === 0) {
    next.layers.gameplay = normalizeLayerTiles(scene.tiles);
  }

  delete next.tiles;
  return next;
}

function migrateV3toV4(scene) {
  return {
    ...scene,
    version: 4,
    gameObjects: Array.isArray(scene.gameObjects) ? scene.gameObjects : []
  };
}

function migrateV4toV5(scene) {
  return {
    ...scene,
    version: 5,
    gameObjects: Array.isArray(scene.gameObjects)
      ? scene.gameObjects.map((item) => ({
          ...item,
          targetSpawnTag: typeof item?.targetSpawnTag === "string" ? item.targetSpawnTag : ""
        }))
      : []
  };
}

function migrateV5toV6(scene) {
  return {
    ...scene,
    version: 6,
    gameObjects: Array.isArray(scene.gameObjects)
      ? scene.gameObjects.map((item) => ({
          ...item,
          teamId: typeof item?.teamId === "string" ? item.teamId : "",
          priority: Number.isFinite(Number(item?.priority)) ? Math.round(Number(item.priority)) : 0,
          targetTeamId: typeof item?.targetTeamId === "string" ? item.targetTeamId : "",
          fallbackMode: typeof item?.fallbackMode === "string" ? item.fallbackMode : "priority",
          actionType: typeof item?.actionType === "string" ? item.actionType : "message",
          actionValue: typeof item?.actionValue === "string" ? item.actionValue : "",
          actionSceneId: typeof item?.actionSceneId === "string" ? item.actionSceneId : "",
          actionSpawnTag: typeof item?.actionSpawnTag === "string" ? item.actionSpawnTag : "",
          once: item?.once === true,
          enabled: item?.enabled !== false
        }))
      : []
  };
}

function migrateV6toV7(scene) {
  return {
    ...scene,
    version: 7,
    gameObjects: Array.isArray(scene.gameObjects)
      ? scene.gameObjects.map((item) => {
          const isTrigger = item?.type === "trigger";
          return {
            ...item,
            conditionType: isTrigger ? normalizeTriggerConditionType(item?.conditionType) : "always",
            conditionValue: isTrigger ? String(item?.conditionValue || "") : "",
            actions: isTrigger ? normalizeTriggerActions(item) : []
          };
        })
      : []
  };
}

function migrateV7toV8(scene) {
  return {
    ...scene,
    version: 8,
    gameObjects: Array.isArray(scene.gameObjects)
      ? scene.gameObjects.map((item) => ({
          ...item,
          doorTag: item?.type === "door" ? String(item?.doorTag || item?.id || "door_main") : "",
          startsOpen: item?.type === "door" ? item?.startsOpen === true : false,
          isOpen: item?.type === "door" ? item?.isOpen === true || item?.startsOpen === true : false,
          actions: item?.type === "trigger" ? normalizeTriggerActionsV8(item) : Array.isArray(item?.actions) ? item.actions : []
        }))
      : []
  };
}

function migrateV8toV9(scene) {
  return {
    ...scene,
    version: 9,
    space: {
      upAxis: "y",
      forwardAxis: "z",
      ...(scene.space || {}),
      mode: normalizeSceneSpaceMode(scene?.space?.mode)
    },
    gameObjects: Array.isArray(scene.gameObjects)
      ? scene.gameObjects.map((item) => ({
          ...item,
          conditionTargetTag: item?.type === "trigger" ? String(item?.conditionTargetTag || item?.conditionKey || "") : "",
          actions: item?.type === "trigger" ? normalizeTriggerActions(item) : Array.isArray(item?.actions) ? item.actions : []
        }))
      : []
  };
}

function migrateV9toV10(scene) {
  return {
    ...scene,
    version: 10,
    variables: normalizeVariables(scene?.variables)
  };
}

function migrateV10toV11(scene) {
  const variables = normalizeVariables(scene?.variables);
  return {
    ...scene,
    version: 11,
    variables,
    variableMeta: normalizeVariableMeta(scene?.variableMeta, variables)
  };
}

function migrateV11toV12(scene) {
  const variables = normalizeVariables(scene?.variables);
  return {
    ...scene,
    version: 12,
    variables,
    variableMeta: normalizeVariableMeta(scene?.variableMeta, variables)
  };
}

function migrateV12toV13(scene) {
  const variables = normalizeVariables(scene?.variables);
  return {
    ...scene,
    version: 13,
    variables,
    variableMeta: normalizeVariableMeta(scene?.variableMeta, variables),
    gameObjects: Array.isArray(scene.gameObjects)
      ? scene.gameObjects.map((item) => ({
          ...item,
          interactionOnly: item?.type === "trigger" ? item?.interactionOnly === true : false,
          actions: item?.type === "trigger" ? normalizeTriggerActionsV13(item) : Array.isArray(item?.actions) ? item.actions : []
        }))
      : []
  };
}

function migrateV13toV14(scene) {
  const normalizeActor = (actor) =>
    actor && typeof actor === "object"
      ? {
          ...actor,
          sortingLayer: normalizeSortingLayer(actor.sortingLayer),
          orderInLayer: normalizeOrderInLayer(actor.orderInLayer),
          spriteId: typeof actor.spriteId === "string" ? actor.spriteId : "",
          flipX: actor.flipX === true,
          flipY: actor.flipY === true,
          pivotX: normalizePivot(actor.pivotX, 0),
          pivotY: normalizePivot(actor.pivotY, 0)
        }
      : actor;

  const normalizeWall = (wall) => ({
    ...wall,
    sortingLayer: normalizeSortingLayer(wall?.sortingLayer),
    orderInLayer: normalizeOrderInLayer(wall?.orderInLayer),
    spriteId: typeof wall?.spriteId === "string" ? wall.spriteId : "",
    flipX: wall?.flipX === true,
    flipY: wall?.flipY === true,
    pivotX: normalizePivot(wall?.pivotX, 0),
    pivotY: normalizePivot(wall?.pivotY, 0)
  });

  const normalizeGameplay = (item) => {
    const base = {
      ...item,
      sortingLayer: normalizeSortingLayer(item?.sortingLayer),
      orderInLayer: normalizeOrderInLayer(item?.orderInLayer),
      spriteId: typeof item?.spriteId === "string" ? item.spriteId : "",
      flipX: item?.flipX === true,
      flipY: item?.flipY === true,
      pivotX: normalizePivot(item?.pivotX, 0),
      pivotY: normalizePivot(item?.pivotY, 0)
    };

    if (item?.type !== "spriteShape") {
      return base;
    }

    return {
      ...base,
      shapePoints: typeof item?.shapePoints === "string" ? item.shapePoints : "0,64;64,24;128,52;192,12;256,84",
      shapeClosed: item?.shapeClosed !== false,
      shapeFill: typeof item?.shapeFill === "string" ? item.shapeFill : "#4cab6b",
      shapeStroke: typeof item?.shapeStroke === "string" ? item.shapeStroke : "#2f6f45",
      shapeThickness: Math.max(1, Number.isFinite(Number(item?.shapeThickness)) ? Number(item.shapeThickness) : 3)
    };
  };

  return {
    ...scene,
    version: 14,
    player: normalizeActor(scene?.player),
    enemy: normalizeActor(scene?.enemy),
    walls: Array.isArray(scene?.walls) ? scene.walls.map((wall) => normalizeWall(wall)) : [],
    gameObjects: Array.isArray(scene?.gameObjects) ? scene.gameObjects.map((item) => normalizeGameplay(item)) : []
  };
}

function migrateV14toV15(scene) {
  const normalizeHierarchy = (item) =>
    item && typeof item === "object"
      ? {
          ...item,
          parentRef: typeof item.parentRef === "string" ? item.parentRef : "",
          parentOffsetX: Number.isFinite(Number(item.parentOffsetX)) ? Number(item.parentOffsetX) : 0,
          parentOffsetY: Number.isFinite(Number(item.parentOffsetY)) ? Number(item.parentOffsetY) : 0,
          parentOffsetZ: Number.isFinite(Number(item.parentOffsetZ)) ? Number(item.parentOffsetZ) : 0,
          bones2D: typeof item.bones2D === "string" ? item.bones2D : "",
          bonesAnimate: item.bonesAnimate === true
        }
      : item;

  return {
    ...scene,
    version: 15,
    physics: {
      compositeCollider: scene?.physics?.compositeCollider !== false,
      pixelPerfect: scene?.physics?.pixelPerfect === true,
      pixelScale: Math.max(1, Number.isFinite(Number(scene?.physics?.pixelScale)) ? Math.round(Number(scene.physics.pixelScale)) : 1)
    },
    player: normalizeHierarchy(scene?.player),
    enemy: normalizeHierarchy(scene?.enemy),
    walls: Array.isArray(scene?.walls) ? scene.walls.map((item) => normalizeHierarchy(item)) : [],
    gameObjects: Array.isArray(scene?.gameObjects) ? scene.gameObjects.map((item) => normalizeHierarchy(item)) : []
  };
}

function migrateV15toV16(scene) {
  const normalizeAction = (action) => {
    if (!action || typeof action !== "object") {
      return action;
    }

    const type = String(action.type || action.actionType || "message");
    if (type !== "play-timeline") {
      return action;
    }

    const timelineId = String(action.timelineId ?? action.actionTimelineId ?? action.value ?? "").trim();
    return {
      ...action,
      timelineId,
      value: String(action.value || timelineId)
    };
  };

  const normalizeGameplay = (item) =>
    item && typeof item === "object"
      ? {
          ...item,
          shapeSmooth: item.type === "spriteShape" ? item.shapeSmooth !== false : item.shapeSmooth,
          shapeSegments:
            item.type === "spriteShape"
              ? Math.max(2, Number.isFinite(Number(item.shapeSegments)) ? Math.round(Number(item.shapeSegments)) : 12)
              : item.shapeSegments,
          lightRadius: item.type === "light2d" ? Math.max(16, Number.isFinite(Number(item.lightRadius)) ? Number(item.lightRadius) : 180) : item.lightRadius,
          lightIntensity: item.type === "light2d" ? Math.max(0, Math.min(1, Number.isFinite(Number(item.lightIntensity)) ? Number(item.lightIntensity) : 0.92)) : item.lightIntensity,
          lightColor: item.type === "light2d" ? String(item.lightColor || item.color || "#ffe3a6") : item.lightColor,
          lightFlicker: item.type === "light2d" ? Math.max(0, Math.min(1, Number.isFinite(Number(item.lightFlicker)) ? Number(item.lightFlicker) : 0)) : item.lightFlicker,
          castShadows: item.type === "light2d" ? item.castShadows !== false : item.castShadows,
          actions: Array.isArray(item.actions) ? item.actions.map((action) => normalizeAction(action)) : item.actions
        }
      : item;

  return {
    ...scene,
    version: 16,
    camera2D: {
      mode: String(scene?.camera2D?.mode || "follow") === "snap" ? "snap" : "follow",
      damping: Math.max(0.01, Number.isFinite(Number(scene?.camera2D?.damping)) ? Number(scene.camera2D.damping) : 0.16),
      deadZoneW: Math.max(0, Number.isFinite(Number(scene?.camera2D?.deadZoneW)) ? Number(scene.camera2D.deadZoneW) : 220),
      deadZoneH: Math.max(0, Number.isFinite(Number(scene?.camera2D?.deadZoneH)) ? Number(scene.camera2D.deadZoneH) : 132),
      lookAheadX: Number.isFinite(Number(scene?.camera2D?.lookAheadX)) ? Number(scene.camera2D.lookAheadX) : 24,
      lookAheadY: Number.isFinite(Number(scene?.camera2D?.lookAheadY)) ? Number(scene.camera2D.lookAheadY) : 16,
      confineToWorld: scene?.camera2D?.confineToWorld !== false,
      zoom: Math.max(0.35, Math.min(3, Number.isFinite(Number(scene?.camera2D?.zoom)) ? Number(scene.camera2D.zoom) : 1)),
      followDuringEdit: scene?.camera2D?.followDuringEdit !== false
    },
    lighting2D: {
      enabled: scene?.lighting2D?.enabled === true,
      ambientColor: String(scene?.lighting2D?.ambientColor || "#0b1220"),
      ambientAlpha: Math.max(0, Math.min(1, Number.isFinite(Number(scene?.lighting2D?.ambientAlpha)) ? Number(scene.lighting2D.ambientAlpha) : 0.58)),
      shadowLength: Math.max(20, Number.isFinite(Number(scene?.lighting2D?.shadowLength)) ? Number(scene.lighting2D.shadowLength) : 110),
      shadowAlpha: Math.max(0, Math.min(1, Number.isFinite(Number(scene?.lighting2D?.shadowAlpha)) ? Number(scene.lighting2D.shadowAlpha) : 0.36))
    },
    gameObjects: Array.isArray(scene?.gameObjects) ? scene.gameObjects.map((item) => normalizeGameplay(item)) : []
  };
}

function migrateV16toV17(scene) {
  const normalizeGameplay = (item) => {
    if (!item || typeof item !== "object" || item.type !== "cameraZone") {
      return item;
    }

    return {
      ...item,
      cameraZonePriority: Number.isFinite(Number(item.cameraZonePriority)) ? Math.round(Number(item.cameraZonePriority)) : 0,
      cameraZoneZoom: Math.max(0, Math.min(3, Number.isFinite(Number(item.cameraZoneZoom)) ? Number(item.cameraZoneZoom) : 0)),
      cameraZoneOffsetX: Number.isFinite(Number(item.cameraZoneOffsetX)) ? Number(item.cameraZoneOffsetX) : 0,
      cameraZoneOffsetY: Number.isFinite(Number(item.cameraZoneOffsetY)) ? Number(item.cameraZoneOffsetY) : 0,
      shakeOnEnter: item.shakeOnEnter === true,
      shakeIntensity: Math.max(0, Number.isFinite(Number(item.shakeIntensity)) ? Number(item.shakeIntensity) : 14),
      shakeDuration: Math.max(0.01, Number.isFinite(Number(item.shakeDuration)) ? Number(item.shakeDuration) : 0.28),
      shakeFrequency: Math.max(1, Number.isFinite(Number(item.shakeFrequency)) ? Number(item.shakeFrequency) : 32),
      colliderEnabled: item.colliderEnabled !== false,
      colliderIsTrigger: true
    };
  };

  return {
    ...scene,
    version: 17,
    physics: {
      compositeCollider: scene?.physics?.compositeCollider !== false,
      pixelPerfect: scene?.physics?.pixelPerfect === true,
      pixelScale: Math.max(1, Number.isFinite(Number(scene?.physics?.pixelScale)) ? Math.round(Number(scene.physics.pixelScale)) : 1),
      surfaceFriction: normalizeSurfaceFriction(scene?.physics?.surfaceFriction)
    },
    camera2D: {
      mode: String(scene?.camera2D?.mode || "follow") === "snap" ? "snap" : "follow",
      damping: Math.max(0.01, Number.isFinite(Number(scene?.camera2D?.damping)) ? Number(scene.camera2D.damping) : 0.16),
      deadZoneW: Math.max(0, Number.isFinite(Number(scene?.camera2D?.deadZoneW)) ? Number(scene.camera2D.deadZoneW) : 220),
      deadZoneH: Math.max(0, Number.isFinite(Number(scene?.camera2D?.deadZoneH)) ? Number(scene.camera2D.deadZoneH) : 132),
      lookAheadX: Number.isFinite(Number(scene?.camera2D?.lookAheadX)) ? Number(scene.camera2D.lookAheadX) : 24,
      lookAheadY: Number.isFinite(Number(scene?.camera2D?.lookAheadY)) ? Number(scene.camera2D.lookAheadY) : 16,
      confineToWorld: scene?.camera2D?.confineToWorld !== false,
      zoom: Math.max(0.35, Math.min(3, Number.isFinite(Number(scene?.camera2D?.zoom)) ? Number(scene.camera2D.zoom) : 1)),
      followDuringEdit: scene?.camera2D?.followDuringEdit !== false,
      shakeEnabled: scene?.camera2D?.shakeEnabled !== false,
      shakeIntensity: Math.max(0, Number.isFinite(Number(scene?.camera2D?.shakeIntensity)) ? Number(scene.camera2D.shakeIntensity) : 12),
      shakeDuration: Math.max(0.01, Number.isFinite(Number(scene?.camera2D?.shakeDuration)) ? Number(scene.camera2D.shakeDuration) : 0.28),
      shakeFrequency: Math.max(1, Number.isFinite(Number(scene?.camera2D?.shakeFrequency)) ? Number(scene.camera2D.shakeFrequency) : 32)
    },
    gameObjects: Array.isArray(scene?.gameObjects) ? scene.gameObjects.map((item) => normalizeGameplay(item)) : []
  };
}

function migrateV17toV18(scene) {
  return {
    ...scene,
    version: 18,
    ui2D: {
      showHud: scene?.ui2D?.showHud !== false,
      showHints: scene?.ui2D?.showHints !== false,
      showPauseOverlay: scene?.ui2D?.showPauseOverlay !== false
    },
    audio2D: {
      enabled: scene?.audio2D?.enabled !== false,
      masterVolume: Math.max(0, Math.min(1, Number.isFinite(Number(scene?.audio2D?.masterVolume)) ? Number(scene.audio2D.masterVolume) : 0.85)),
      sfxVolume: Math.max(0, Math.min(1, Number.isFinite(Number(scene?.audio2D?.sfxVolume)) ? Number(scene.audio2D.sfxVolume) : 0.9)),
      musicVolume: Math.max(0, Math.min(1, Number.isFinite(Number(scene?.audio2D?.musicVolume)) ? Number(scene.audio2D.musicVolume) : 0))
    }
  };
}

function createEmptyLayers() {
  return {
    background: [],
    gameplay: [],
    collision: [],
    foreground: []
  };
}

function normalizeLayerTiles(tiles) {
  if (!Array.isArray(tiles)) {
    return [];
  }

  return tiles
    .map((tile) => ({
      x: Number.isFinite(Number(tile?.x)) ? Math.round(Number(tile.x)) : Number.NaN,
      y: Number.isFinite(Number(tile?.y)) ? Math.round(Number(tile.y)) : Number.NaN,
      tile: Number.isFinite(Number(tile?.tile)) ? Math.round(Number(tile.tile)) : Number.NaN
    }))
    .filter((tile) => Number.isInteger(tile.x) && Number.isInteger(tile.y) && Number.isInteger(tile.tile));
}

function normalizeSurfaceFriction(source) {
  const defaults = {
    default: 0.22,
    grass: 0.28,
    stone: 0.16,
    sand: 0.56,
    water: 0.86,
    lava: 0.94
  };
  const safeSource = source && typeof source === "object" && !Array.isArray(source) ? source : {};

  return SURFACE_MATERIAL_IDS.reduce((acc, materialId) => {
    const fallback = defaults[materialId];
    const value = Number.isFinite(Number(safeSource[materialId])) ? Number(safeSource[materialId]) : fallback;
    acc[materialId] = Math.max(0, Math.min(2, value));
    return acc;
  }, {});
}

function normalizeTriggerActions(item) {
  const useExplicitArray = Array.isArray(item?.actions);
  const sourceActions = useExplicitArray ? item.actions : [item];
  const actions = sourceActions
    .map((entry) => normalizeTriggerAction(entry))
    .filter(Boolean)
    .slice(0, 3);

  if (useExplicitArray) {
    return actions;
  }

  return actions.length > 0 ? actions : [{ type: "message", value: "", sceneId: "", spawnTag: "", targetTag: "" }];
}

function normalizeTriggerActionsV8(item) {
  const baseActions = normalizeTriggerActions(item);
  return baseActions.map((action, index) => ({
    ...action,
    targetTag: Array.isArray(item?.actions) && item.actions[index] ? String(item.actions[index]?.targetTag || "") : ""
  }));
}

function normalizeTriggerActionsV13(item) {
  const baseActions = normalizeTriggerActions(item);
  return baseActions.map((action, index) => {
    const sourceAction = Array.isArray(item?.actions) && item.actions[index] ? item.actions[index] : item;
    const nextAction = { ...action };
    if (action.type === "start-dialogue") {
      nextAction.speaker = String(sourceAction?.speaker ?? sourceAction?.actionSpeaker ?? "");
      nextAction.lines = normalizeActionLines(sourceAction?.lines ?? sourceAction?.actionLines);
    }
    if (action.type === "move-player" || action.type === "move-camera") {
      nextAction.x = Number.isFinite(Number(sourceAction?.x ?? sourceAction?.actionX)) ? Math.round(Number(sourceAction.x ?? sourceAction.actionX)) : 0;
      nextAction.y = Number.isFinite(Number(sourceAction?.y ?? sourceAction?.actionY)) ? Math.round(Number(sourceAction.y ?? sourceAction.actionY)) : 0;
      nextAction.duration = Math.max(0.05, Number.isFinite(Number(sourceAction?.duration ?? sourceAction?.actionDuration)) ? Number(sourceAction.duration ?? sourceAction.actionDuration) : 0.6);
    }
    return nextAction;
  });
}

function normalizeTriggerAction(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const type = normalizeTriggerActionType(entry.actionType || entry.type || "message");
  if (type === "none") {
    return null;
  }

  const action = {
    type,
    value: String(entry.value ?? entry.actionValue ?? ""),
    sceneId: String(entry.sceneId ?? entry.actionSceneId ?? ""),
    spawnTag: String(entry.spawnTag ?? entry.actionSpawnTag ?? ""),
    targetTag: String(entry.targetTag ?? entry.actionTargetTag ?? "")
  };

  if (type === "start-dialogue") {
    action.speaker = String(entry.speaker ?? entry.actionSpeaker ?? "");
    action.lines = normalizeActionLines(entry.lines ?? entry.actionLines);
  }

  if (type === "move-player" || type === "move-camera") {
    action.x = Number.isFinite(Number(entry.x ?? entry.actionX)) ? Math.round(Number(entry.x ?? entry.actionX)) : 0;
    action.y = Number.isFinite(Number(entry.y ?? entry.actionY)) ? Math.round(Number(entry.y ?? entry.actionY)) : 0;
    action.duration = Math.max(0.05, Number.isFinite(Number(entry.duration ?? entry.actionDuration)) ? Number(entry.duration ?? entry.actionDuration) : 0.6);
  }

  return action;
}

function normalizeTriggerActionType(type) {
  const cleanType = String(type || "message");
  return TRIGGER_ACTION_TYPES.includes(cleanType) ? cleanType : "message";
}

function normalizeActionLines(source) {
  const rawLines = Array.isArray(source) ? source : typeof source === "string" ? source.split("\n") : [];
  const lines = rawLines.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 3);
  while (lines.length < 3) {
    lines.push("");
  }
  return lines;
}

function normalizeVariables(source) {
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

function normalizeVariableMeta(source, variables = {}) {
  const keys = new Set([
    ...Object.keys(variables || {}),
    ...(source && typeof source === "object" && !Array.isArray(source) ? Object.keys(source) : [])
  ]);

  const meta = {};
  keys.forEach((rawKey) => {
    const key = String(rawKey || "").trim();
    if (!key) {
      return;
    }

    meta[key] = {
      type: normalizeVariableType(source?.[key]?.type || inferVariableType(variables?.[key])),
      preset: normalizeVariablePreset(source?.[key]?.preset)
    };
  });

  return meta;
}

function inferVariableType(value) {
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
      // Ignore invalid JSON and keep falling through.
    }
  }

  if (text !== "" && Number.isFinite(Number(text))) {
    return "number";
  }

  return "string";
}

function normalizeVariableType(type) {
  const cleanType = String(type || "string").trim().toLowerCase();
  return VARIABLE_TYPES.includes(cleanType) ? cleanType : "string";
}

function normalizeVariablePreset(preset) {
  const cleanPreset = String(preset || "none").trim().toLowerCase();
  return VARIABLE_PRESETS.includes(cleanPreset) ? cleanPreset : "none";
}

function normalizeTriggerConditionType(type) {
  const cleanType = String(type || "always");
  return TRIGGER_CONDITION_TYPES.includes(cleanType) ? cleanType : "always";
}

function normalizeSortingLayer(layer) {
  const clean = String(layer || "default").trim().toLowerCase();
  return ["background", "default", "foreground", "ui"].includes(clean) ? clean : "default";
}

function normalizeOrderInLayer(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
}

function normalizePivot(value, fallback) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Number(value)));
}
