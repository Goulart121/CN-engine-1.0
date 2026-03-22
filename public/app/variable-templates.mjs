import { normalizeVariablePreset, normalizeVariableType, normalizeVariableValueByType } from "./core-scene.mjs";

export const VARIABLE_TEMPLATE_DEFS = [
  { id: "scene-link", label: "Referencia de Cena", key: "scene_ref", type: "string", preset: "scene-id", description: "Referencia uma cena do projeto." },
  { id: "team-slot", label: "Referencia de Equipe", key: "team_ref", type: "string", preset: "team-id", description: "Guarda uma equipe disponivel para gatilho ou ponto inicial." },
  { id: "spawn-link", label: "Referencia de Ponto Inicial", key: "spawn_ref", type: "string", preset: "spawn-tag", description: "Aponta para uma tag de ponto inicial existente." },
  { id: "door-link", label: "Referencia de Porta", key: "door_ref", type: "string", preset: "door-tag", description: "Aponta para uma porta por tag." },
  { id: "trigger-link", label: "Referencia de Gatilho", key: "trigger_ref", type: "string", preset: "trigger-tag", description: "Aponta para um gatilho por tag." },
  { id: "checkpoint-link", label: "Referencia de Ponto de Controle", key: "checkpoint_ref", type: "string", preset: "checkpoint-id", description: "Aponta para um ponto de controle salvo." },
  { id: "gate-flag", label: "Sinalizador", key: "gate_open", type: "boolean", preset: "none", value: "false", description: "Booleano rapido para portas, eventos e travas." },
  { id: "accent-color", label: "Cor", key: "accent_color", type: "color", preset: "none", value: "#8ad5ff", description: "Cor configuravel para interface e jogabilidade." },
  { id: "runtime-payload", label: "JSON", key: "runtime_payload", type: "json", preset: "none", value: "{\"state\":\"idle\"}", description: "Bloco livre para runtime e depuracao." }
];

export function createVariableTemplate(templateId, context = {}) {
  const definition = VARIABLE_TEMPLATE_DEFS.find((entry) => entry.id === templateId) || VARIABLE_TEMPLATE_DEFS[0];
  const existingVariables = context?.existingVariables && typeof context.existingVariables === "object" ? context.existingVariables : {};
  const preset = normalizeVariablePreset(definition.preset);
  const type = normalizeVariableType(definition.type);
  const presetOptions = collectPresetOptions(preset, context);
  const value = normalizeVariableValueByType(type, preset !== "none" ? presetOptions[0]?.value || "" : definition.value || "");

  return {
    key: nextTemplateKey(definition.key, existingVariables),
    value,
    meta: {
      type,
      preset
    },
    description: definition.description,
    label: definition.label
  };
}

function collectPresetOptions(preset, context) {
  const normalizedPreset = normalizeVariablePreset(preset);
  const scenes = Array.isArray(context?.project?.scenes) ? context.project.scenes : [];
  const options = [];
  const seen = new Set();

  if (normalizedPreset === "none") {
    return options;
  }

  if (normalizedPreset === "scene-id") {
    scenes.forEach((scene) => {
      pushPresetOption(options, seen, scene?.id);
    });
    return options;
  }

  scenes.forEach((scene) => {
    const objects = Array.isArray(scene?.gameObjects) ? scene.gameObjects : [];
    if (normalizedPreset === "team-id") {
      objects.forEach((item) => {
        pushPresetOption(options, seen, item?.teamId);
        pushPresetOption(options, seen, item?.targetTeamId);
      });
      return;
    }

    objects.forEach((item) => {
      if (normalizedPreset === "spawn-tag" && item?.type === "spawn") {
        pushPresetOption(options, seen, item?.spawnTag);
      }
      if (normalizedPreset === "door-tag" && item?.type === "door") {
        pushPresetOption(options, seen, item?.doorTag);
      }
      if (normalizedPreset === "trigger-tag" && item?.type === "trigger") {
        pushPresetOption(options, seen, item?.triggerTag);
      }
      if (normalizedPreset === "checkpoint-id" && item?.type === "checkpoint") {
        pushPresetOption(options, seen, item?.checkpointId);
      }
    });
  });

  return options;
}

function pushPresetOption(options, seen, value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue || seen.has(cleanValue)) {
    return;
  }

  seen.add(cleanValue);
  options.push({ value: cleanValue });
}

function nextTemplateKey(baseKey, existingVariables) {
  const cleanBase = String(baseKey || "var_ref").trim() || "var_ref";
  let candidate = cleanBase;
  let index = 2;
  while (Object.prototype.hasOwnProperty.call(existingVariables, candidate)) {
    candidate = `${cleanBase}_${index}`;
    index += 1;
  }
  return candidate;
}
