import test from "node:test";
import assert from "node:assert/strict";

import {
  collectMutableSceneRefs,
  createDefaultScene,
  createGameplayObject,
  createInitialState,
  deleteMutableSceneObjects,
  duplicateMutableSceneObjects,
  evaluateTriggerCondition,
  findCheckpointById,
  findSpawnPoint,
  getClosedDoors,
  getTriggerActions,
  getOverlappingGameplayObjects,
  placeBodyAtMarker,
  rebuildTileMap,
  syncGameplayCounter,
  syncWallCounter
} from "../public/app/core-scene.mjs";

test("findSpawnPoint prefere spawnTag player_start e aceita tag especifica", () => {
  const scene = createDefaultScene();
  const spawnA = createGameplayObject(scene, 1, "spawn", { x: 64, y: 64 });
  spawnA.spawnTag = "entrada_secundaria";
  const spawnB = createGameplayObject(scene, 2, "spawn", { x: 160, y: 96 });
  spawnB.spawnTag = "player_start";
  scene.gameObjects.push(spawnA, spawnB);

  assert.equal(findSpawnPoint(scene).id, spawnB.id);
  assert.equal(findSpawnPoint(scene, "entrada_secundaria").id, spawnA.id);
});

test("findSpawnPoint usa equipe e prioridade quando portal pedir fallback por prioridade", () => {
  const scene = createDefaultScene();
  const spawnA = createGameplayObject(scene, 1, "spawn", { x: 64, y: 64 });
  spawnA.teamId = "blue";
  spawnA.priority = 1;
  const spawnB = createGameplayObject(scene, 2, "spawn", { x: 160, y: 96 });
  spawnB.teamId = "blue";
  spawnB.priority = 8;
  spawnB.spawnTag = "arena";
  const spawnC = createGameplayObject(scene, 3, "spawn", { x: 256, y: 128 });
  spawnC.teamId = "red";
  spawnC.priority = 20;
  scene.gameObjects.push(spawnA, spawnB, spawnC);

  assert.equal(findSpawnPoint(scene, "missing_tag", { teamId: "blue", fallbackMode: "priority" }).id, spawnB.id);
});

test("createGameplayObject cria portal com targetSceneId e targetSpawnTag padrao", () => {
  const scene = createDefaultScene({ id: "scene_test", name: "Scene Test" });
  const portal = createGameplayObject(scene, 2, "portal", { x: 64, y: 96 });

  assert.equal(portal.id, "go_2");
  assert.equal(portal.type, "portal");
  assert.equal(portal.targetSceneId, "scene_test");
  assert.equal(portal.targetSpawnTag, "player_start");
  assert.equal(portal.targetTeamId, "");
  assert.equal(portal.fallbackMode, "priority");
});

test("createGameplayObject cria door com tag e estado fechado por padrao", () => {
  const scene = createDefaultScene();
  const door = createGameplayObject(scene, 7, "door", { x: 64, y: 96 });

  assert.equal(door.type, "door");
  assert.equal(door.doorTag, "door_7");
  assert.equal(door.startsOpen, false);
  assert.equal(door.isOpen, false);
});

test("createGameplayObject cria trigger com actionType e flags padrao", () => {
  const scene = createDefaultScene();
  const trigger = createGameplayObject(scene, 4, "trigger", { x: 96, y: 96 });

  assert.equal(trigger.actionType, "message");
  assert.equal(trigger.conditionType, "always");
  assert.equal(trigger.interactionOnly, false);
  assert.equal(trigger.enabled, true);
  assert.equal(trigger.once, false);
  assert.equal(Array.isArray(trigger.actions), true);
  assert.equal(trigger.actions[0].type, "message");
  assert.equal(trigger.colliderEnabled, true);
  assert.equal(trigger.colliderIsTrigger, true);
  assert.equal(trigger.rigidbodyType, "static");
});

test("createGameplayObject cria camera zone com shake e trigger padrao", () => {
  const scene = createDefaultScene();
  const zone = createGameplayObject(scene, 9, "cameraZone", { x: 160, y: 96 });

  assert.equal(zone.type, "cameraZone");
  assert.equal(zone.colliderEnabled, true);
  assert.equal(zone.colliderIsTrigger, true);
  assert.equal(zone.cameraZonePriority, 0);
  assert.equal(zone.cameraZoneZoom, 0);
  assert.equal(zone.shakeOnEnter, false);
  assert.equal(zone.shakeDuration > 0, true);
});

