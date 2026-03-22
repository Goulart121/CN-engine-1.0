import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultProject } from "../public/app/project-core.mjs";
import { createGameplayObject } from "../public/app/core-scene.mjs";
import { createVariableTemplate } from "../public/app/variable-templates.mjs";

test("createVariableTemplate usa preset de cena e gera chave unica", () => {
  const project = createDefaultProject();
  project.scenes.push({ ...project.scenes[0], id: "scene_2", name: "Scene 2" });

  const template = createVariableTemplate("scene-link", {
    project,
    existingVariables: {
      scene_ref: "scene_1"
    }
  });

  assert.equal(template.key, "scene_ref_2");
  assert.equal(template.value, "scene_1");
  assert.deepEqual(template.meta, {
    type: "string",
    preset: "scene-id"
  });
});

test("createVariableTemplate usa tags de gameplay quando o preset pede objetos", () => {
  const project = createDefaultProject();
  const scene = project.scenes[0];
  const spawn = createGameplayObject(scene, 1, "spawn", { x: 64, y: 64 });
  spawn.spawnTag = "boss_entry";
  scene.gameObjects = [spawn];

  const template = createVariableTemplate("spawn-link", {
    project,
    scene,
    existingVariables: {}
  });

  assert.equal(template.value, "boss_entry");
  assert.deepEqual(template.meta, {
    type: "string",
    preset: "spawn-tag"
  });
});

test("createVariableTemplate cria tipos livres para gameplay rapido", () => {
  const colorTemplate = createVariableTemplate("accent-color", {
    existingVariables: {}
  });
  const jsonTemplate = createVariableTemplate("runtime-payload", {
    existingVariables: {}
  });

  assert.equal(colorTemplate.value, "#8ad5ff");
  assert.deepEqual(colorTemplate.meta, {
    type: "color",
    preset: "none"
  });
  assert.equal(jsonTemplate.value, "{\"state\":\"idle\"}");
  assert.deepEqual(jsonTemplate.meta, {
    type: "json",
    preset: "none"
  });
});
