import test from "node:test";
import assert from "node:assert/strict";

import { SCENE_VERSION } from "../public/app/constants.mjs";
import { validateScene } from "../public/app/core-scene.mjs";
import { migrateSceneData } from "../public/app/scene-migrations.mjs";

function createLegacyScene() {
  return {
    world: { width: 1000, height: 700, tileSize: 32 },
    player: { x: 40, y: 40, w: 30, h: 30, speed: 180, runMultiplier: 1.6, color: "#8ad5ff" },
    enemy: {
      x: 360,
      y: 240,
      w: 30,
      h: 30,
      speed: 120,
      color: "#ff7a66",
      patrol: [{ x: 360, y: 240 }, { x: 500, y: 240 }]
    },
    walls: [{ id: "wall_1", x: 600, y: 300, w: 90, h: 32, color: "#7d8895" }],
    tiles: [{ x: 0, y: 0, tile: 1 }]
  };
}

test("validateScene migra cena legada sem version para schema atual", () => {
  const result = validateScene(createLegacyScene());
  assert.equal(result.ok, true);
  assert.equal(result.scene.version, SCENE_VERSION);
  assert.equal(result.scene.world.depth, 2000);
  assert.equal(result.scene.space.forwardAxis, "z");
  assert.equal(result.scene.player.z, 0);
  assert.equal(result.scene.enemy.z, 0);
  assert.equal(result.scene.enemy.patrol[0].z, 0);
  assert.equal(Array.isArray(result.scene.layers.background), true);
  assert.equal(Array.isArray(result.scene.layers.gameplay), true);
  assert.equal(Array.isArray(result.scene.layers.collision), true);
  assert.equal(Array.isArray(result.scene.layers.foreground), true);
  assert.equal(Array.isArray(result.scene.gameObjects), true);
  assert.equal(result.scene.layers.gameplay.length, 1);
  assert.equal(result.scene.layers.gameplay[0].tile, 1);
});

test("migrateSceneData migra scene version 1 para schema atual preservando valores existentes", () => {
  const v1Scene = {
    version: 1,
    world: { width: 900, height: 600, depth: 3500, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 80, y: 60, z: 4, w: 30, h: 30, speed: 150 },
    enemy: { x: 300, y: 220, z: 7, w: 30, h: 30, speed: 120, patrol: [{ x: 300, y: 220, z: 9 }] },
    walls: [{ id: "wall_1", x: 650, y: 100, z: 2, w: 40, h: 200 }],
    tiles: []
  };

  const migrated = migrateSceneData(v1Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.world.depth, 3500);
  assert.equal(migrated.scene.player.z, 4);
  assert.equal(migrated.scene.enemy.z, 7);
  assert.equal(migrated.scene.enemy.patrol[0].z, 9);
  assert.equal(migrated.scene.walls[0].z, 2);
  assert.equal(Array.isArray(migrated.scene.layers.gameplay), true);
  assert.equal(migrated.scene.layers.gameplay.length, 0);
  assert.equal(Array.isArray(migrated.scene.gameObjects), true);
  assert.equal("tiles" in migrated.scene, false);
});