test("findCheckpointById encontra checkpoint por id interno ou checkpointId", () => {
  const scene = createDefaultScene();
  const checkpoint = createGameplayObject(scene, 3, "checkpoint", { x: 320, y: 320 });
  checkpoint.checkpointId = "cp_central";
  scene.gameObjects.push(checkpoint);

  assert.equal(findCheckpointById(scene, checkpoint.id)?.id, checkpoint.id);
  assert.equal(findCheckpointById(scene, "cp_central")?.id, checkpoint.id);
});

test("getOverlappingGameplayObjects filtra contatos por tipo", () => {
  const scene = createDefaultScene();
  const trigger = createGameplayObject(scene, 1, "trigger", { x: 128, y: 128 });
  const portal = createGameplayObject(scene, 2, "portal", { x: 128, y: 128 });
  scene.gameObjects.push(trigger, portal);

  const contacts = getOverlappingGameplayObjects(scene, { x: 140, y: 140, w: 16, h: 16 }, "trigger");

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].id, trigger.id);
});

test("placeBodyAtMarker centraliza corpo dentro do marcador", () => {
  const body = { x: 0, y: 0, w: 20, h: 20 };
  const marker = { x: 100, y: 140, w: 40, h: 60 };
  const moved = placeBodyAtMarker(body, marker, { width: 400, height: 400 });

  assert.equal(moved, true);
  assert.deepEqual(body, { x: 110, y: 160, w: 20, h: 20 });
});

test("getTriggerActions usa array explicito e fallback legado", () => {
  const explicit = getTriggerActions({
    actions: [
      { type: "set-team", value: "blue", targetTag: "" },
      { type: "switch-scene", sceneId: "scene_2", spawnTag: "boss", targetTag: "" }
    ]
  });
  const legacy = getTriggerActions({
    actionType: "teleport-spawn",
    actionSceneId: "scene_3",
    actionSpawnTag: "arena"
  });

  assert.deepEqual(explicit, [
    { type: "set-team", value: "blue", sceneId: "", spawnTag: "", targetTag: "" },
    { type: "switch-scene", value: "", sceneId: "scene_2", spawnTag: "boss", targetTag: "" }
  ]);
  assert.deepEqual(legacy, [{ type: "teleport-spawn", value: "", sceneId: "scene_3", spawnTag: "arena", targetTag: "" }]);
});

test("getTriggerActions preserva campos extras de dialogo e movimento", () => {
  const actions = getTriggerActions({
    actions: [
      { type: "start-dialogue", speaker: "Guia", lines: ["Ola", "Siga em frente"] },
      { type: "move-player", x: 320, y: 192, duration: 1.2 }
    ]
  });

  assert.deepEqual(actions, [
    { type: "start-dialogue", value: "", sceneId: "", spawnTag: "", targetTag: "", speaker: "Guia", lines: ["Ola", "Siga em frente", ""] },
    { type: "move-player", value: "", sceneId: "", spawnTag: "", targetTag: "", x: 320, y: 192, duration: 1.2 }
  ]);
});

test("evaluateTriggerCondition valida team-is e team-not", () => {
  assert.equal(evaluateTriggerCondition({ conditionType: "always" }, { playerTeamId: "" }), true);
  assert.equal(evaluateTriggerCondition({ conditionType: "team-is", conditionValue: "blue" }, { playerTeamId: "blue" }), true);
  assert.equal(evaluateTriggerCondition({ conditionType: "team-is", conditionValue: "blue" }, { playerTeamId: "red" }), false);
  assert.equal(evaluateTriggerCondition({ conditionType: "team-not", conditionValue: "blue" }, { playerTeamId: "red" }), true);
  assert.equal(evaluateTriggerCondition({ conditionType: "scene-is", conditionValue: "scene_2" }, { sceneId: "scene_2" }), true);
  assert.equal(evaluateTriggerCondition({ conditionType: "has-checkpoint" }, { hasCheckpoint: true }), true);
  assert.equal(
    evaluateTriggerCondition({ conditionType: "var-is", conditionTargetTag: "gate_open", conditionValue: "1" }, { variables: { gate_open: "1" } }),
    true
  );
  assert.equal(
    evaluateTriggerCondition({ conditionType: "var-not", conditionTargetTag: "gate_open", conditionValue: "1" }, { variables: { gate_open: "0" } }),
    true
  );
});

