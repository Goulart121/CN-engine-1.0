import {
  OBJECT_TYPE_LABELS,
  RIGIDBODY_TYPES,
  RIGIDBODY_TYPE_LABELS,
  SORTING_LAYERS,
  SORTING_LAYER_LABELS,
  TRIGGER_ACTION_LABELS,
  TRIGGER_ACTION_TYPES,
  TRIGGER_CONDITION_LABELS,
  TRIGGER_CONDITION_TYPES
} from "./constants.mjs";
import { getTriggerActions } from "./core-scene.mjs";
import { num, safe } from "./utils.mjs";

export function bindInspectorInputs(inspectorForm, fields, onCommit) {
  const handleEvent = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const isTransformField = [fields.x, fields.y, fields.z, fields.w, fields.h].includes(target);
    const isMetaField = target.classList.contains("inspector-meta-input");
    if (!isTransformField && !isMetaField) {
      return;
    }

    onCommit();
  };

  inspectorForm.addEventListener("change", handleEvent);
  inspectorForm.addEventListener("blur", handleEvent, true);
}

export function renderInspector({ inspectorEmpty, inspectorForm, fields, project, scene, selectedObject, selectedObjects, selectedRef, mode }) {
  const selection = Array.isArray(selectedObjects) ? selectedObjects : selectedObject ? [selectedObject] : [];
  if (selection.length === 0) {
    inspectorEmpty.classList.remove("hidden");
    inspectorForm.classList.add("hidden");
    return;
  }

  inspectorEmpty.classList.add("hidden");
  inspectorForm.classList.remove("hidden");

  if (selection.length > 1) {
    const summary = buildSelectionSummary(selection);
    renderMetaFields(fields.metaFields, [], {
      help: `${selection.length} objetos selecionados. X e Y movem o grupo; Largura e Altura mostram o limite do grupo.`
    });

    fields.name.value = `${selection.length} objetos`;
    fields.type.value = summary.typeLabel;
    fields.state.value = `${mode.toUpperCase()} / MULTI`;
    fields.x.value = summary.x;
    fields.y.value = summary.y;
    fields.z.value = summary.z;
    fields.w.value = summary.w;
    fields.h.value = summary.h;
    fields.x.readOnly = false;
    fields.y.readOnly = false;
    fields.z.readOnly = true;
    fields.w.readOnly = true;
    fields.h.readOnly = true;
    return;
  }

  const metaFields = resolveMetaFields(selectedObject, { project, scene });

  fields.name.value = selectedObject.name || selectedObject.id || "Sem nome";
  fields.type.value = getObjectTypeLabel(selectedObject.type || selectedRef?.kind || "object");
  fields.state.value = mode.toUpperCase();
  fields.x.value = Math.round(selectedObject.x);
  fields.y.value = Math.round(selectedObject.y);
  fields.z.value = Math.round(selectedObject.z || 0);
  fields.w.value = Math.round(selectedObject.w);
  fields.h.value = Math.round(selectedObject.h);
  fields.x.readOnly = false;
  fields.y.readOnly = false;
  fields.z.readOnly = false;
  fields.w.readOnly = false;
  fields.h.readOnly = false;

  renderMetaFields(fields.metaFields, metaFields);
}

export function readInspectorValues(fields, selectedObjects) {
  const selection = Array.isArray(selectedObjects) ? selectedObjects : selectedObjects ? [selectedObjects] : [];
  const primary = selection[0] || null;
  const multi = selection.length > 1;
  const summary = multi ? buildSelectionSummary(selection) : null;

  return {
    x: multi ? num(fields.x.value, summary.x) : primary ? num(fields.x.value, primary.x) : 0,
    y: multi ? num(fields.y.value, summary.y) : primary ? num(fields.y.value, primary.y) : 0,
    z: multi ? num(fields.z.value, summary.z) : primary ? num(fields.z.value, primary.z) : 0,
    w: multi ? Math.max(8, num(fields.w.value, summary.w)) : primary ? Math.max(8, num(fields.w.value, primary.w)) : 0,
    h: multi ? Math.max(8, num(fields.h.value, summary.h)) : primary ? Math.max(8, num(fields.h.value, primary.h)) : 0,
    isMulti: multi,
    metaEntries: readMetaEntries(fields.metaFields)
  };
}

