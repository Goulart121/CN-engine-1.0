import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultScene, createGameplayObject } from "../public/app/core-scene.mjs";
import { resolveMetaFields } from "../public/app/inspector.mjs";

test("resolveMetaFields mostra campos guiados para trigger set-team", () => {
  const scene = createDefaultScene();
  const trigger = createGameplayObject(scene, 1, "trigger", { x: 64, y: 64 });
  trigger.actions = [{ type: "set-team", value: "blue", sceneId: "", spawnTag: "" }];

  const fields = resolveMetaFields(trigger, { project: { scenes: [scene] }, scene });

  assert.deepEqual(
    fields.map((field) => field.key),
    ["triggerTag", "conditionType", "action1Type", "action1Value", "action2Type", "action3Type", "interactionOnly", "once", "enabled"]
  );
  assert.equal(fields.find((field) => field.key === "action1Value")?.label, "ID da Equipe 1");
});

test("resolveMetaFields mostra condition value quando trigger exige equipe", () => {
  const scene = createDefaultScene();
  const trigger = createGameplayObject(scene, 1, "trigger", { x: 64, y: 64 });
  trigger.conditionType = "team-is";

  const fields = resolveMetaFields(trigger, { project: { scenes: [scene] }, scene });

  assert.equal(fields.some((field) => field.key === "conditionValue"), true);
});

test("resolveMetaFields mostra var key e var value quando trigger usa variavel", () => {
  const scene = createDefaultScene();
  const trigger = createGameplayObject(scene, 1, "trigger", { x: 64, y: 64 });
  trigger.conditionType = "var-is";
  trigger.conditionTargetTag = "gate_open";
  trigger.conditionValue = "1";
  trigger.actions = [{ type: "set-variable", value: "1", sceneId: "", spawnTag: "", targetTag: "gate_open" }];

  const fields = resolveMetaFields(trigger, { project: { scenes: [scene] }, scene });

  assert.equal(fields.find((field) => field.key === "conditionTargetTag")?.control, "select");
  assert.equal(fields.find((field) => field.key === "conditionValue")?.label, "Valor da Variavel");
});

test("resolveMetaFields mostra campos de enable-trigger e scene-is", () => {
  const sceneA = createDefaultScene({ id: "scene_a", name: "Scene A" });
  const sceneB = createDefaultScene({ id: "scene_b", name: "Scene B" });
  const trigger = createGameplayObject(sceneA, 1, "trigger", { x: 64, y: 64 });
  trigger.conditionType = "scene-is";
  trigger.conditionValue = "scene_b";
  trigger.actions = [{ type: "enable-trigger", value: "gate_open", sceneId: "scene_b", spawnTag: "" }];

  const fields = resolveMetaFields(trigger, { project: { scenes: [sceneA, sceneB] }, scene: sceneA });

  assert.equal(fields.find((field) => field.key === "conditionValue")?.control, "select");
  assert.equal(fields.find((field) => field.key === "action1SceneId")?.control, "select");
  assert.equal(fields.find((field) => field.key === "action1Value")?.label, "Tag do Gatilho 1");
});

test("resolveMetaFields mostra campos de door e open-door", () => {
  const scene = createDefaultScene();
  const door = createGameplayObject(scene, 2, "door", { x: 96, y: 96 });
  const trigger = createGameplayObject(scene, 1, "trigger", { x: 64, y: 64 });
  scene.gameObjects.push(door);
  trigger.actions = [{ type: "open-door", value: "", sceneId: "", spawnTag: "", targetTag: door.doorTag }];

  const doorFields = resolveMetaFields(door, { project: { scenes: [scene] }, scene });
  const triggerFields = resolveMetaFields(trigger, { project: { scenes: [scene] }, scene });

  assert.equal(doorFields.some((field) => field.key === "doorTag"), true);
  assert.equal(triggerFields.find((field) => field.key === "action1TargetTag")?.control, "select");
});

test("resolveMetaFields do portal usa cenas e spawn tags do projeto", () => {
  const sceneA = createDefaultScene({ id: "scene_a", name: "Scene A" });
  const sceneB = createDefaultScene({ id: "scene_b", name: "Scene B" });
  const spawn = createGameplayObject(sceneB, 1, "spawn", { x: 128, y: 128 });
  spawn.spawnTag = "boss_entry";
  sceneB.gameObjects.push(spawn);

  const portal = createGameplayObject(sceneA, 2, "portal", { x: 64, y: 64 });
  portal.targetSceneId = "scene_b";
  portal.targetSpawnTag = "boss_entry";

  const fields = resolveMetaFields(portal, { project: { scenes: [sceneA, sceneB] }, scene: sceneA });
  const sceneField = fields.find((field) => field.key === "targetSceneId");
  const spawnField = fields.find((field) => field.key === "targetSpawnTag");

  assert.equal(sceneField?.control, "select");
  assert.equal(sceneField?.options.some((option) => option.value === "scene_b"), true);
  assert.equal(spawnField?.control, "select");
  assert.equal(spawnField?.options.some((option) => option.value === "boss_entry"), true);
});

test("resolveMetaFields mostra campos guiados para dialogo e movimento de cutscene", () => {
  const scene = createDefaultScene();
  const trigger = createGameplayObject(scene, 1, "trigger", { x: 64, y: 64 });
  trigger.actions = [
    { type: "start-dialogue", speaker: "Guia", lines: ["Linha 1", "Linha 2", ""] },
    { type: "move-camera", x: 320, y: 224, duration: 1.4 }
  ];

  const fields = resolveMetaFields(trigger, { project: { scenes: [scene] }, scene });

  assert.equal(fields.find((field) => field.key === "action1Speaker")?.label, "Personagem 1");
  assert.equal(fields.find((field) => field.key === "action1Line1")?.label, "Fala 1.1");
  assert.equal(fields.find((field) => field.key === "action2Duration")?.label, "Duracao 2");
});

test("resolveMetaFields mostra campos de camera zone para zoom e shake", () => {
  const scene = createDefaultScene();
  const zone = createGameplayObject(scene, 5, "cameraZone", { x: 96, y: 96 });

  const fields = resolveMetaFields(zone, { project: { scenes: [scene] }, scene });

  assert.equal(fields.some((field) => field.key === "cameraZonePriority"), true);
  assert.equal(fields.some((field) => field.key === "cameraZoneZoom"), true);
  assert.equal(fields.some((field) => field.key === "shakeOnEnter"), true);
  assert.equal(fields.some((field) => field.key === "shakeDuration"), true);
});