test("migrateSceneData migra scene version 2 para schema atual convertendo tiles para layers.gameplay", () => {
  const v2Scene = {
    version: 2,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    tiles: [{ x: 1, y: 2, tile: 3 }]
  };

  const migrated = migrateSceneData(v2Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(Array.isArray(migrated.scene.layers.background), true);
  assert.equal(Array.isArray(migrated.scene.layers.gameplay), true);
  assert.equal(Array.isArray(migrated.scene.layers.collision), true);
  assert.equal(Array.isArray(migrated.scene.layers.foreground), true);
  assert.equal(Array.isArray(migrated.scene.gameObjects), true);
  assert.equal(migrated.scene.layers.gameplay.length, 1);
  assert.deepEqual(migrated.scene.layers.gameplay[0], { x: 1, y: 2, tile: 3 });
  assert.equal("tiles" in migrated.scene, false);
});

test("migrateSceneData migra scene version 3 para 4 adicionando gameObjects", () => {
  const v3Scene = {
    version: 3,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v3Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.deepEqual(migrated.scene.gameObjects, []);
});

test("migrateSceneData migra scene version 4 para 5 adicionando targetSpawnTag", () => {
  const v4Scene = {
    version: 4,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    gameObjects: [
      { id: "go_1", type: "portal", x: 96, y: 96, z: 0, w: 32, h: 64, targetSceneId: "scene_2" }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v4Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.gameObjects[0].targetSpawnTag, "");
});

test("migrateSceneData migra scene version 5 para 6 adicionando gameplay avancado", () => {
  const v5Scene = {
    version: 5,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    gameObjects: [
      { id: "go_1", type: "spawn", x: 64, y: 64, z: 0, w: 32, h: 32, spawnTag: "start" },
      { id: "go_2", type: "portal", x: 96, y: 96, z: 0, w: 32, h: 64, targetSceneId: "scene_2", targetSpawnTag: "arena" }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v5Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.gameObjects[0].teamId, "");
  assert.equal(migrated.scene.gameObjects[0].priority, 0);
  assert.equal(migrated.scene.gameObjects[1].fallbackMode, "priority");
  assert.equal(migrated.scene.gameObjects[1].targetTeamId, "");
});

test("migrateSceneData migra scene version 6 para 7 adicionando condicoes e acoes encadeadas", () => {
  const v6Scene = {
    version: 6,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    gameObjects: [
      {
        id: "go_1",
        type: "trigger",
        x: 96,
        y: 96,
        z: 0,
        w: 64,
        h: 64,
        triggerTag: "gate",
        actionType: "switch-scene",
        actionSceneId: "scene_2",
        actionSpawnTag: "arena"
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v6Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.gameObjects[0].conditionType, "always");
  assert.deepEqual(migrated.scene.gameObjects[0].actions, [
    { type: "switch-scene", value: "", sceneId: "scene_2", spawnTag: "arena", targetTag: "" }
  ]);
});

test("migrateSceneData migra scene version 7 para 8 adicionando targetTag e defaults de door", () => {
  const v7Scene = {
    version: 7,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    gameObjects: [
      {
        id: "go_1",
        type: "trigger",
        x: 96,
        y: 96,
        z: 0,
        w: 64,
        h: 64,
        actions: [{ type: "open-door", value: "", sceneId: "", spawnTag: "" }]
      },
      {
        id: "go_2",
        type: "door",
        x: 160,
        y: 96,
        z: 0,
        w: 32,
        h: 64
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v7Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.gameObjects[0].actions[0].targetTag, "");
  assert.equal(migrated.scene.gameObjects[1].doorTag, "go_2");
  assert.equal(migrated.scene.gameObjects[1].isOpen, false);
});

test("migrateSceneData migra scene version 8 para 9 adicionando conditionTargetTag e normalizando space mode", () => {
  const v8Scene = {
    version: 8,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "wireframe-x" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    gameObjects: [
      {
        id: "go_1",
        type: "trigger",
        x: 96,
        y: 96,
        z: 0,
        w: 64,
        h: 64,
        conditionType: "var-is",
        conditionValue: "1",
        actions: [{ type: "set-variable", value: "1", sceneId: "", spawnTag: "", targetTag: "gate_open" }]
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v8Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.space.mode, "2d");
  assert.equal(migrated.scene.gameObjects[0].conditionTargetTag, "");
  assert.equal(migrated.scene.gameObjects[0].actions[0].targetTag, "gate_open");
});

test("migrateSceneData migra scene version 9 para 10 adicionando variables", () => {
  const v9Scene = {
    version: 9,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "3d-preview", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    gameObjects: [],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v9Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.deepEqual(migrated.scene.variables, {});
  assert.deepEqual(migrated.scene.variableMeta, {});
});

test("migrateSceneData migra scene version 10 para 11 adicionando variableMeta", () => {
  const v10Scene = {
    version: 10,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    variables: { gate_open: "1", debug_name: "north" },
    gameObjects: [],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v10Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.deepEqual(migrated.scene.variableMeta, {
    gate_open: { type: "number", preset: "none" },
    debug_name: { type: "string", preset: "none" }
  });
});

test("migrateSceneData migra scene version 11 para 12 normalizando presets e tipos extras", () => {
  const v11Scene = {
    version: 11,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    variables: {
      accent_color: "#ff8800",
      route_data: "{\"loop\":true}",
      active_scene: "scene_2"
    },
    variableMeta: {
      accent_color: { type: "color" },
      route_data: { type: "json" },
      active_scene: { type: "string", preset: "scene-id" }
    },
    gameObjects: [],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v11Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.deepEqual(migrated.scene.variableMeta, {
    accent_color: { type: "color", preset: "none" },
    route_data: { type: "json", preset: "none" },
    active_scene: { type: "string", preset: "scene-id" }
  });
});

test("migrateSceneData bloqueia cena de versao futura", () => {
  const result = migrateSceneData({ version: 999 }, SCENE_VERSION);
  assert.equal(result.ok, false);
  assert.match(result.message, /nao suportada/i);
});

test("migrateSceneData migra scene version 12 para 13 adicionando interacao e campos de cutscene", () => {
  const v12Scene = {
    version: 12,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    variables: {},
    variableMeta: {},
    gameObjects: [
      {
        id: "go_1",
        type: "trigger",
        x: 96,
        y: 96,
        z: 0,
        w: 64,
        h: 64,
        actions: [
          { type: "start-dialogue", speaker: "Guia", lines: ["Ola"] },
          { type: "move-player", x: 320, y: 160, duration: 1.4 }
        ]
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v12Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.gameObjects[0].interactionOnly, false);
  assert.deepEqual(migrated.scene.gameObjects[0].actions[0], {
    type: "start-dialogue",
    value: "",
    sceneId: "",
    spawnTag: "",
    targetTag: "",
    speaker: "Guia",
    lines: ["Ola", "", ""]
  });
  assert.deepEqual(migrated.scene.gameObjects[0].actions[1], {
    type: "move-player",
    value: "",
    sceneId: "",
    spawnTag: "",
    targetTag: "",
    x: 320,
    y: 160,
    duration: 1.4
  });
});

test("migrateSceneData migra scene version 13 para 14 adicionando render 2d e sprite shape", () => {
  const v13Scene = {
    version: 13,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [{ id: "wall_1", x: 96, y: 64, z: 0, w: 64, h: 32 }],
    variables: {},
    variableMeta: {},
    gameObjects: [
      {
        id: "go_1",
        type: "portal",
        x: 96,
        y: 96,
        z: 0,
        w: 32,
        h: 64
      },
      {
        id: "go_2",
        type: "spriteShape",
        x: 160,
        y: 160,
        z: 0,
        w: 256,
        h: 96
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v13Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.player.sortingLayer, "default");
  assert.equal(migrated.scene.player.orderInLayer, 0);
  assert.equal(migrated.scene.player.spriteId, "");
  assert.equal(migrated.scene.player.flipX, false);
  assert.equal(migrated.scene.player.flipY, false);
  assert.equal(migrated.scene.player.pivotX, 0);
  assert.equal(migrated.scene.player.pivotY, 0);
  assert.equal(migrated.scene.walls[0].sortingLayer, "default");
  assert.equal(migrated.scene.gameObjects[0].sortingLayer, "default");
  assert.equal(migrated.scene.gameObjects[1].shapeClosed, true);
  assert.equal(typeof migrated.scene.gameObjects[1].shapePoints, "string");
  assert.equal(migrated.scene.gameObjects[1].shapeFill, "#4cab6b");
  assert.equal(migrated.scene.gameObjects[1].shapeStroke, "#2f6f45");
  assert.equal(migrated.scene.gameObjects[1].shapeThickness, 3);
});

test("migrateSceneData migra scene version 14 para 15 adicionando physics 2d e hierarquia", () => {
  const v14Scene = {
    version: 14,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [{ id: "wall_1", x: 96, y: 64, z: 0, w: 64, h: 32 }],
    variables: {},
    variableMeta: {},
    gameObjects: [
      {
        id: "go_1",
        type: "portal",
        x: 96,
        y: 96,
        z: 0,
        w: 32,
        h: 64,
        parentRef: "entity:player"
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v14Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.deepEqual(migrated.scene.physics, {
    compositeCollider: true,
    pixelPerfect: false,
    pixelScale: 1,
    surfaceFriction: {
      default: 0.22,
      grass: 0.28,
      stone: 0.16,
      sand: 0.56,
      water: 0.86,
      lava: 0.94
    }
  });
  assert.equal(migrated.scene.player.parentRef, "");
  assert.equal(migrated.scene.player.bones2D, "");
  assert.equal(migrated.scene.player.bonesAnimate, false);
  assert.equal(migrated.scene.gameObjects[0].parentRef, "entity:player");
  assert.equal(migrated.scene.gameObjects[0].parentOffsetX, 0);
  assert.equal(migrated.scene.gameObjects[0].parentOffsetY, 0);
  assert.equal(migrated.scene.gameObjects[0].parentOffsetZ, 0);
  assert.equal(migrated.scene.gameObjects[0].bones2D, "");
  assert.equal(migrated.scene.gameObjects[0].bonesAnimate, false);
});

test("migrateSceneData migra scene version 16 para 17 adicionando shake e materiais de superficie", () => {
  const v16Scene = {
    version: 16,
    world: { width: 640, height: 480, depth: 2000, tileSize: 32 },
    space: { mode: "2d", upAxis: "y", forwardAxis: "z" },
    physics: { compositeCollider: true, pixelPerfect: false, pixelScale: 1 },
    camera2D: { mode: "follow", zoom: 1 },
    player: { x: 40, y: 40, z: 0, w: 30, h: 30, speed: 150 },
    enemy: { x: 220, y: 120, z: 0, w: 30, h: 30, speed: 120, patrol: [{ x: 220, y: 120, z: 0 }] },
    walls: [],
    variables: {},
    variableMeta: {},
    gameObjects: [
      {
        id: "go_1",
        type: "cameraZone",
        x: 96,
        y: 96,
        z: 0,
        w: 192,
        h: 128
      }
    ],
    layers: {
      background: [],
      gameplay: [],
      collision: [],
      foreground: []
    }
  };

  const migrated = migrateSceneData(v16Scene, SCENE_VERSION);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.scene.version, SCENE_VERSION);
  assert.equal(migrated.scene.camera2D.shakeEnabled, true);
  assert.equal(migrated.scene.camera2D.shakeIntensity, 12);
  assert.equal(migrated.scene.camera2D.shakeFrequency, 32);
  assert.deepEqual(migrated.scene.physics.surfaceFriction, {
    default: 0.22,
    grass: 0.28,
    stone: 0.16,
    sand: 0.56,
    water: 0.86,
    lava: 0.94
  });
  assert.equal(migrated.scene.gameObjects[0].cameraZonePriority, 0);
  assert.equal(migrated.scene.gameObjects[0].colliderIsTrigger, true);
  assert.deepEqual(migrated.scene.ui2D, {
    showHud: true,
    showHints: true,
    showPauseOverlay: true
  });
  assert.deepEqual(migrated.scene.audio2D, {
    enabled: true,
    masterVolume: 0.85,
    sfxVolume: 0.9,
    musicVolume: 0
  });
});