function renderMetaFields(container, metaFields, options = {}) {
  if (!container) {
    return;
  }

  if (!Array.isArray(metaFields) || metaFields.length === 0) {
    container.innerHTML = options.help ? `<div class="inspector-meta-help">${safe(options.help)}</div>` : "";
    return;
  }

  container.innerHTML = metaFields
    .map((meta) => {
      const key = safe(meta.key);
      const label = safe(meta.label);
      const control = meta.control || "text";

      if (control === "checkbox") {
        return `
          <label>
            <span>${label}</span>
            <input
              class="inspector-meta-input"
              data-meta-key="${key}"
              data-control="checkbox"
              type="checkbox"
              ${meta.value ? "checked" : ""}
            />
            ${meta.help ? `<div class="inspector-meta-help">${safe(meta.help)}</div>` : ""}
          </label>
        `;
      }

      if (control === "select") {
        const optionsHtml = (meta.options || [])
          .map((option) => {
            const value = safe(option.value);
            const optionLabel = safe(option.label);
            const selected = String(option.value) === String(meta.value) ? "selected" : "";
            return `<option value="${value}" ${selected}>${optionLabel}</option>`;
          })
          .join("");

        return `
          <label>
            <span>${label}</span>
            <select class="inspector-meta-input" data-meta-key="${key}" data-control="select">
              ${optionsHtml}
            </select>
            ${meta.help ? `<div class="inspector-meta-help">${safe(meta.help)}</div>` : ""}
          </label>
        `;
      }

      const inputType = control === "number" ? "number" : "text";
      const value = control === "number" ? Number(meta.value || 0) : safe(String(meta.value ?? ""));
      const placeholder = meta.placeholder ? `placeholder="${safe(meta.placeholder)}"` : "";
      const step = control === "number" ? `step="${safe(String(meta.step ?? 1))}"` : "";
      const min = control === "number" && Number.isFinite(Number(meta.min)) ? `min="${safe(String(meta.min))}"` : "";
      const max = control === "number" && Number.isFinite(Number(meta.max)) ? `max="${safe(String(meta.max))}"` : "";

      return `
        <label>
          <span>${label}</span>
          <input
            class="inspector-meta-input"
            data-meta-key="${key}"
            data-control="${safe(control)}"
            type="${inputType}"
            value="${value}"
            ${step}
            ${min}
            ${max}
            ${placeholder}
          />
          ${meta.help ? `<div class="inspector-meta-help">${safe(meta.help)}</div>` : ""}
        </label>
      `;
    })
    .join("");
}

function readMetaEntries(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(".inspector-meta-input")).map((input) => {
    const key = String(input.dataset.metaKey || "");
    const control = String(input.dataset.control || "text");

    if (control === "checkbox") {
      return { key, value: input.checked };
    }

    if (control === "number") {
      return { key, value: num(input.value, 0) };
    }

    return { key, value: String(input.value || "").trim() };
  });
}

function buildSelectionSummary(selection) {
  const minX = Math.min(...selection.map((item) => item.x));
  const minY = Math.min(...selection.map((item) => item.y));
  const maxX = Math.max(...selection.map((item) => item.x + item.w));
  const maxY = Math.max(...selection.map((item) => item.y + item.h));
  const types = [...new Set(selection.map((item) => item.type || "object"))];

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    z: Math.round(selection.reduce((total, item) => total + num(item?.z, 0), 0) / Math.max(1, selection.length)),
    w: Math.round(maxX - minX),
    h: Math.round(maxY - minY),
    typeLabel: types.length === 1 ? `${getObjectTypeLabel(types[0])} x${selection.length}` : "Selecao Mista"
  };
}