test("getClosedDoors retorna apenas doors fechadas", () => {
  const scene = createDefaultScene();
  const doorA = createGameplayObject(scene, 1, "door", { x: 64, y: 64 });
  const doorB = createGameplayObject(scene, 2, "door", { x: 128, y: 64 });
  doorB.isOpen = true;
  scene.gameObjects.push(doorA, doorB);

  assert.deepEqual(getClosedDoors(scene).map((door) => door.id), [doorA.id]);
});

test("collectMutableSceneRefs ignora entities e remove refs duplicadas", () => {
  const scene = createDefaultScene();
  const portal = createGameplayObject(scene, 1, "portal", { x: 64, y: 64 });
  scene.gameObjects.push(portal);

  const refs = collectMutableSceneRefs(scene, [
    { kind: "entity", id: "player" },
    { kind: "wall", id: "wall_1" },
    { kind: "wall", id: "wall_1" },
    { kind: "gameplayObject", id: portal.id }
  ]);

  assert.deepEqual(refs, [
    { kind: "wall", id: "wall_1" },
    { kind: "gameplayObject", id: portal.id }
  ]);
});

test("duplicateMutableSceneObjects cria copias com ids novos e offset em grid", () => {
  const scene = createDefaultScene();
  const state = createInitialState();
  const portal = createGameplayObject(scene, 1, "portal", { x: 64, y: 64 });
  scene.gameObjects.push(portal);
  rebuildTileMap(scene, state.tileMaps);

  const result = duplicateMutableSceneObjects(
    scene,
    [
      { kind: "wall", id: "wall_1" },
      { kind: "gameplayObject", id: portal.id }
    ],
    state.tileMaps,
    {
      wallCounter: syncWallCounter(scene),
      gameplayCounter: syncGameplayCounter(scene)
    }
  );

  assert.equal(result.createdCount, 2);
  assert.deepEqual(result.createdRefs, [
    { kind: "wall", id: "wall_4" },
    { kind: "gameplayObject", id: "go_2" }
  ]);
  assert.equal(result.wallCounter, 5);
  assert.equal(result.gameplayCounter, 3);
  assert.equal(scene.walls.some((wall) => wall.id === "wall_4"), true);
  assert.equal(scene.gameObjects.some((item) => item.id === "go_2"), true);
  const duplicatedPortal = scene.gameObjects.find((item) => item.id === "go_2");
  assert.equal(duplicatedPortal.name, `${portal.name} Copia`);
  assert.equal((duplicatedPortal.x - portal.x) % scene.world.tileSize, 0);
  assert.equal((duplicatedPortal.y - portal.y) % scene.world.tileSize, 0);
  assert.equal(duplicatedPortal.x > portal.x, true);
  assert.equal(duplicatedPortal.y > portal.y, true);
});

test("deleteMutableSceneObjects remove apenas objetos editaveis selecionados", () => {
  const scene = createDefaultScene();
  const portal = createGameplayObject(scene, 1, "portal", { x: 64, y: 64 });
  scene.gameObjects.push(portal);

  const result = deleteMutableSceneObjects(scene, [
    { kind: "entity", id: "player" },
    { kind: "wall", id: "wall_1" },
    { kind: "gameplayObject", id: portal.id }
  ]);

  assert.equal(result.removedCount, 2);
  assert.deepEqual(result.removedRefs, [
    { kind: "wall", id: "wall_1" },
    { kind: "gameplayObject", id: portal.id }
  ]);
  assert.equal(scene.walls.some((wall) => wall.id === "wall_1"), false);
  assert.equal(scene.gameObjects.some((item) => item.id === portal.id), false);
  assert.equal(scene.player.id, "player");
});
