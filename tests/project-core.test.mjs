import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultScene } from "../public/app/core-scene.mjs";
import {
  createDefaultProject,
  createSceneFromProject,
  createSceneFromTemplate,
  duplicateSceneForProject,
  sanitizeAudioClips,
  sanitizePrefabs,
  sanitizeSpriteAnimations,
  sanitizeSpriteAtlases,
  validateProject
} from "../public/app/project-core.mjs";

test("validateProject migra JSON legado de uma unica cena para projeto", () => {
  const result = validateProject({
    world: { width: 800, height: 600, tileSize: 32 },
    player: { x: 64, y: 64, w: 30, h: 30, speed: 180 },
    enemy: { x: 200, y: 200, w: 30, h: 30, speed: 120, patrol: [{ x: 200, y: 200 }] },
    walls: [],
    tiles: []
  });

  assert.equal(result.ok, true);
  assert.equal(result.project.scenes.length, 1);
  assert.equal(result.project.activeSceneId, result.project.scenes[0].id);
});

test("validateProject preserva multiplas cenas e activeSceneId", () => {
  const sceneA = createDefaultScene({ id: "scene_a", name: "Mapa A" });
  const sceneB = createDefaultScene({ id: "scene_b", name: "Mapa B" });
  sceneB.variables = { spawn_open: "1" };
  sceneB.variableMeta = { spawn_open: { type: "boolean" } };

  const result = validateProject({
    name: "Projeto Teste",
    audioClips: [{ id: "UI Click", src: "assets/ui-click.ogg", kind: "ui" }],
    variables: { global_gate: 1, active_scene: "scene_b" },
    variableMeta: {
      global_gate: { type: "number" },
      active_scene: { type: "string", preset: "scene-id" }
    },
    activeSceneId: "scene_b",
    scenes: [sceneA, sceneB]
  });

  assert.equal(result.ok, true);
  assert.equal(result.project.projectVersion >= 4, true);
  assert.equal(result.project.scenes.length, 2);
  assert.equal(result.project.activeSceneId, "scene_b");
  assert.deepEqual(result.project.variables, { global_gate: "1", active_scene: "scene_b" });
  assert.equal(result.project.audioClips[0].id, "ui_click");
  assert.equal(result.project.audioRouting.ui, "ui_click");
  assert.deepEqual(result.project.variableMeta, {
    global_gate: { type: "number", preset: "none" },
    active_scene: { type: "string", preset: "scene-id" }
  });
  assert.deepEqual(result.project.scenes[1].variables, { spawn_open: "1" });
  assert.deepEqual(result.project.scenes[1].variableMeta, { spawn_open: { type: "boolean", preset: "none" } });
});

test("createSceneFromProject e duplicateSceneForProject geram ids unicos", () => {
  const project = createDefaultProject();
  const created = createSceneFromProject(project);
  project.scenes.push(created);

  const duplicated = duplicateSceneForProject(project, project.scenes[0]);

  assert.notEqual(created.id, project.scenes[0].id);
  assert.notEqual(duplicated.id, project.scenes[0].id);
  assert.notEqual(duplicated.id, created.id);
});

test("createDefaultProject inicia com cena demo jogavel", () => {
  const project = createDefaultProject();
  const scene = project.scenes[0];

  assert.equal(scene.gameObjects.some((item) => item.type === "trigger" && item.triggerTag === "gatilho_demo"), true);
  assert.equal(scene.gameObjects.some((item) => item.type === "door" && item.doorTag === "porta_demo"), true);
  assert.equal(scene.gameObjects.some((item) => item.type === "spawn" && item.spawnTag === "entrada_demo"), true);
  assert.equal(project.templateId, "top-down");
  assert.equal(project.activeBuildProfile, "dev");
  assert.equal(project.buildConfig.mode, "dev");
  assert.equal(project.buildConfig.startScene, scene.id);
  assert.equal(project.buildProfiles.release.compressAssets, true);
  assert.equal(Array.isArray(project.spriteAtlases), true);
  assert.equal(project.spriteAtlases.length > 0, true);
  assert.equal(project.spriteAtlases[0].id, "demo");
  assert.equal(project.spriteAtlases[0].sprites.length > 0, true);
  assert.equal(Array.isArray(project.spriteAnimations), true);
  assert.equal(Array.isArray(project.audioClips), true);
  assert.equal(project.audioClips.length > 0, true);
  assert.equal(typeof project.audioRouting, "object");
  assert.equal(String(project.audioRouting.music || "").length > 0, true);
  assert.equal(Array.isArray(project.prefabs), true);
});