export function resolveMetaFields(selectedObject, context = {}) {
  if (!selectedObject) {
    return [];
  }

  if (selectedObject.type === "spawn") {
    return [
      { key: "spawnTag", label: "Tag do Ponto Inicial", value: String(selectedObject.spawnTag || ""), help: "Tags iguais permitem escolher um ponto inicial especifico por portal ou gatilho." },
      { key: "teamId", label: "ID da Equipe", value: String(selectedObject.teamId || ""), placeholder: "equipe_azul" },
      { key: "priority", label: "Prioridade", value: Number(selectedObject.priority || 0), control: "number", help: "Maior prioridade vence quando o fallback estiver em modo de prioridade." },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  if (selectedObject.type === "trigger") {
    const conditionType = String(selectedObject.conditionType || "always");
    const actions = getTriggerActions(selectedObject, { maxActions: 3 });
    while (actions.length < 3) {
      actions.push({ type: "none", value: "", sceneId: "", spawnTag: "", targetTag: "" });
    }

    const actionFields = actions.flatMap((action, index) => buildTriggerActionFields(index + 1, action, context));

    return [
      { key: "triggerTag", label: "Tag do Gatilho", value: String(selectedObject.triggerTag || "") },
      {
        key: "conditionType",
        label: "Condicao",
        value: conditionType,
        control: "select",
        options: TRIGGER_CONDITION_TYPES.map((type) => ({ value: type, label: TRIGGER_CONDITION_LABELS[type] || type }))
      },
      ...(conditionType === "always"
        ? []
        : conditionType === "var-is" || conditionType === "var-not"
          ? [
              {
                key: "conditionTargetTag",
                label: "Chave da Variavel",
                value: String(selectedObject.conditionTargetTag || ""),
                control: "select",
                options: buildVariableKeyOptions(context.project, context.scene, selectedObject.conditionTargetTag),
                help: "Escolha a variavel observada pelo gatilho."
              },
              {
                key: "conditionValue",
                label: "Valor da Variavel",
                value: String(selectedObject.conditionValue || ""),
                placeholder: "1",
                help: "O gatilho compara o valor atual da variavel com este texto."
              }
            ]
          : [
            {
              key: "conditionValue",
              label: conditionType === "scene-is" ? "Cena da Condicao" : conditionType === "has-checkpoint" ? "Regra do Ponto de Controle" : "Equipe da Condicao",
              value: String(selectedObject.conditionValue || ""),
              control: conditionType === "scene-is" ? "select" : "text",
              options: conditionType === "scene-is" ? buildSceneOptions(context.project, context.scene, selectedObject.conditionValue, false) : undefined,
              placeholder: conditionType === "team-is" || conditionType === "team-not" ? "blue" : "",
              help:
                conditionType === "scene-is"
                  ? "O gatilho so dispara nesta cena."
                  : conditionType === "has-checkpoint"
                    ? "Opcional. Pode ficar vazio; o gatilho exige um ponto de controle salvo."
                    : "Equipe usada para liberar ou bloquear o gatilho."
            }
          ]),
      ...actionFields,
      { key: "interactionOnly", label: "Exigir Interacao", value: selectedObject.interactionOnly === true, control: "checkbox", help: "Quando ativo, o gatilho so dispara com a tecla E durante o modo JOGAR." },
      { key: "once", label: "Uma vez", value: selectedObject.once === true, control: "checkbox" },
      { key: "enabled", label: "Ativado", value: selectedObject.enabled !== false, control: "checkbox", help: "Desligue para manter o gatilho no mapa sem executar a acao." }
    ];
  }

  if (selectedObject.type === "portal") {
    return [
      {
        key: "targetSceneId",
        label: "Cena de Destino",
        value: String(selectedObject.targetSceneId || ""),
        control: "select",
        options: buildSceneOptions(context.project, context.scene, selectedObject.targetSceneId, false)
      },
      {
        key: "targetSpawnTag",
        label: "Ponto Inicial de Destino",
        value: String(selectedObject.targetSpawnTag || ""),
        control: "select",
        options: buildSpawnTagOptions(context.project, context.scene, selectedObject.targetSceneId, selectedObject.targetSpawnTag, false),
        help: "O portal tenta usar este ponto inicial antes da alternativa."
      },
      { key: "targetTeamId", label: "Equipe de Destino", value: String(selectedObject.targetTeamId || ""), help: "Se vazio, reutiliza a equipe atual do player." },
      {
        key: "fallbackMode",
        label: "Fallback",
        value: String(selectedObject.fallbackMode || "priority"),
        control: "select",
        options: [
          { value: "priority", label: "Prioridade" },
          { value: "default", label: "Padrao" },
          { value: "strict", label: "Estrito" }
        ],
        help: "Prioridade usa o ponto inicial com maior prioridade; estrito falha se a tag nao existir."
      },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  if (selectedObject.type === "checkpoint") {
    return [
      { key: "checkpointId", label: "ID do Ponto de Controle", value: String(selectedObject.checkpointId || "") },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  if (selectedObject.type === "door") {
    return [
      { key: "doorTag", label: "Tag da Porta", value: String(selectedObject.doorTag || ""), placeholder: "porta_principal" },
      { key: "startsOpen", label: "Comeca Aberta", value: selectedObject.startsOpen === true, control: "checkbox", help: "Define o estado inicial da porta ao entrar no modo JOGAR." },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  if (selectedObject.type === "spriteShape") {
    return [
      { key: "shapePoints", label: "Spline (x,y;...)", value: String(selectedObject.shapePoints || ""), placeholder: "0,64;64,24;128,52" },
      { key: "shapeClosed", label: "Fechar Shape", value: selectedObject.shapeClosed !== false, control: "checkbox" },
      { key: "shapeSmooth", label: "Suavizar Spline", value: selectedObject.shapeSmooth !== false, control: "checkbox" },
      { key: "shapeSegments", label: "Segmentos", value: Number.isFinite(Number(selectedObject.shapeSegments)) ? Number(selectedObject.shapeSegments) : 12, control: "number" },
      { key: "shapeFill", label: "Cor de Preenchimento", value: String(selectedObject.shapeFill || "#4cab6b") },
      { key: "shapeStroke", label: "Cor de Contorno", value: String(selectedObject.shapeStroke || "#2f6f45") },
      { key: "shapeThickness", label: "Espessura", value: Number(selectedObject.shapeThickness || 3), control: "number" },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  if (selectedObject.type === "cameraZone") {
    return [
      { key: "cameraZonePriority", label: "Prioridade da Zona", value: Number.isFinite(Number(selectedObject.cameraZonePriority)) ? Number(selectedObject.cameraZonePriority) : 0, control: "number", help: "Maior prioridade vence quando zonas se sobrepoem." },
      { key: "cameraZoneZoom", label: "Zoom da Zona (0 = usar cena)", value: Number.isFinite(Number(selectedObject.cameraZoneZoom)) ? Number(selectedObject.cameraZoneZoom) : 0, control: "number", step: 0.05, min: 0, max: 3 },
      { key: "cameraZoneOffsetX", label: "Offset X da Camera", value: Number.isFinite(Number(selectedObject.cameraZoneOffsetX)) ? Number(selectedObject.cameraZoneOffsetX) : 0, control: "number", step: 1 },
      { key: "cameraZoneOffsetY", label: "Offset Y da Camera", value: Number.isFinite(Number(selectedObject.cameraZoneOffsetY)) ? Number(selectedObject.cameraZoneOffsetY) : 0, control: "number", step: 1 },
      { key: "shakeOnEnter", label: "Shake ao Entrar", value: selectedObject.shakeOnEnter === true, control: "checkbox", help: "Ativa camera shake automaticamente quando o jogador entra na zona." },
      { key: "shakeIntensity", label: "Intensidade do Shake", value: Number.isFinite(Number(selectedObject.shakeIntensity)) ? Number(selectedObject.shakeIntensity) : 14, control: "number", step: 0.1, min: 0, max: 80 },
      { key: "shakeDuration", label: "Duracao do Shake", value: Number.isFinite(Number(selectedObject.shakeDuration)) ? Number(selectedObject.shakeDuration) : 0.28, control: "number", step: 0.01, min: 0.01, max: 5 },
      { key: "shakeFrequency", label: "Frequencia do Shake", value: Number.isFinite(Number(selectedObject.shakeFrequency)) ? Number(selectedObject.shakeFrequency) : 32, control: "number", step: 0.5, min: 1, max: 80 },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  if (selectedObject.type === "light2d") {
    return [
      { key: "lightRadius", label: "Raio da Luz", value: Number.isFinite(Number(selectedObject.lightRadius)) ? Number(selectedObject.lightRadius) : 180, control: "number" },
      { key: "lightIntensity", label: "Intensidade (0-1)", value: Number.isFinite(Number(selectedObject.lightIntensity)) ? Number(selectedObject.lightIntensity) : 0.92, control: "number", step: 0.01, min: 0, max: 1 },
      { key: "lightColor", label: "Cor da Luz", value: String(selectedObject.lightColor || "#ffe3a6") },
      { key: "lightFlicker", label: "Flicker (0-1)", value: Number.isFinite(Number(selectedObject.lightFlicker)) ? Number(selectedObject.lightFlicker) : 0, control: "number", step: 0.01, min: 0, max: 1 },
      { key: "castShadows", label: "Projetar Sombras", value: selectedObject.castShadows !== false, control: "checkbox" },
      ...buildRenderMetaFields(selectedObject, context)
    ];
  }

  return buildRenderMetaFields(selectedObject, context);
}

function buildSceneOptions(project, currentScene, selectedValue, allowCurrentBlank) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : currentScene ? [currentScene] : [];
  const options = [];

  if (allowCurrentBlank && currentScene) {
    options.push({ value: "", label: `Cena Atual (${currentScene.name})` });
  }

  scenes.forEach((scene) => {
    if (!scene?.id) {
      return;
    }

    appendUniqueOption(options, scene.id, scene.name || scene.id);
  });

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  return options;
}

function buildSpawnTagOptions(project, currentScene, targetSceneId, selectedValue, allowBlankDefault) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : currentScene ? [currentScene] : [];
  const cleanSceneId = String(targetSceneId || "").trim();
  const targetScene = scenes.find((scene) => scene?.id === cleanSceneId) || currentScene || scenes[0] || null;
  const options = [];

  if (allowBlankDefault) {
    options.push({ value: "", label: "Padrao da Cena" });
  }

  const spawnTags = Array.isArray(targetScene?.gameObjects)
    ? targetScene.gameObjects
        .filter((item) => item?.type === "spawn")
        .map((item) => String(item.spawnTag || "").trim())
        .filter(Boolean)
    : [];

  [...new Set(spawnTags)].forEach((spawnTag) => {
    appendUniqueOption(options, spawnTag, spawnTag);
  });

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  if (options.length === 0) {
    options.push({ value: "", label: "Sem Tags de Ponto Inicial" });
  }

  return options;
}

function buildDoorTagOptions(project, currentScene, targetSceneId, selectedValue, allowBlankDefault) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : currentScene ? [currentScene] : [];
  const cleanSceneId = String(targetSceneId || "").trim();
  const targetScene = scenes.find((scene) => scene?.id === cleanSceneId) || currentScene || scenes[0] || null;
  const options = [];

  if (allowBlankDefault) {
    options.push({ value: "", label: "Portas da Cena Atual" });
  }

  const doorTags = Array.isArray(targetScene?.gameObjects)
    ? targetScene.gameObjects
        .filter((item) => item?.type === "door")
        .flatMap((item) => [String(item.doorTag || "").trim(), String(item.id || "").trim()])
        .filter(Boolean)
    : [];

  [...new Set(doorTags)].forEach((doorTag) => appendUniqueOption(options, doorTag, doorTag));

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  if (options.length === 0) {
    options.push({ value: "", label: "Sem Portas" });
  }

  return options;
}

function buildVariableKeyOptions(project, currentScene, selectedValue) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : currentScene ? [currentScene] : [];
  const options = [];

  scenes.forEach((scene) => {
    (scene?.gameObjects || [])
      .filter((item) => item?.type === "trigger")
      .forEach((item) => {
        const actions = Array.isArray(item.actions) ? item.actions : [];
        actions
          .filter((action) => action?.type === "set-variable")
          .map((action) => String(action?.targetTag || "").trim())
          .filter(Boolean)
          .forEach((value) => appendUniqueOption(options, value, value));
      });
  });

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  if (options.length === 0) {
    options.push({ value: "", label: "Sem Variaveis" });
  }

  return options;
}

function buildAnimationTargetOptions(project, currentScene, targetSceneId, selectedValue) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : currentScene ? [currentScene] : [];
  const cleanSceneId = String(targetSceneId || "").trim();
  const targetScene = scenes.find((scene) => scene?.id === cleanSceneId) || currentScene || scenes[0] || null;
  const options = [
    { value: "player", label: "Jogador" },
    { value: "enemy", label: "Inimigo" }
  ];

  if (targetScene) {
    (targetScene.gameObjects || []).forEach((item) => {
      [item.id, item.name, item.doorTag, item.triggerTag, item.spawnTag, item.checkpointId]
        .filter(Boolean)
        .forEach((value) => appendUniqueOption(options, value, value));
    });
    (targetScene.walls || []).forEach((wall) => {
      [wall.id, wall.name].filter(Boolean).forEach((value) => appendUniqueOption(options, value, value));
    });
  }

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  return options;
}

function appendUniqueOption(options, value, label) {
  if (options.some((option) => String(option.value) === String(value))) {
    return;
  }

  options.push({
    value: String(value),
    label: String(label || value)
  });
}

function buildTriggerActionFields(slotIndex, action, context) {
  const slot = action && typeof action === "object" ? action : { type: "none", value: "", sceneId: "", spawnTag: "", targetTag: "" };
  const fields = [
    {
      key: `action${slotIndex}Type`,
      label: `Acao ${slotIndex}`,
      value: String(slot.type || "none"),
      control: "select",
      options: TRIGGER_ACTION_TYPES.map((type) => ({ value: type, label: TRIGGER_ACTION_LABELS[type] || type })),
      help: slotIndex === 1 ? "A primeira acao dispara ao entrar no gatilho." : "Use Nenhuma para encerrar a cadeia."
    }
  ];

  if (slot.type === "message") {
    fields.push({
      key: `action${slotIndex}Value`,
      label: `Mensagem ${slotIndex}`,
      value: String(slot.value || ""),
      placeholder: "Mensagem exibida no status"
    });
  }

  if (slot.type === "set-team") {
    fields.push({
      key: `action${slotIndex}Value`,
      label: `ID da Equipe ${slotIndex}`,
      value: String(slot.value || ""),
      placeholder: "blue",
      help: "Atualiza a equipe atual antes das proximas acoes."
    });
  }

  if (slot.type === "teleport-spawn" || slot.type === "switch-scene") {
    fields.push({
      key: `action${slotIndex}SceneId`,
      label: `Cena ${slotIndex}`,
      value: String(slot.sceneId || ""),
      control: "select",
      options: buildSceneOptions(context.project, context.scene, slot.sceneId, true)
    });
    fields.push({
      key: `action${slotIndex}SpawnTag`,
      label: `Ponto Inicial ${slotIndex}`,
      value: String(slot.spawnTag || ""),
      control: "select",
      options: buildSpawnTagOptions(context.project, context.scene, slot.sceneId, slot.spawnTag, true),
      help: "Se vazio, usa o ponto inicial padrao da cena."
    });
  }

  if (slot.type === "enable-trigger" || slot.type === "disable-trigger") {
    fields.push({
      key: `action${slotIndex}SceneId`,
      label: `Cena ${slotIndex}`,
      value: String(slot.sceneId || ""),
      control: "select",
      options: buildSceneOptions(context.project, context.scene, slot.sceneId, true)
    });
    fields.push({
      key: `action${slotIndex}Value`,
      label: `Tag do Gatilho ${slotIndex}`,
      value: String(slot.value || ""),
      placeholder: "gatilho_portao",
      help: "Aceita o ID interno ou a tag do gatilho."
    });
  }

  if (slot.type === "open-door" || slot.type === "close-door") {
    fields.push({
      key: `action${slotIndex}SceneId`,
      label: `Cena ${slotIndex}`,
      value: String(slot.sceneId || ""),
      control: "select",
      options: buildSceneOptions(context.project, context.scene, slot.sceneId, true)
    });
    fields.push({
      key: `action${slotIndex}TargetTag`,
      label: `Tag da Porta ${slotIndex}`,
      value: String(slot.targetTag || ""),
      control: "select",
      options: buildDoorTagOptions(context.project, context.scene, slot.sceneId, slot.targetTag, true)
    });
  }

  if (slot.type === "play-animation") {
    fields.push({
      key: `action${slotIndex}Value`,
      label: `Animacao ${slotIndex}`,
      value: String(slot.value || ""),
      placeholder: "pulse"
    });
    fields.push({
      key: `action${slotIndex}SceneId`,
      label: `Cena ${slotIndex}`,
      value: String(slot.sceneId || ""),
      control: "select",
      options: buildSceneOptions(context.project, context.scene, slot.sceneId, true)
    });
    fields.push({
      key: `action${slotIndex}TargetTag`,
      label: `Alvo ${slotIndex}`,
      value: String(slot.targetTag || ""),
      control: "select",
      options: buildAnimationTargetOptions(context.project, context.scene, slot.sceneId, slot.targetTag),
      help: "Aceita player, enemy, id, name ou tag do objeto."
    });
  }

  if (slot.type === "set-variable") {
    fields.push({
      key: `action${slotIndex}TargetTag`,
      label: `Chave da Variavel ${slotIndex}`,
      value: String(slot.targetTag || ""),
      placeholder: "porta_aberta",
      help: "Crie ou reutilize a chave observada por gatilhos var-is/var-not."
    });
    fields.push({
      key: `action${slotIndex}Value`,
      label: `Valor da Variavel ${slotIndex}`,
      value: String(slot.value || ""),
      placeholder: "1"
    });
  }

  if (slot.type === "start-dialogue") {
    fields.push({
      key: `action${slotIndex}Speaker`,
      label: `Personagem ${slotIndex}`,
      value: String(slot.speaker || ""),
      placeholder: "Guardiao"
    });
    [1, 2, 3].forEach((lineIndex) => {
      fields.push({
        key: `action${slotIndex}Line${lineIndex}`,
        label: `Fala ${slotIndex}.${lineIndex}`,
        value: String(Array.isArray(slot.lines) ? slot.lines[lineIndex - 1] || "" : ""),
        placeholder: lineIndex === 1 ? "Bem-vindo a CN Engine." : "Proxima fala"
      });
    });
  }

  if (slot.type === "play-timeline") {
    fields.push({
      key: `action${slotIndex}TimelineId`,
      label: `Timeline ${slotIndex}`,
      value: String(slot.timelineId || slot.value || ""),
      control: "select",
      options: buildTimelineOptions(context.project, slot.timelineId || slot.value),
      help: "Executa uma sequencia reutilizavel de cutscene."
    });
  }

  if (slot.type === "move-player" || slot.type === "move-camera") {
    fields.push({
      key: `action${slotIndex}X`,
      label: `X ${slotIndex}`,
      value: Number.isFinite(Number(slot.x)) ? Number(slot.x) : 0,
      control: "number",
      help: slot.type === "move-camera" ? "Destino horizontal da camera." : "Destino horizontal do jogador."
    });
    fields.push({
      key: `action${slotIndex}Y`,
      label: `Y ${slotIndex}`,
      value: Number.isFinite(Number(slot.y)) ? Number(slot.y) : 0,
      control: "number",
      help: slot.type === "move-camera" ? "Destino vertical da camera." : "Destino vertical do jogador."
    });
    fields.push({
      key: `action${slotIndex}Duration`,
      label: `Duracao ${slotIndex}`,
      value: Number.isFinite(Number(slot.duration)) ? Number(slot.duration) : 0.6,
      control: "number",
      help: "Tempo em segundos da etapa da cutscene."
    });
  }

  return fields;
}

function getObjectTypeLabel(type) {
  return OBJECT_TYPE_LABELS[type] || type || "Objeto";
}

function buildRenderMetaFields(selectedObject, context) {
  return [
    {
      key: "sortingLayer",
      label: "Camada de Ordenacao",
      value: String(selectedObject.sortingLayer || "default"),
      control: "select",
      options: SORTING_LAYERS.map((layer) => ({ value: layer, label: SORTING_LAYER_LABELS[layer] || layer }))
    },
    {
      key: "orderInLayer",
      label: "Ordem na Camada",
      value: Number.isFinite(Number(selectedObject.orderInLayer)) ? Number(selectedObject.orderInLayer) : 0,
      control: "number"
    },
    {
      key: "spriteId",
      label: "Sprite",
      value: String(selectedObject.spriteId || ""),
      control: "select",
      options: buildSpriteOptions(context.project, selectedObject.spriteId)
    },
    {
      key: "animationId",
      label: "Animacao (frames)",
      value: String(selectedObject.animationId || ""),
      control: "select",
      options: buildAnimationOptions(context.project, selectedObject.animationId)
    },
    {
      key: "parentRef",
      label: "Parent",
      value: String(selectedObject.parentRef || ""),
      control: "select",
      options: buildParentOptions(context.scene, selectedObject)
    },
    { key: "animationFps", label: "Animacao FPS", value: Number.isFinite(Number(selectedObject.animationFps)) ? Number(selectedObject.animationFps) : 8, control: "number", step: 0.1, min: 1 },
    { key: "animationLoop", label: "Animacao em Loop", value: selectedObject.animationLoop !== false, control: "checkbox" },
    {
      key: "animationMode",
      label: "Modo da Animacao",
      value: String(selectedObject.animationMode || "loop"),
      control: "select",
      options: [
        { value: "loop", label: "Loop" },
        { value: "once", label: "Uma vez" },
        { value: "pingpong", label: "PingPong" }
      ]
    },
    { key: "animationPlaying", label: "Animacao Ativa", value: selectedObject.animationPlaying !== false, control: "checkbox" },
    { key: "animationOffset", label: "Offset da Animacao", value: Number.isFinite(Number(selectedObject.animationOffset)) ? Number(selectedObject.animationOffset) : 0, control: "number", step: 0.1 },
    { key: "spriteOpacity", label: "Opacidade Sprite", value: Number.isFinite(Number(selectedObject.spriteOpacity)) ? Number(selectedObject.spriteOpacity) : 1, control: "number", step: 0.01, min: 0, max: 1 },
    { key: "flipX", label: "Espelhar X", value: selectedObject.flipX === true, control: "checkbox" },
    { key: "flipY", label: "Espelhar Y", value: selectedObject.flipY === true, control: "checkbox" },
    { key: "pivotX", label: "Pivot X (0-1)", value: Number.isFinite(Number(selectedObject.pivotX)) ? Number(selectedObject.pivotX) : 0, control: "number", step: 0.01, min: 0, max: 1 },
    { key: "pivotY", label: "Pivot Y (0-1)", value: Number.isFinite(Number(selectedObject.pivotY)) ? Number(selectedObject.pivotY) : 0, control: "number", step: 0.01, min: 0, max: 1 },
    {
      key: "rigidbodyType",
      label: "Rigidbody2D",
      value: String(selectedObject.rigidbodyType || "static"),
      control: "select",
      options: RIGIDBODY_TYPES.map((type) => ({ value: type, label: RIGIDBODY_TYPE_LABELS[type] || type }))
    },
    { key: "gravityScale", label: "Gravidade", value: Number.isFinite(Number(selectedObject.gravityScale)) ? Number(selectedObject.gravityScale) : 0, control: "number", step: 0.1 },
    { key: "linearDamping", label: "Damping Linear", value: Number.isFinite(Number(selectedObject.linearDamping)) ? Number(selectedObject.linearDamping) : 0, control: "number", step: 0.1, min: 0 },
    { key: "restitution", label: "Restituicao", value: Number.isFinite(Number(selectedObject.restitution)) ? Number(selectedObject.restitution) : 0, control: "number", step: 0.01, min: 0, max: 1 },
    { key: "colliderEnabled", label: "Collider2D Ativo", value: selectedObject.colliderEnabled !== false, control: "checkbox" },
    { key: "colliderIsTrigger", label: "Collider Is Trigger", value: selectedObject.colliderIsTrigger === true, control: "checkbox" },
    { key: "colliderOffsetX", label: "Collider Offset X", value: Number.isFinite(Number(selectedObject.colliderOffsetX)) ? Number(selectedObject.colliderOffsetX) : 0, control: "number", step: 1 },
    { key: "colliderOffsetY", label: "Collider Offset Y", value: Number.isFinite(Number(selectedObject.colliderOffsetY)) ? Number(selectedObject.colliderOffsetY) : 0, control: "number", step: 1 },
    { key: "colliderW", label: "Collider Largura", value: Number.isFinite(Number(selectedObject.colliderW)) ? Number(selectedObject.colliderW) : Number(selectedObject.w) || 32, control: "number", step: 1, min: 4 },
    { key: "colliderH", label: "Collider Altura", value: Number.isFinite(Number(selectedObject.colliderH)) ? Number(selectedObject.colliderH) : Number(selectedObject.h) || 32, control: "number", step: 1, min: 4 },
    { key: "prefabRef", label: "Prefab Ref", value: String(selectedObject.prefabRef || "") },
    { key: "bones2D", label: "Bones 2D", value: String(selectedObject.bones2D || ""), placeholder: "0,0>24,0;24,0>36,12" },
    { key: "bonesAnimate", label: "Animar Bones", value: selectedObject.bonesAnimate === true, control: "checkbox" }
  ];
}

function buildSpriteOptions(project, selectedValue) {
  const options = [{ value: "", label: "Sem Sprite" }];
  const atlases = Array.isArray(project?.spriteAtlases) ? project.spriteAtlases : [];

  atlases.forEach((atlas) => {
    const atlasId = String(atlas?.id || "").trim();
    if (!atlasId || !Array.isArray(atlas?.sprites)) {
      return;
    }

    atlas.sprites.forEach((sprite) => {
      const spriteId = String(sprite?.id || "").trim();
      if (!spriteId) {
        return;
      }

      const value = `${atlasId}:${spriteId}`;
      appendUniqueOption(options, value, `${atlas.name || atlasId} / ${sprite.name || spriteId}`);
    });
  });

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  return options;
}

function buildAnimationOptions(project, selectedValue) {
  const options = [{ value: "", label: "Sem Animacao" }];
  const animations = Array.isArray(project?.spriteAnimations) ? project.spriteAnimations : [];

  animations.forEach((animation) => {
    const animationId = String(animation?.id || "").trim();
    if (!animationId) {
      return;
    }

    appendUniqueOption(options, animationId, `${animation.name || animationId} (${Array.isArray(animation.frames) ? animation.frames.length : 0}f)`);
  });

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  return options;
}

function buildTimelineOptions(project, selectedValue) {
  const options = [{ value: "", label: "Sem Timeline" }];
  const timelines = Array.isArray(project?.timelines) ? project.timelines : [];

  timelines.forEach((timeline) => {
    const timelineId = String(timeline?.id || "").trim();
    if (!timelineId) {
      return;
    }

    appendUniqueOption(options, timelineId, `${timeline.name || timelineId} (${Array.isArray(timeline.actions) ? timeline.actions.length : 0} acoes)`);
  });

  if (selectedValue && !options.some((option) => String(option.value) === String(selectedValue))) {
    appendUniqueOption(options, selectedValue, selectedValue);
  }

  return options;
}

function buildParentOptions(scene, selectedObject) {
  const selectedKey = selectedObject?.id
    ? selectedObject.type === "player" || selectedObject.type === "enemy"
      ? `entity:${selectedObject.id}`
      : selectedObject.type === "wall"
        ? `wall:${selectedObject.id}`
        : `gameplayObject:${selectedObject.id}`
    : "";

  const options = [{ value: "", label: "Sem Parent" }];

  const appendCandidate = (value, label) => {
    if (!value || value === selectedKey) {
      return;
    }
    appendUniqueOption(options, value, label);
  };

  if (scene?.player?.id) {
    appendCandidate("entity:player", scene.player.name || "Jogador");
  }
  if (scene?.enemy?.id) {
    appendCandidate("entity:enemy", scene.enemy.name || "Inimigo");
  }

  (scene?.walls || []).forEach((wall) => {
    appendCandidate(`wall:${wall.id}`, wall.name || wall.id);
  });

  (scene?.gameObjects || []).forEach((item) => {
    appendCandidate(`gameplayObject:${item.id}`, item.name || item.id);
  });

  const selectedValueText = String(selectedObject?.parentRef || "").trim();
  if (selectedValueText && !options.some((option) => String(option.value) === selectedValueText)) {
    appendUniqueOption(options, selectedValueText, selectedValueText);
  }

  return options;
}