test("createSceneFromTemplate cria cena nova sem colidir id", () => {
  const project = createDefaultProject();
  const templateScene = createSceneFromTemplate(project, "puzzle");
  project.scenes.push(templateScene);

  assert.equal(templateScene.id, "scene_2");
  assert.equal(templateScene.name.startsWith("Puzzle"), true);
  assert.equal(templateScene.gameObjects.some((item) => item.type === "door"), true);
});

test("validateProject normaliza build config e template em projeto legado", () => {
  const scene = createDefaultScene({ id: "scene_custom", name: "Mapa Base" });
  const result = validateProject({
    name: "Projeto Build",
    templateId: "nao-existe",
    activeBuildProfile: "invalid",
    buildConfig: {
      buildName: "",
      mode: "release",
      startScene: "missing_scene",
      includeEditorUI: false,
      includeDebugPanel: false,
      compressAssets: true
    },
    scenes: [scene]
  });

  assert.equal(result.ok, true);
  assert.equal(result.project.templateId, "top-down");
  assert.equal(result.project.activeBuildProfile, "dev");
  assert.equal(result.project.buildConfig.mode, "release");
  assert.equal(result.project.buildConfig.startScene, "scene_custom");
  assert.equal(result.project.buildProfiles.test.mode, "test");
});

test("sanitizeSpriteAtlases normaliza ids e garante fallback demo", () => {
  const normalized = sanitizeSpriteAtlases([
    {
      id: "UI",
      name: "UI",
      imageSrc: "assets/ui.png",
      sprites: [
        { id: "Button", x: 0, y: 0, w: 48, h: 16, pivotX: 1.5, pivotY: -2 },
        { id: "Button", x: 48, y: 0, w: 48, h: 16 }
      ]
    },
    {
      id: "UI",
      name: "UI copia",
      imageSrc: "assets/ui-copy.png",
      sprites: []
    }
  ]);

  assert.equal(normalized[0].id, "ui");
  assert.equal(normalized[1].id.startsWith("ui"), true);
  assert.equal(normalized[0].sprites[0].id, "button");
  assert.equal(normalized[0].sprites[1].id.startsWith("button"), true);
  assert.equal(normalized[0].sprites[0].pivotX, 1);
  assert.equal(normalized[0].sprites[0].pivotY, 0);

  const fallback = sanitizeSpriteAtlases(null);
  assert.equal(fallback[0].id, "demo");
});

test("sanitizeSpriteAnimations normaliza fps loop e frames", () => {
  const normalized = sanitizeSpriteAnimations([
    { id: "Run", fps: 0, loop: false, frames: ["demo:player", "", "demo:enemy"] },
    { id: "Run", fps: 12, frames: ["demo:spawn"] }
  ]);

  assert.equal(normalized[0].id, "run");
  assert.equal(normalized[0].fps, 1);
  assert.equal(normalized[0].loop, false);
  assert.deepEqual(normalized[0].frames, ["demo:player", "demo:enemy"]);
  assert.equal(normalized[1].id.startsWith("run"), true);
});

test("sanitizeAudioClips normaliza id kind volume e descarta entradas sem src", () => {
  const clips = sanitizeAudioClips([
    { id: "Portal In", src: "assets/audio/portal-in.ogg", kind: "PORTAL", volume: 1.4 },
    { id: "Portal In", src: "assets/audio/portal-out.ogg", kind: "trigger", volume: -1, loop: true },
    { id: "SemSrc", kind: "ui" }
  ]);

  assert.equal(clips.length, 2);
  assert.equal(clips[0].id, "portal_in");
  assert.equal(clips[0].kind, "portal");
  assert.equal(clips[0].volume, 1);
  assert.equal(clips[0].loop, false);
  assert.equal(clips[1].id.startsWith("portal_in"), true);
  assert.equal(clips[1].volume, 0);
  assert.equal(clips[1].loop, true);
});

test("sanitizePrefabs normaliza prefabs basicos", () => {
  const prefabs = sanitizePrefabs([
    {
      id: "WallA",
      name: "Parede A",
      sourceKind: "wall",
      data: { type: "wall", x: 12, y: 24, w: 2, h: 0 }
    },
    {
      id: "WallA",
      sourceKind: "gameplayObject",
      data: { type: "spawn", x: "a", y: 10, w: 32, h: 32 }
    }
  ]);

  assert.equal(prefabs[0].id, "walla");
  assert.equal(prefabs[0].data.w, 8);
  assert.equal(prefabs[0].data.h, 8);
  assert.equal(prefabs[1].id.startsWith("walla"), true);
  assert.equal(prefabs[1].sourceKind, "gameplayObject");
});
