import {
  createDefaultScene3D,
  createScene3DObject,
  getScene3DById,
  nextObject3DCounter,
  nextScene3DId,
  nextScene3DName,
  sanitizeScene3DObject,
  sanitizeScenes3D
} from "./scene3d-core.mjs";
import { clamp, clone, safe } from "./utils.mjs";

const BOX_FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7]
];

const BOX_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

const GIZMO_AXIS_DEFS = [
  { axis: "x", color: "#ff7d7d", vector: { x: 1, y: 0, z: 0 }, rotateKey: "rx", scaleKey: "sx", moveKey: "x" },
  { axis: "y", color: "#7ce89a", vector: { x: 0, y: 1, z: 0 }, rotateKey: "ry", scaleKey: "sy", moveKey: "y" },
  { axis: "z", color: "#7ebdff", vector: { x: 0, y: 0, z: 1 }, rotateKey: "rz", scaleKey: "sz", moveKey: "z" }
];

const GIZMO_ROTATE_RADII = {
  x: 44,
  y: 58,
  z: 72
};

const GIZMO_TRANSFORM_KEYS = ["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz", "w", "h", "d", "color", "name"];
const GIZMO_SNAP_STEPS = {
  move: 32,
  rotate: 15,
  scale: 0.1
};

const TERRAIN_BRUSH_PRESETS = [
  { id: "soft-circle", label: "Soft", shape: "circle", hardness: 0.22, spacing: 0.08, noiseScale: 0.24, erosionStrength: 1.1, swatch: "radial-gradient(circle,#eaf6ff 0%, #b9d4e8 36%, #4f6a7f 100%)" },
  { id: "hard-circle", label: "Hard", shape: "circle", hardness: 0.92, spacing: 0.06, noiseScale: 0.2, erosionStrength: 1, swatch: "radial-gradient(circle,#f6fbff 0%, #d6e8f5 56%, #3a5164 100%)" },
  { id: "soft-square", label: "Square", shape: "square", hardness: 0.58, spacing: 0.1, noiseScale: 0.24, erosionStrength: 1, swatch: "linear-gradient(135deg,#e6f2fb,#a9c8df 54%,#375063)" },
  { id: "diamond", label: "Diamond", shape: "diamond", hardness: 0.72, spacing: 0.08, noiseScale: 0.26, erosionStrength: 1, swatch: "linear-gradient(45deg,#4e677c 0%,#c5dff0 50%,#4e677c 100%)" },
  { id: "ridge", label: "Ridge", shape: "circle", hardness: 0.8, spacing: 0.05, noiseScale: 0.18, erosionStrength: 1.2, swatch: "radial-gradient(circle,#eaf6ff 0%, #95b4ca 34%, #304454 58%, #1f2e3a 100%)" },
  { id: "crater", label: "Crater", shape: "circle", hardness: 0.66, spacing: 0.05, noiseScale: 0.21, erosionStrength: 1.2, swatch: "radial-gradient(circle,#213140 0%, #95b0c2 38%, #1f303d 62%, #4f687a 100%)" },
  { id: "noise", label: "Noise", shape: "circle", hardness: 0.42, spacing: 0.12, noiseScale: 0.45, erosionStrength: 1.4, swatch: "radial-gradient(circle at 20% 20%,#d5e8f6 0%,#5d778a 44%,#283948 100%)" },
  { id: "erode", label: "Erode", shape: "circle", hardness: 0.34, spacing: 0.08, noiseScale: 0.2, erosionStrength: 2.1, swatch: "radial-gradient(circle at 70% 30%,#d9ecf9 0%,#6f889a 42%,#344958 100%)" }
];

const TERRAIN_BRUSH_PRESET_BY_ID = TERRAIN_BRUSH_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {});

export function createEditor3D({ ui, model, setStatus, runCommand, exportJson }) {
  const state = {
    active: false,
    started: false,
    renderCache: [],
    drag: null,
    selectedObjectId: "",
    gizmoMode: "move",
    gizmoSpace: "global",
    gizmoSnap: true,
    gizmoHandles: [],
    gizmoDrag: null,
    terrainBrushMode: "none",
    terrainBrushRadius: 3,
    terrainBrushStrength: 0.9,
    terrainBrushHardness: 0.3,
    terrainBrushSpacing: 0.08,
    terrainBrushShape: "circle",
    terrainBrushNoiseScale: 0.24,
    terrainBrushErosionStrength: 1,
    terrainBrushPresetId: "soft-circle",
    terrainBrushTarget: 0,
    terrainSettingsResolutionX: 33,
    terrainSettingsResolutionZ: 33,
    terrainSettingsCellSize: 120,
    terrainSettingsMaxHeight: 420,
    terrainImportFormat: "auto",
    terrainImportSourceWidth: 33,
    terrainImportSourceHeight: 33,
    terrainImportEndian: "little",
    terrainImportFlipX: false,
    terrainImportFlipZ: true,
    terrainImportNormalize: false,
    terrainImportCentered: false,
    terrainImportHeightScale: 1,
    terrainImportHeightOffset: 0,
    terrainStateSceneId: "",
    terrainStateSignature: "",
    terrainBrushPaint: null,
    playKeys: { forward: false, backward: false, left: false, right: false, sprint: false },
    playLookDrag: null,
    playRuntime: { yaw: 0, pitch: 0, bobTime: 0, lastTime: performance.now() }
  };

  function init() {
    ensureProject3DDefaults();
    bindEvents();
    refresh();
    startLoop();
  }

  function bindEvents() {
    ui.btnScene3DNew?.addEventListener("click", createScene3D);
    ui.btnScene3DDuplicate?.addEventListener("click", duplicateScene3D);
    ui.btnScene3DDelete?.addEventListener("click", deleteScene3D);
    ui.scene3DList?.addEventListener("click", handleScene3DListClick);

    ui.btnAddCube3D?.addEventListener("click", () => addObject3D("cube"));
    ui.btnAddPlane3D?.addEventListener("click", () => addObject3D("plane"));
    ui.btnDuplicateObject3D?.addEventListener("click", duplicateSelectedObject3D);
    ui.btnDeleteObject3D?.addEventListener("click", deleteSelectedObject3D);
    ui.object3DList?.addEventListener("click", handleObject3DListClick);
    ui.btnResetCamera3D?.addEventListener("click", resetCamera3D);
    ui.btnGizmoMove3D?.addEventListener("click", () => setGizmoMode("move", true));
    ui.btnGizmoRotate3D?.addEventListener("click", () => setGizmoMode("rotate", true));
    ui.btnGizmoScale3D?.addEventListener("click", () => setGizmoMode("scale", true));
    ui.btnGizmoSpace3D?.addEventListener("click", () => toggleGizmoSpace(true));
    ui.btnGizmoSnap3D?.addEventListener("click", () => toggleGizmoSnap(true));
    ui.scene3dCameraMode?.addEventListener("change", commitPlayCameraPanel);
    ui.scene3dPlayerObject?.addEventListener("change", commitPlayCameraPanel);
    ui.scene3dMoveSpeed?.addEventListener("change", commitPlayCameraPanel);
    ui.scene3dLookSensitivity?.addEventListener("change", commitPlayCameraPanel);
    ui.scene3dFirstBob?.addEventListener("change", commitPlayCameraPanel);
    ui.scene3dThirdDistance?.addEventListener("change", commitPlayCameraPanel);
    ui.scene3dTerrainEnabled?.addEventListener("change", commitTerrainPanel);
    ui.btnTerrainRaise3D?.addEventListener("click", () => setTerrainBrushMode("raise", true));
    ui.btnTerrainLower3D?.addEventListener("click", () => setTerrainBrushMode("lower", true));
    ui.btnTerrainSmooth3D?.addEventListener("click", () => setTerrainBrushMode("smooth", true));
    ui.btnTerrainFlatten3D?.addEventListener("click", () => setTerrainBrushMode("flatten", true));
    ui.btnTerrainNoise3D?.addEventListener("click", () => setTerrainBrushMode("noise", true));
    ui.btnTerrainErode3D?.addEventListener("click", () => setTerrainBrushMode("erode", true));
    ui.btnTerrainBrushOff3D?.addEventListener("click", () => setTerrainBrushMode("none", true));
    ui.btnTerrainReset3D?.addEventListener("click", resetTerrainHeights);
    ui.btnTerrainApplySettings3D?.addEventListener("click", applyTerrainSettings);
    ui.btnTerrainRandomize3D?.addEventListener("click", randomizeTerrainHeights);
    ui.btnTerrainImportUnity3D?.addEventListener("click", triggerTerrainImportPicker);
    ui.terrainUnityImportFile?.addEventListener("change", handleTerrainImportFileSelected);
    ui.terrainBrushPresetGrid3D?.addEventListener("click", handleTerrainPresetClick);
    ui.terrainBrushRadius3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushStrength3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushHardness3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushSpacing3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushShape3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushTarget3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushNoiseScale3D?.addEventListener("change", commitTerrainPanel);
    ui.terrainBrushErosion3D?.addEventListener("change", commitTerrainPanel);
    ui.scene3dTerrainResolutionX?.addEventListener("change", commitTerrainPanel);
    ui.scene3dTerrainResolutionZ?.addEventListener("change", commitTerrainPanel);
    ui.scene3dTerrainCellSize?.addEventListener("change", commitTerrainPanel);
    ui.scene3dTerrainMaxHeight?.addEventListener("change", commitTerrainPanel);
    ui.terrainImportFormat3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportSourceWidth3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportSourceHeight3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportEndian3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportFlipX3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportFlipZ3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportNormalize3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportCentered3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportHeightScale3D?.addEventListener("change", syncTerrainImportStateFromUi);
    ui.terrainImportHeightOffset3D?.addEventListener("change", syncTerrainImportStateFromUi);

    const inspectorFields = [
      ui.field3dName,
      ui.field3dX, ui.field3dY, ui.field3dZ,
      ui.field3dRX, ui.field3dRY, ui.field3dRZ,
      ui.field3dSX, ui.field3dSY, ui.field3dSZ,
      ui.field3dW, ui.field3dH, ui.field3dD,
      ui.field3dColor
    ].filter(Boolean);
    inspectorFields.forEach((field) => {
      field.addEventListener("change", commitInspector3D);
      field.addEventListener("blur", commitInspector3D);
    });

    ui.viewport3d?.addEventListener("contextmenu", (event) => event.preventDefault());
    ui.viewport3d?.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    ui.viewport3d?.addEventListener("wheel", handleWheelZoom, { passive: false });
    document.addEventListener("keydown", handleGizmoShortcut);
    document.addEventListener("keyup", handlePlayKeyUp);
  }

  function startLoop() {
    if (state.started) {
      return;
    }
    state.started = true;

    const tick = (time) => {
      const now = Number.isFinite(Number(time)) ? Number(time) : performance.now();
      const last = Number(state.playRuntime.lastTime || now);
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      state.playRuntime.lastTime = now;
      if (state.active) {
        updatePlayRuntime(dt);
        draw();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function setActive(value) {
    state.active = value === true;
    if (state.active) {
      resize();
      refresh();
      draw();
    } else {
      state.playLookDrag = null;
      state.terrainBrushPaint = null;
    }
  }

  function resize() {
    if (!ui.viewport3d) {
      return;
    }
    const bounds = ui.viewport3d.parentElement.getBoundingClientRect();
    ui.viewport3d.width = Math.max(1, Math.floor(bounds.width));
    ui.viewport3d.height = Math.max(1, Math.floor(bounds.height));
  }

  function refresh() {
    ensureProject3DDefaults();
    ensureSceneRuntimeDefaults();
    refreshScene3DList();
    refreshObject3DList();
    refreshInspector3D();
    updateButtonsState();
    refreshGizmoButtons();
    refreshTerrainBrushButtons();
    refreshPlayCameraPanel();
    refreshTerrainPanel();
    if (state.active) {
      draw();
    }
  }

  function setGizmoMode(mode, announce = false) {
    const nextMode = String(mode || "move").toLowerCase();
    if (!["move", "rotate", "scale"].includes(nextMode)) {
      return;
    }

    state.gizmoMode = nextMode;
    refreshGizmoButtons();
    draw();

    if (announce) {
      const label = nextMode === "move" ? "Mover" : nextMode === "rotate" ? "Rotacionar" : "Escalar";
      setStatus(`Gizmo 3D: ${label}.`, "ok");
    }
  }

  function toggleGizmoSpace(announce = false) {
    state.gizmoSpace = state.gizmoSpace === "local" ? "global" : "local";
    refreshGizmoButtons();
    draw();
    if (announce) {
      setStatus(`Espaco do gizmo: ${state.gizmoSpace === "local" ? "Local" : "Global"}.`, "ok");
    }
  }

  function toggleGizmoSnap(announce = false) {
    state.gizmoSnap = !state.gizmoSnap;
    refreshGizmoButtons();
    draw();
    if (announce) {
      setStatus(`Snap do gizmo ${state.gizmoSnap ? "ligado" : "desligado"}.`, "ok");
    }
  }

  function refreshGizmoButtons() {
    ui.btnGizmoMove3D?.classList.toggle("active", state.gizmoMode === "move");
    ui.btnGizmoRotate3D?.classList.toggle("active", state.gizmoMode === "rotate");
    ui.btnGizmoScale3D?.classList.toggle("active", state.gizmoMode === "scale");
    ui.btnGizmoSpace3D?.classList.toggle("active", state.gizmoSpace === "local");
    ui.btnGizmoSnap3D?.classList.toggle("active", state.gizmoSnap === true);
    if (ui.btnGizmoSpace3D) {
      ui.btnGizmoSpace3D.textContent = `Espaco: ${state.gizmoSpace === "local" ? "Local" : "Global"} (Q)`;
    }
    if (ui.btnGizmoSnap3D) {
      ui.btnGizmoSnap3D.textContent = `Snap: ${state.gizmoSnap ? "On" : "Off"} (X)`;
    }
  }

  function refreshPlayCameraPanel() {
    const scene = getActiveScene();
    const rig = scene.cameraRig;
    const play = scene.play3d;
    const editDisabled = model.state.mode !== "edit";
    const objects = Array.isArray(scene.objects) ? scene.objects : [];
    const preferred = [
      ...objects.filter((entry) => entry.type !== "plane"),
      ...objects.filter((entry) => entry.type === "plane")
    ];

    ui.scene3dPlayerObject.innerHTML = preferred
      .map((entry) => `<option value="${safe(entry.id)}">${safe(entry.name)} (${safe(entry.type)})</option>`)
      .join("");

    if (preferred.length === 0) {
      ui.scene3dPlayerObject.innerHTML = '<option value="">Sem objeto</option>';
    }

    const hasPlayOption = preferred.some((entry) => entry.id === play.playerObjectId);
    ui.scene3dCameraMode.value = rig.mode;
    ui.scene3dPlayerObject.value = hasPlayOption ? play.playerObjectId : (preferred[0]?.id || "");
    ui.scene3dMoveSpeed.value = String(play.moveSpeed);
    ui.scene3dLookSensitivity.value = String(play.lookSensitivity);
    ui.scene3dFirstBob.value = String(rig.firstPerson.bobAmplitude);
    ui.scene3dThirdDistance.value = String(rig.thirdPerson.distance);

    ui.scene3dCameraMode.disabled = editDisabled;
    ui.scene3dPlayerObject.disabled = editDisabled || preferred.length === 0;
    ui.scene3dMoveSpeed.disabled = editDisabled;
    ui.scene3dLookSensitivity.disabled = editDisabled;
    ui.scene3dFirstBob.disabled = editDisabled;
    ui.scene3dThirdDistance.disabled = editDisabled;
  }

  function commitPlayCameraPanel() {
    if (!ensureEditMode("editar camera de jogo 3D")) {
      refreshPlayCameraPanel();
      return;
    }

    const scene = getActiveScene();
    const currentRig = scene.cameraRig;
    const currentPlay = scene.play3d;
    const nextMode = ui.scene3dCameraMode.value === "first-person" ? "first-person" : "third-person";
    const nextPlayerObjectId = String(ui.scene3dPlayerObject.value || currentPlay.playerObjectId || "");
    const nextMoveSpeed = clamp(numericOr(ui.scene3dMoveSpeed.value, currentPlay.moveSpeed), 20, 1800);
    const nextLookSensitivity = clamp(numericOr(ui.scene3dLookSensitivity.value, currentPlay.lookSensitivity), 0.001, 0.03);
    const nextFirstBob = clamp(numericOr(ui.scene3dFirstBob.value, currentRig.firstPerson.bobAmplitude), 0, 80);
    const nextThirdDistance = clamp(numericOr(ui.scene3dThirdDistance.value, currentRig.thirdPerson.distance), 120, 3000);

    runCommand("Camera Jogo 3D", () => {
      scene.cameraRig = {
        ...currentRig,
        mode: nextMode,
        firstPerson: {
          ...currentRig.firstPerson,
          bobAmplitude: nextFirstBob
        },
        thirdPerson: {
          ...currentRig.thirdPerson,
          distance: nextThirdDistance
        }
      };
      scene.play3d = {
        ...currentPlay,
        playerObjectId: nextPlayerObjectId,
        moveSpeed: nextMoveSpeed,
        lookSensitivity: nextLookSensitivity
      };
    });

    refreshPlayCameraPanel();
    exportJson(false);
    setStatus("Camera de jogo 3D atualizada.", "ok");
  }

  function setTerrainBrushMode(mode, announce = false) {
    const nextMode = ["none", "raise", "lower", "smooth", "flatten", "noise", "erode"].includes(String(mode || "").toLowerCase())
      ? String(mode).toLowerCase()
      : "none";
    state.terrainBrushMode = nextMode;
    refreshTerrainBrushButtons();
    const scene = getActiveScene();
    refreshTerrainPresetGrid(model.state.mode !== "edit" || scene.terrain.enabled === false);
    if (announce) {
      const label = {
        none: "Sem Brush",
        raise: "Subir",
        lower: "Descer",
        smooth: "Suavizar",
        flatten: "Nivelar",
        noise: "Ruido",
        erode: "Erosao"
      }[nextMode] || nextMode;
      setStatus(`Brush de terreno: ${label}.`, "ok");
    }
  }

  function refreshTerrainBrushButtons() {
    ui.btnTerrainRaise3D.classList.toggle("active", state.terrainBrushMode === "raise");
    ui.btnTerrainLower3D.classList.toggle("active", state.terrainBrushMode === "lower");
    ui.btnTerrainSmooth3D.classList.toggle("active", state.terrainBrushMode === "smooth");
    ui.btnTerrainFlatten3D.classList.toggle("active", state.terrainBrushMode === "flatten");
    ui.btnTerrainNoise3D.classList.toggle("active", state.terrainBrushMode === "noise");
    ui.btnTerrainErode3D.classList.toggle("active", state.terrainBrushMode === "erode");
    ui.btnTerrainBrushOff3D.classList.toggle("active", state.terrainBrushMode === "none");
  }

  function handleTerrainPresetClick(event) {
    const button = event.target.closest("[data-preset-id]");
    if (!button) {
      return;
    }

    if (!ensureEditMode("aplicar preset de brush")) {
      return;
    }

    const presetId = String(button.dataset.presetId || "");
    const preset = TERRAIN_BRUSH_PRESET_BY_ID[presetId];
    if (!preset) {
      return;
    }

    state.terrainBrushPresetId = preset.id;
    state.terrainBrushShape = preset.shape;
    state.terrainBrushHardness = preset.hardness;
    state.terrainBrushSpacing = preset.spacing;
    state.terrainBrushNoiseScale = preset.noiseScale;
    state.terrainBrushErosionStrength = preset.erosionStrength;
    commitTerrainPanel({ commandLabel: "Preset Brush Terreno 3D", silentStatus: true, syncFromUi: false });
    draw();
    setStatus(`Preset de brush aplicado: ${preset.label}.`, "ok");
  }

  function refreshTerrainPresetGrid(disabled = false) {
    if (!ui.terrainBrushPresetGrid3D) {
      return;
    }

    ui.terrainBrushPresetGrid3D.innerHTML = TERRAIN_BRUSH_PRESETS.map((preset) => `
      <button type="button" class="terrain-preset-btn ${preset.id === state.terrainBrushPresetId ? "active" : ""}" data-preset-id="${safe(preset.id)}">
        <span class="terrain-preset-swatch" style="background:${safe(preset.swatch)}"></span>
        <small>${safe(preset.label)}</small>
      </button>
    `).join("");

    Array.from(ui.terrainBrushPresetGrid3D.querySelectorAll("button")).forEach((button) => {
      button.disabled = disabled;
    });
  }

  function refreshTerrainPanel() {
    const scene = getActiveScene();
    const terrain = scene.terrain;
    const editDisabled = model.state.mode !== "edit";
    const terrainEnabled = terrain.enabled !== false;
    const brushDisabled = editDisabled || !terrainEnabled;

    ui.scene3dTerrainEnabled.checked = terrainEnabled;
    ui.terrainBrushRadius3D.value = String(state.terrainBrushRadius);
    ui.terrainBrushStrength3D.value = toFieldNumber(state.terrainBrushStrength, 0.9);
    ui.terrainBrushHardness3D.value = toFieldNumber(state.terrainBrushHardness, 0.3);
    ui.terrainBrushSpacing3D.value = toFieldNumber(state.terrainBrushSpacing, 0.08);
    ui.terrainBrushShape3D.value = state.terrainBrushShape;
    ui.terrainBrushTarget3D.value = toFieldNumber(state.terrainBrushTarget, 0);
    ui.terrainBrushNoiseScale3D.value = toFieldNumber(state.terrainBrushNoiseScale, 0.24);
    ui.terrainBrushErosion3D.value = toFieldNumber(state.terrainBrushErosionStrength, 1);
    ui.scene3dTerrainResolutionX.value = String(state.terrainSettingsResolutionX);
    ui.scene3dTerrainResolutionZ.value = String(state.terrainSettingsResolutionZ);
    ui.scene3dTerrainCellSize.value = toFieldNumber(state.terrainSettingsCellSize, 120);
    ui.scene3dTerrainMaxHeight.value = toFieldNumber(state.terrainSettingsMaxHeight, 420);
    ui.terrainImportFormat3D.value = state.terrainImportFormat;
    ui.terrainImportSourceWidth3D.value = String(state.terrainImportSourceWidth);
    ui.terrainImportSourceHeight3D.value = String(state.terrainImportSourceHeight);
    ui.terrainImportEndian3D.value = state.terrainImportEndian;
    ui.terrainImportFlipX3D.checked = state.terrainImportFlipX === true;
    ui.terrainImportFlipZ3D.checked = state.terrainImportFlipZ === true;
    ui.terrainImportNormalize3D.checked = state.terrainImportNormalize === true;
    ui.terrainImportCentered3D.checked = state.terrainImportCentered === true;
    ui.terrainImportHeightScale3D.value = toFieldNumber(state.terrainImportHeightScale, 1);
    ui.terrainImportHeightOffset3D.value = toFieldNumber(state.terrainImportHeightOffset, 0);

    ui.scene3dTerrainEnabled.disabled = editDisabled;
    ui.terrainBrushRadius3D.disabled = brushDisabled;
    ui.terrainBrushStrength3D.disabled = brushDisabled;
    ui.terrainBrushHardness3D.disabled = brushDisabled;
    ui.terrainBrushSpacing3D.disabled = brushDisabled;
    ui.terrainBrushShape3D.disabled = brushDisabled;
    ui.terrainBrushTarget3D.disabled = brushDisabled;
    ui.terrainBrushNoiseScale3D.disabled = brushDisabled;
    ui.terrainBrushErosion3D.disabled = brushDisabled;
    ui.btnTerrainRaise3D.disabled = brushDisabled;
    ui.btnTerrainLower3D.disabled = brushDisabled;
    ui.btnTerrainSmooth3D.disabled = brushDisabled;
    ui.btnTerrainFlatten3D.disabled = brushDisabled;
    ui.btnTerrainNoise3D.disabled = brushDisabled;
    ui.btnTerrainErode3D.disabled = brushDisabled;
    ui.btnTerrainBrushOff3D.disabled = brushDisabled;
    ui.btnTerrainReset3D.disabled = editDisabled;
    ui.scene3dTerrainResolutionX.disabled = editDisabled;
    ui.scene3dTerrainResolutionZ.disabled = editDisabled;
    ui.scene3dTerrainCellSize.disabled = editDisabled;
    ui.scene3dTerrainMaxHeight.disabled = editDisabled;
    ui.btnTerrainApplySettings3D.disabled = editDisabled;
    ui.btnTerrainRandomize3D.disabled = editDisabled;
    ui.btnTerrainImportUnity3D.disabled = editDisabled;
    ui.terrainImportFormat3D.disabled = editDisabled;
    ui.terrainImportSourceWidth3D.disabled = editDisabled;
    ui.terrainImportSourceHeight3D.disabled = editDisabled;
    ui.terrainImportEndian3D.disabled = editDisabled;
    ui.terrainImportFlipX3D.disabled = editDisabled;
    ui.terrainImportFlipZ3D.disabled = editDisabled;
    ui.terrainImportNormalize3D.disabled = editDisabled;
    ui.terrainImportCentered3D.disabled = editDisabled;
    ui.terrainImportHeightScale3D.disabled = editDisabled;
    ui.terrainImportHeightOffset3D.disabled = editDisabled;
    refreshTerrainPresetGrid(brushDisabled);
  }

  function commitTerrainPanel(options = {}) {
    const commandLabel = String(options.commandLabel || "Configurar Terreno 3D");
    const silentStatus = options.silentStatus !== false;
    if (options.syncFromUi !== false) {
      syncTerrainBrushStateFromUi();
    }
    if (!ensureEditMode("editar terreno 3D")) {
      refreshTerrainPanel();
      return;
    }

    const scene = getActiveScene();
    const currentTerrain = scene.terrain;
    const nextEnabled = ui.scene3dTerrainEnabled.checked === true;
    const nextBrush = {
      ...(currentTerrain.brush || {}),
      preset: state.terrainBrushPresetId,
      radius: state.terrainBrushRadius,
      strength: state.terrainBrushStrength,
      targetHeight: state.terrainBrushTarget,
      shape: state.terrainBrushShape,
      hardness: state.terrainBrushHardness,
      spacing: state.terrainBrushSpacing,
      noiseScale: state.terrainBrushNoiseScale,
      erosionStrength: state.terrainBrushErosionStrength
    };
    const brushChanged = !isTerrainBrushEqual(currentTerrain.brush, nextBrush);
    const enabledChanged = currentTerrain.enabled !== nextEnabled;
    if (brushChanged || enabledChanged) {
      runCommand(commandLabel, () => {
        scene.terrain.enabled = nextEnabled;
        scene.terrain.brush = { ...nextBrush };
      });
      updateTerrainStateSnapshot(scene);
      exportJson(false);
      if (!silentStatus) {
        setStatus("Terreno 3D atualizado.", "ok");
      }
    }
    refreshTerrainPanel();
  }

  function applyTerrainSettings() {
    syncTerrainBrushStateFromUi();
    if (!ensureEditMode("aplicar configuracoes de terreno 3D")) {
      refreshTerrainPanel();
      return;
    }

    const scene = getActiveScene();
    const terrain = scene.terrain;
    const nextResolutionX = state.terrainSettingsResolutionX;
    const nextResolutionZ = state.terrainSettingsResolutionZ;
    const nextCellSize = state.terrainSettingsCellSize;
    const nextMaxHeight = state.terrainSettingsMaxHeight;

    const resolutionChanged = terrain.resolutionX !== nextResolutionX || terrain.resolutionZ !== nextResolutionZ;
    const dimensionsChanged = resolutionChanged || terrain.cellSize !== nextCellSize || terrain.maxHeight !== nextMaxHeight;
    if (!dimensionsChanged) {
      refreshTerrainPanel();
      setStatus("Configuracao do heightmap ja esta aplicada.", "ok");
      return;
    }

    const nextHeights = resolutionChanged
      ? resampleTerrainHeights(terrain.heights, terrain.resolutionX, terrain.resolutionZ, nextResolutionX, nextResolutionZ)
      : terrain.heights.slice();
    const clampedHeights = nextHeights.map((value) => clamp(Number(value) || 0, -nextMaxHeight, nextMaxHeight));

    runCommand("Aplicar Heightmap 3D", () => {
      terrain.resolutionX = nextResolutionX;
      terrain.resolutionZ = nextResolutionZ;
      terrain.cellSize = nextCellSize;
      terrain.maxHeight = nextMaxHeight;
      terrain.heights = clampedHeights;
    });

    syncTerrainBrushStateFromScene(terrain);
    updateTerrainStateSnapshot(scene);
    refreshTerrainPanel();
    draw();
    exportJson(false);
    setStatus("Configuracao do heightmap aplicada.", "ok");
  }

  function randomizeTerrainHeights() {
    syncTerrainBrushStateFromUi();
    if (!ensureEditMode("gerar ruido base no terreno 3D")) {
      return;
    }

    const scene = getActiveScene();
    const terrain = scene.terrain;
    const { resolutionX, resolutionZ, maxHeight } = terrain;
    const noiseScale = clamp(state.terrainBrushNoiseScale, 0.01, 3);
    const amplitudeFactor = clamp(state.terrainBrushStrength, 0.05, 4);
    const maxRelief = maxHeight * clamp(0.08 + amplitudeFactor * 0.22, 0.12, 0.92);

    const nextHeights = Array.from({ length: resolutionX * resolutionZ }, (_, index) => {
      const cellX = index % resolutionX;
      const cellZ = Math.floor(index / resolutionX);
      const base = terrainNoiseAt(cellX, cellZ, resolutionX, resolutionZ, noiseScale * 1.1);
      const detail = terrainNoiseAt(cellX + 47.7, cellZ - 23.9, resolutionX, resolutionZ, noiseScale * 2.6);
      const ridge = 1 - Math.abs(terrainNoiseAt(cellX - 11.2, cellZ + 73.4, resolutionX, resolutionZ, noiseScale * 3.9) * 2 - 1);
      const combined = base * 0.56 + detail * 0.28 + ridge * 0.16;
      return clamp((combined - 0.5) * 2 * maxRelief, -maxHeight, maxHeight);
    });

    runCommand("Gerar Ruido Base Terreno 3D", () => {
      terrain.heights = nextHeights;
    });
    updateTerrainStateSnapshot(scene);
    draw();
    exportJson(false);
    setStatus("Ruido base do terreno gerado.", "ok");
  }

  function triggerTerrainImportPicker() {
    if (!ensureEditMode("importar heightmap Unity")) {
      return;
    }
    if (!ui.terrainUnityImportFile) {
      setStatus("Entrada de arquivo de terreno nao encontrada.", "danger");
      return;
    }
    syncTerrainImportStateFromUi();
    ui.terrainUnityImportFile.value = "";
    ui.terrainUnityImportFile.click();
  }

  async function handleTerrainImportFileSelected(event) {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (!file) {
      return;
    }

    syncTerrainImportStateFromUi();
    try {
      await importTerrainFromUnityFile(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "erro desconhecido");
      setStatus(`Falha ao importar heightmap: ${message}`, "danger");
    } finally {
      if (input) {
        input.value = "";
      }
      refreshTerrainPanel();
    }
  }

  async function importTerrainFromUnityFile(file) {
    if (!ensureEditMode("importar heightmap Unity")) {
      return;
    }

    const scene = getActiveScene();
    const terrain = scene.terrain;
    const format = resolveTerrainImportFormat(file, state.terrainImportFormat);
    let source;
    if (format === "png") {
      source = await decodeTerrainHeightmapPng(file);
    } else {
      source = await decodeTerrainHeightmapRaw16(file, state.terrainImportSourceWidth, state.terrainImportSourceHeight, state.terrainImportEndian === "little");
    }

    let normalized = source.samples.slice();
    if (state.terrainImportNormalize) {
      normalized = normalizeSamplesRange(normalized);
    }
    normalized = orientTerrainSamples(normalized, source.width, source.height, state.terrainImportFlipX, state.terrainImportFlipZ);

    const maxHeight = Number(terrain.maxHeight || 420);
    const scaled = normalized.map((sample) => mapUnitySampleToTerrainHeight(sample, maxHeight, state.terrainImportCentered, state.terrainImportHeightScale, state.terrainImportHeightOffset));
    const targetHeights = resampleTerrainHeights(
      scaled,
      source.width,
      source.height,
      terrain.resolutionX,
      terrain.resolutionZ
    ).map((value) => clamp(Number(value) || 0, -maxHeight, maxHeight));

    runCommand("Importar Heightmap Unity 3D", () => {
      terrain.heights = targetHeights;
    });
    updateTerrainStateSnapshot(scene);
    draw();
    exportJson(false);

    const formatLabel = format === "png" ? "PNG" : "RAW 16-bit";
    setStatus(
      `Heightmap ${safe(file.name)} (${formatLabel}) importado: ${source.width}x${source.height} -> ${terrain.resolutionX}x${terrain.resolutionZ}.`,
      "ok"
    );
  }

  function resolveTerrainImportFormat(file, preferred) {
    const format = String(preferred || "auto").trim().toLowerCase();
    if (format === "raw16" || format === "png") {
      return format;
    }

    const name = String(file?.name || "").trim().toLowerCase();
    const type = String(file?.type || "").trim().toLowerCase();
    if (name.endsWith(".png") || type === "image/png") {
      return "png";
    }
    if (name.endsWith(".raw") || name.endsWith(".r16") || name.endsWith(".bytes") || name.endsWith(".dat")) {
      return "raw16";
    }
    return "raw16";
  }

  async function decodeTerrainHeightmapRaw16(file, sourceWidth, sourceHeight, littleEndian = true) {
    const width = Math.max(2, Math.min(4096, Math.round(clamp(numericOr(sourceWidth, 0), 2, 4096))));
    const height = Math.max(2, Math.min(4096, Math.round(clamp(numericOr(sourceHeight, 0), 2, 4096))));
    const buffer = await file.arrayBuffer();
    const totalBytes = buffer.byteLength;
    const expectedBytes = width * height * 2;

    let finalWidth = width;
    let finalHeight = height;
    if (expectedBytes !== totalBytes) {
      const sampleCount = totalBytes / 2;
      const side = Math.sqrt(sampleCount);
      if (Number.isInteger(side)) {
        finalWidth = side;
        finalHeight = side;
      }
    }

    const finalExpectedBytes = finalWidth * finalHeight * 2;
    if (finalExpectedBytes !== totalBytes) {
      throw new Error(`RAW invalido para ${finalWidth}x${finalHeight}. Arquivo tem ${totalBytes} bytes.`);
    }

    const view = new DataView(buffer);
    const samples = Array.from({ length: finalWidth * finalHeight }, (_, index) => {
      const raw = view.getUint16(index * 2, littleEndian);
      return raw / 65535;
    });

    if (finalWidth !== width || finalHeight !== height) {
      setStatus(`Resolucao RAW inferida automaticamente para ${finalWidth}x${finalHeight}.`, "ok");
    }
    return {
      width: finalWidth,
      height: finalHeight,
      samples
    };
  }

  async function decodeTerrainHeightmapPng(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const width = Math.max(2, Number(bitmap.width || 0));
      const height = Math.max(2, Number(bitmap.height || 0));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("nao foi possivel ler pixels do PNG");
      }
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const samples = Array.from({ length: width * height }, (_, index) => {
        const offset = index * 4;
        const r = Number(data[offset] || 0);
        const g = Number(data[offset + 1] || 0);
        const b = Number(data[offset + 2] || 0);
        const gray = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        return clamp(gray, 0, 1);
      });
      return { width, height, samples };
    } finally {
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
    }
  }

  function normalizeSamplesRange(samples) {
    const source = Array.isArray(samples) ? samples : [];
    if (source.length === 0) {
      return [];
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    source.forEach((value) => {
      const sample = clamp(Number(value) || 0, 0, 1);
      if (sample < min) {
        min = sample;
      }
      if (sample > max) {
        max = sample;
      }
    });

    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 0.000001) {
      return source.map((value) => clamp(Number(value) || 0, 0, 1));
    }
    const range = max - min;
    return source.map((value) => clamp((clamp(Number(value) || 0, 0, 1) - min) / range, 0, 1));
  }

  function orientTerrainSamples(samples, width, height, flipX, flipZ) {
    const source = Array.isArray(samples) ? samples : [];
    const safeWidth = Math.max(2, Math.round(Number(width) || 2));
    const safeHeight = Math.max(2, Math.round(Number(height) || 2));
    if (source.length < safeWidth * safeHeight) {
      return Array.from({ length: safeWidth * safeHeight }, (_, index) => clamp(Number(source[index] || 0), 0, 1));
    }

    if (!flipX && !flipZ) {
      return source.slice(0, safeWidth * safeHeight);
    }

    const out = Array.from({ length: safeWidth * safeHeight }, () => 0);
    for (let z = 0; z < safeHeight; z += 1) {
      for (let x = 0; x < safeWidth; x += 1) {
        const srcX = flipX ? (safeWidth - 1 - x) : x;
        const srcZ = flipZ ? (safeHeight - 1 - z) : z;
        out[z * safeWidth + x] = clamp(Number(source[srcZ * safeWidth + srcX] || 0), 0, 1);
      }
    }
    return out;
  }

  function mapUnitySampleToTerrainHeight(sample, maxHeight, centered, heightScale, heightOffset) {
    const value = clamp(Number(sample) || 0, 0, 1);
    const safeMaxHeight = Math.max(20, Number(maxHeight) || 420);
    const scale = clamp(Number(heightScale) || 1, 0.01, 5);
    const offset = clamp(Number(heightOffset) || 0, -2000, 2000);
    if (centered) {
      return clamp(((value * 2) - 1) * safeMaxHeight * scale + offset, -safeMaxHeight, safeMaxHeight);
    }
    return clamp(value * safeMaxHeight * scale + offset, -safeMaxHeight, safeMaxHeight);
  }

  function resetTerrainHeights() {
    if (!ensureEditMode("resetar terreno 3D")) {
      return;
    }

    const scene = getActiveScene();
    runCommand("Resetar Terreno 3D", () => {
      scene.terrain.heights = Array.from({ length: scene.terrain.resolutionX * scene.terrain.resolutionZ }, () => 0);
    });
    updateTerrainStateSnapshot(scene);
    refreshTerrainPanel();
    draw();
    exportJson(false);
    setStatus("Terreno 3D resetado.", "ok");
  }

  function ensureProject3DDefaults() {
    model.project.scenes3d = sanitizeScenes3D(model.project.scenes3d);
    if (!model.project.scenes3d.some((scene) => scene.id === model.project.activeScene3DId)) {
      model.project.activeScene3DId = model.project.scenes3d[0].id;
    }

    const scene = getActiveScene();
    if (!scene.objects.some((entry) => entry.id === state.selectedObjectId)) {
      state.selectedObjectId = scene.objects[0]?.id || "";
    }
  }

  function ensureSceneRuntimeDefaults() {
    const scene = getActiveScene();
    if (!scene) {
      return;
    }

    scene.cameraRig = normalizeCameraRig(scene.cameraRig);
    scene.play3d = normalizePlayConfig(scene.play3d, scene.objects);
    scene.terrain = normalizeTerrain(scene.terrain);
    const signature = buildTerrainStateSignature(scene.terrain);
    if (state.terrainStateSceneId !== scene.id || state.terrainStateSignature !== signature) {
      syncTerrainBrushStateFromScene(scene.terrain);
      state.terrainStateSceneId = scene.id;
      state.terrainStateSignature = signature;
    }
  }

  function normalizeCameraRig(cameraRig) {
    const source = cameraRig && typeof cameraRig === "object" ? cameraRig : {};
    const first = source.firstPerson && typeof source.firstPerson === "object" ? source.firstPerson : {};
    const third = source.thirdPerson && typeof source.thirdPerson === "object" ? source.thirdPerson : {};
    return {
      mode: String(source.mode || "third-person").trim().toLowerCase() === "first-person" ? "first-person" : "third-person",
      minPitch: clamp(numericOr(source.minPitch, -1.45), -Math.PI, Math.PI),
      maxPitch: clamp(numericOr(source.maxPitch, 1.45), -Math.PI, Math.PI),
      firstPerson: {
        eyeHeight: clamp(numericOr(first.eyeHeight, 64), 0, 320),
        bobAmplitude: clamp(numericOr(first.bobAmplitude, 7), 0, 80),
        bobSpeed: clamp(numericOr(first.bobSpeed, 8.5), 0, 30),
        smooth: clamp(numericOr(first.smooth, 0.24), 0.01, 1)
      },
      thirdPerson: {
        distance: clamp(numericOr(third.distance, 620), 120, 3000),
        height: clamp(numericOr(third.height, 180), -300, 1200),
        shoulder: clamp(numericOr(third.shoulder, 70), -300, 300),
        smooth: clamp(numericOr(third.smooth, 0.16), 0.01, 1)
      }
    };
  }

  function normalizePlayConfig(play3d, objects) {
    const source = play3d && typeof play3d === "object" ? play3d : {};
    const list = Array.isArray(objects) ? objects : [];
    const candidate = String(source.playerObjectId || "");
    const fallback = list.find((entry) => entry.type !== "plane")?.id || list[0]?.id || "";
    return {
      playerObjectId: list.some((entry) => entry.id === candidate) ? candidate : fallback,
      moveSpeed: clamp(numericOr(source.moveSpeed, 280), 20, 1800),
      sprintMultiplier: clamp(numericOr(source.sprintMultiplier, 1.7), 1, 4),
      lookSensitivity: clamp(numericOr(source.lookSensitivity, 0.0045), 0.001, 0.03)
    };
  }

  function normalizeTerrain(terrain) {
    const source = terrain && typeof terrain === "object" ? terrain : {};
    const resolutionX = Math.max(8, Math.min(129, Math.round(clamp(numericOr(source.resolutionX, 33), 8, 129))));
    const resolutionZ = Math.max(8, Math.min(129, Math.round(clamp(numericOr(source.resolutionZ, 33), 8, 129))));
    const expected = resolutionX * resolutionZ;
    const sourceHeights = Array.isArray(source.heights) ? source.heights : [];
    const sourceBrush = source.brush && typeof source.brush === "object" ? source.brush : {};
    const shape = String(sourceBrush.shape || "circle").trim().toLowerCase();
    return {
      enabled: source.enabled !== false,
      resolutionX,
      resolutionZ,
      cellSize: clamp(numericOr(source.cellSize, 120), 20, 400),
      maxHeight: clamp(numericOr(source.maxHeight, 420), 20, 2000),
      brush: {
        preset: String(sourceBrush.preset || "soft-circle"),
        radius: Math.max(1, Math.min(20, Math.round(clamp(numericOr(sourceBrush.radius, 3), 1, 20)))),
        strength: clamp(numericOr(sourceBrush.strength, 0.9), 0.05, 4),
        targetHeight: clamp(numericOr(sourceBrush.targetHeight, 0), -2000, 2000),
        shape: ["circle", "square", "diamond"].includes(shape) ? shape : "circle",
        hardness: clamp(numericOr(sourceBrush.hardness, 0.3), 0, 1),
        spacing: clamp(numericOr(sourceBrush.spacing, 0.08), 0, 2),
        noiseScale: clamp(numericOr(sourceBrush.noiseScale, 0.24), 0.01, 3),
        erosionStrength: clamp(numericOr(sourceBrush.erosionStrength, 1), 0.1, 4)
      },
      heights: Array.from({ length: expected }, (_, index) => {
        const value = Number(sourceHeights[index]);
        return Number.isFinite(value) ? value : 0;
      })
    };
  }

  function syncTerrainBrushStateFromScene(terrain) {
    const brush = terrain?.brush && typeof terrain.brush === "object" ? terrain.brush : {};
    const shape = String(brush.shape || "circle").trim().toLowerCase();
    state.terrainBrushRadius = Math.max(1, Math.min(20, Math.round(clamp(numericOr(brush.radius, state.terrainBrushRadius || 3), 1, 20))));
    state.terrainBrushStrength = clamp(numericOr(brush.strength, state.terrainBrushStrength || 0.9), 0.05, 4);
    state.terrainBrushTarget = clamp(numericOr(brush.targetHeight, state.terrainBrushTarget || 0), -2000, 2000);
    state.terrainBrushShape = ["circle", "square", "diamond"].includes(shape) ? shape : "circle";
    state.terrainBrushHardness = clamp(numericOr(brush.hardness, state.terrainBrushHardness || 0.3), 0, 1);
    state.terrainBrushSpacing = clamp(numericOr(brush.spacing, state.terrainBrushSpacing || 0.08), 0, 2);
    state.terrainBrushNoiseScale = clamp(numericOr(brush.noiseScale, state.terrainBrushNoiseScale || 0.24), 0.01, 3);
    state.terrainBrushErosionStrength = clamp(numericOr(brush.erosionStrength, state.terrainBrushErosionStrength || 1), 0.1, 4);
    state.terrainBrushPresetId = resolveTerrainPresetId(brush);
    state.terrainSettingsResolutionX = Math.max(8, Math.min(129, Math.round(clamp(numericOr(terrain?.resolutionX, 33), 8, 129))));
    state.terrainSettingsResolutionZ = Math.max(8, Math.min(129, Math.round(clamp(numericOr(terrain?.resolutionZ, 33), 8, 129))));
    state.terrainSettingsCellSize = clamp(numericOr(terrain?.cellSize, 120), 20, 400);
    state.terrainSettingsMaxHeight = clamp(numericOr(terrain?.maxHeight, 420), 20, 2000);
    state.terrainImportSourceWidth = Math.max(2, Math.min(4096, Math.round(clamp(numericOr(state.terrainImportSourceWidth, terrain?.resolutionX || 33), 2, 4096))));
    state.terrainImportSourceHeight = Math.max(2, Math.min(4096, Math.round(clamp(numericOr(state.terrainImportSourceHeight, terrain?.resolutionZ || 33), 2, 4096))));
  }

  function syncTerrainBrushStateFromUi() {
    state.terrainBrushRadius = Math.max(1, Math.min(20, Math.round(clamp(numericOr(ui.terrainBrushRadius3D?.value, state.terrainBrushRadius || 3), 1, 20))));
    state.terrainBrushStrength = clamp(numericOr(ui.terrainBrushStrength3D?.value, state.terrainBrushStrength || 0.9), 0.05, 4);
    state.terrainBrushHardness = clamp(numericOr(ui.terrainBrushHardness3D?.value, state.terrainBrushHardness || 0.3), 0, 1);
    state.terrainBrushSpacing = clamp(numericOr(ui.terrainBrushSpacing3D?.value, state.terrainBrushSpacing || 0.08), 0, 2);
    const shape = String(ui.terrainBrushShape3D?.value || state.terrainBrushShape || "circle").trim().toLowerCase();
    state.terrainBrushShape = ["circle", "square", "diamond"].includes(shape) ? shape : "circle";
    state.terrainBrushTarget = clamp(numericOr(ui.terrainBrushTarget3D?.value, state.terrainBrushTarget || 0), -2000, 2000);
    state.terrainBrushNoiseScale = clamp(numericOr(ui.terrainBrushNoiseScale3D?.value, state.terrainBrushNoiseScale || 0.24), 0.01, 3);
    state.terrainBrushErosionStrength = clamp(numericOr(ui.terrainBrushErosion3D?.value, state.terrainBrushErosionStrength || 1), 0.1, 4);
    state.terrainSettingsResolutionX = Math.max(8, Math.min(129, Math.round(clamp(numericOr(ui.scene3dTerrainResolutionX?.value, state.terrainSettingsResolutionX || 33), 8, 129))));
    state.terrainSettingsResolutionZ = Math.max(8, Math.min(129, Math.round(clamp(numericOr(ui.scene3dTerrainResolutionZ?.value, state.terrainSettingsResolutionZ || 33), 8, 129))));
    state.terrainSettingsCellSize = clamp(numericOr(ui.scene3dTerrainCellSize?.value, state.terrainSettingsCellSize || 120), 20, 400);
    state.terrainSettingsMaxHeight = clamp(numericOr(ui.scene3dTerrainMaxHeight?.value, state.terrainSettingsMaxHeight || 420), 20, 2000);
    state.terrainBrushPresetId = resolveTerrainPresetId({
      shape: state.terrainBrushShape,
      hardness: state.terrainBrushHardness,
      spacing: state.terrainBrushSpacing,
      noiseScale: state.terrainBrushNoiseScale,
      erosionStrength: state.terrainBrushErosionStrength
    });
  }

  function syncTerrainImportStateFromUi() {
    const format = String(ui.terrainImportFormat3D?.value || state.terrainImportFormat || "auto").trim().toLowerCase();
    const endian = String(ui.terrainImportEndian3D?.value || state.terrainImportEndian || "little").trim().toLowerCase();
    state.terrainImportFormat = ["auto", "raw16", "png"].includes(format) ? format : "auto";
    state.terrainImportSourceWidth = Math.max(2, Math.min(4096, Math.round(clamp(numericOr(ui.terrainImportSourceWidth3D?.value, state.terrainImportSourceWidth || 33), 2, 4096))));
    state.terrainImportSourceHeight = Math.max(2, Math.min(4096, Math.round(clamp(numericOr(ui.terrainImportSourceHeight3D?.value, state.terrainImportSourceHeight || 33), 2, 4096))));
    state.terrainImportEndian = endian === "big" ? "big" : "little";
    state.terrainImportFlipX = ui.terrainImportFlipX3D?.checked === true;
    state.terrainImportFlipZ = ui.terrainImportFlipZ3D?.checked === true;
    state.terrainImportNormalize = ui.terrainImportNormalize3D?.checked === true;
    state.terrainImportCentered = ui.terrainImportCentered3D?.checked === true;
    state.terrainImportHeightScale = clamp(numericOr(ui.terrainImportHeightScale3D?.value, state.terrainImportHeightScale || 1), 0.01, 5);
    state.terrainImportHeightOffset = clamp(numericOr(ui.terrainImportHeightOffset3D?.value, state.terrainImportHeightOffset || 0), -2000, 2000);
    refreshTerrainPanel();
  }

  function updateTerrainStateSnapshot(scene = getActiveScene()) {
    state.terrainStateSceneId = String(scene?.id || "");
    state.terrainStateSignature = buildTerrainStateSignature(scene?.terrain || {});
  }

  function buildTerrainStateSignature(terrain) {
    const brush = terrain?.brush && typeof terrain.brush === "object" ? terrain.brush : {};
    return [
      terrain?.enabled !== false ? "1" : "0",
      Number(terrain?.resolutionX || 0),
      Number(terrain?.resolutionZ || 0),
      Number(terrain?.cellSize || 0),
      Number(terrain?.maxHeight || 0),
      String(brush.preset || ""),
      Number(brush.radius || 0),
      Number(brush.strength || 0),
      Number(brush.targetHeight || 0),
      String(brush.shape || ""),
      Number(brush.hardness || 0),
      Number(brush.spacing || 0),
      Number(brush.noiseScale || 0),
      Number(brush.erosionStrength || 0)
    ].join("|");
  }

  function resolveTerrainPresetId(brush) {
    const direct = String(brush?.preset || "").trim();
    if (direct && TERRAIN_BRUSH_PRESET_BY_ID[direct]) {
      return direct;
    }

    const shape = String(brush?.shape || "circle").toLowerCase();
    const hardness = clamp(numericOr(brush?.hardness, 0.3), 0, 1);
    const spacing = clamp(numericOr(brush?.spacing, 0.08), 0, 2);
    const noiseScale = clamp(numericOr(brush?.noiseScale, 0.24), 0.01, 3);
    const erosionStrength = clamp(numericOr(brush?.erosionStrength, 1), 0.1, 4);

    let best = TERRAIN_BRUSH_PRESETS[0].id;
    let bestScore = Number.POSITIVE_INFINITY;
    TERRAIN_BRUSH_PRESETS.forEach((preset) => {
      const shapePenalty = preset.shape === shape ? 0 : 0.9;
      const score = shapePenalty
        + Math.abs(preset.hardness - hardness) * 2.2
        + Math.abs(preset.spacing - spacing) * 1.1
        + Math.abs(preset.noiseScale - noiseScale) * 0.9
        + Math.abs(preset.erosionStrength - erosionStrength) * 0.7;
      if (score < bestScore) {
        best = preset.id;
        bestScore = score;
      }
    });
    return best;
  }

  function isTerrainBrushEqual(currentBrush, nextBrush) {
    const current = currentBrush && typeof currentBrush === "object" ? currentBrush : {};
    const next = nextBrush && typeof nextBrush === "object" ? nextBrush : {};
    return String(current.preset || "") === String(next.preset || "")
      && Number(current.radius || 0) === Number(next.radius || 0)
      && Math.abs(Number(current.strength || 0) - Number(next.strength || 0)) < 0.0001
      && Math.abs(Number(current.targetHeight || 0) - Number(next.targetHeight || 0)) < 0.0001
      && String(current.shape || "") === String(next.shape || "")
      && Math.abs(Number(current.hardness || 0) - Number(next.hardness || 0)) < 0.0001
      && Math.abs(Number(current.spacing || 0) - Number(next.spacing || 0)) < 0.0001
      && Math.abs(Number(current.noiseScale || 0) - Number(next.noiseScale || 0)) < 0.0001
      && Math.abs(Number(current.erosionStrength || 0) - Number(next.erosionStrength || 0)) < 0.0001;
  }

  function numericOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function enterPlayMode() {
    const scene = getActiveScene();
    state.playRuntime.yaw = Number(scene.camera.yaw || 0);
    state.playRuntime.pitch = Number(scene.camera.pitch || 0);
    state.playRuntime.bobTime = 0;
    state.playRuntime.lastTime = performance.now();
    state.playKeys = { forward: false, backward: false, left: false, right: false, sprint: false };
    state.playLookDrag = null;
  }

  function exitPlayMode() {
    state.playLookDrag = null;
    state.playKeys = { forward: false, backward: false, left: false, right: false, sprint: false };
  }

  function getPlayPlayerObject(scene = getActiveScene()) {
    const list = Array.isArray(scene?.objects) ? scene.objects : [];
    const config = scene?.play3d || {};
    const byId = list.find((entry) => entry.id === config.playerObjectId);
    if (byId) {
      return byId;
    }
    return list.find((entry) => entry.type !== "plane") || list[0] || null;
  }

  function updatePlayRuntime(dt) {
    if (model.state.mode !== "play") {
      state.playLookDrag = null;
      return;
    }

    const scene = getActiveScene();
    const player = getPlayPlayerObject(scene);
    if (!player) {
      return;
    }

    const play = scene.play3d;
    const rig = scene.cameraRig;
    const sensitivity = play.lookSensitivity;
    const yaw = state.playRuntime.yaw;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const moveInputX = (state.playKeys.right ? 1 : 0) - (state.playKeys.left ? 1 : 0);
    const moveInputZ = (state.playKeys.forward ? 1 : 0) - (state.playKeys.backward ? 1 : 0);
    const magnitude = Math.hypot(moveInputX, moveInputZ) || 1;
    const normalizedX = moveInputX / magnitude;
    const normalizedZ = moveInputZ / magnitude;
    const moving = moveInputX !== 0 || moveInputZ !== 0;
    const moveSpeed = play.moveSpeed * (state.playKeys.sprint ? play.sprintMultiplier : 1);
    const step = moveSpeed * dt;

    if (moving) {
      player.x += (rightX * normalizedX + forwardX * normalizedZ) * step;
      player.z += (rightZ * normalizedX + forwardZ * normalizedZ) * step;
      state.playRuntime.bobTime += dt * Math.max(0.1, rig.firstPerson.bobSpeed);
    }

    if (scene.terrain.enabled) {
      const terrainY = sampleTerrainHeight(scene.terrain, player.x, player.z);
      const objectHalfHeight = Math.max(4, Number(player.h || 80) * Math.max(0.05, Number(player.sy || 1)) * 0.5);
      player.y = terrainY + objectHalfHeight;
    }

    const camera = scene.camera;
    camera.yaw = state.playRuntime.yaw;
    camera.pitch = clamp(state.playRuntime.pitch, rig.minPitch, rig.maxPitch);

    if (rig.mode === "first-person") {
      const bobFactor = moving ? 1 : 0.18;
      const bobOffset = Math.sin(state.playRuntime.bobTime * rig.firstPerson.bobSpeed) * rig.firstPerson.bobAmplitude * bobFactor;
      camera.distance = 0;
      camera.targetX = player.x;
      camera.targetY = player.y + rig.firstPerson.eyeHeight + bobOffset;
      camera.targetZ = player.z;
      return;
    }

    camera.distance = rig.thirdPerson.distance;
    camera.targetX = player.x + rightX * rig.thirdPerson.shoulder;
    camera.targetY = player.y + rig.thirdPerson.height;
    camera.targetZ = player.z + rightZ * rig.thirdPerson.shoulder;
  }

  function getActiveScene() {
    return getScene3DById(model.project, model.project.activeScene3DId) || model.project.scenes3d[0];
  }

  function getSelectedObject() {
    const scene = getActiveScene();
    return scene.objects.find((entry) => entry.id === state.selectedObjectId) || null;
  }

  function refreshScene3DList() {
    const activeId = model.project.activeScene3DId;
    const scenes = model.project.scenes3d || [];
    ui.scene3DList.innerHTML = scenes
      .map((scene) => `
        <button class="scene-item ${scene.id === activeId ? "active" : ""}" type="button" data-scene3d-id="${safe(scene.id)}">
          <strong>${safe(scene.name)}</strong>
          <small>${safe(scene.id)}</small>
        </button>
      `)
      .join("");
    if (ui.scene3DCount) {
      ui.scene3DCount.textContent = `${scenes.length} cena(s)`;
    }
  }

  function refreshObject3DList() {
    const scene = getActiveScene();
    ui.object3DList.innerHTML = scene.objects
      .map((entry) => `
        <button class="scene-item ${entry.id === state.selectedObjectId ? "active" : ""}" type="button" data-object3d-id="${safe(entry.id)}">
          <strong>${safe(entry.name)}</strong>
          <small>${safe(entry.type)} | ${safe(entry.id)}</small>
        </button>
      `)
      .join("");
  }

  function refreshInspector3D() {
    const object = getSelectedObject();
    const hasObject = !!object;
    ui.inspector3dEmpty.classList.toggle("hidden", hasObject);
    ui.inspector3dForm.classList.toggle("hidden", !hasObject);
    if (!hasObject) {
      return;
    }

    ui.field3dName.value = String(object.name || "");
    ui.field3dType.value = String(object.type || "");
    ui.field3dX.value = toFieldNumber(object.x, 0);
    ui.field3dY.value = toFieldNumber(object.y, 0);
    ui.field3dZ.value = toFieldNumber(object.z, 0);
    ui.field3dRX.value = toFieldNumber(object.rx, 0);
    ui.field3dRY.value = toFieldNumber(object.ry, 0);
    ui.field3dRZ.value = toFieldNumber(object.rz, 0);
    ui.field3dSX.value = toFieldNumber(object.sx, 1);
    ui.field3dSY.value = toFieldNumber(object.sy, 1);
    ui.field3dSZ.value = toFieldNumber(object.sz, 1);
    ui.field3dW.value = toFieldNumber(object.w, 1);
    ui.field3dH.value = toFieldNumber(object.h, 1);
    ui.field3dD.value = toFieldNumber(object.d, 1);
    ui.field3dColor.value = String(object.color || "#8ad5ff");
  }

  function updateButtonsState() {
    const scene = getActiveScene();
    const hasScene = !!scene;
    const hasSelection = !!getSelectedObject();
    const isEditMode = model.state.mode === "edit";
    ui.btnScene3DDuplicate.disabled = !hasScene;
    ui.btnScene3DDelete.disabled = !hasScene || model.project.scenes3d.length <= 1;
    ui.btnDuplicateObject3D.disabled = !hasSelection || !isEditMode;
    ui.btnDeleteObject3D.disabled = !hasSelection || !isEditMode;
    ui.btnAddCube3D.disabled = !isEditMode;
    ui.btnAddPlane3D.disabled = !isEditMode;
    ui.btnScene3DNew.disabled = !isEditMode;
    ui.btnScene3DDuplicate.disabled = !hasScene || !isEditMode;
    ui.btnScene3DDelete.disabled = (!hasScene || model.project.scenes3d.length <= 1) || !isEditMode;
    ui.btnGizmoMove3D.disabled = !hasSelection || !isEditMode;
    ui.btnGizmoRotate3D.disabled = !hasSelection || !isEditMode;
    ui.btnGizmoScale3D.disabled = !hasSelection || !isEditMode;
    ui.btnGizmoSpace3D.disabled = !hasSelection || !isEditMode;
    ui.btnGizmoSnap3D.disabled = !hasSelection || !isEditMode;
  }

  function ensureEditMode(actionLabel = "editar no 3D") {
    if (model.state.mode === "edit") {
      return true;
    }

    setStatus(`Volte para EDITAR para ${actionLabel}.`, "danger");
    return false;
  }

  function createScene3D() {
    if (!ensureEditMode("criar cena 3D")) {
      return false;
    }

    runCommand("Nova Cena 3D", () => {
      const scene = createDefaultScene3D({
        id: nextScene3DId(model.project),
        name: nextScene3DName(model.project, "Cena 3D")
      });
      model.project.scenes3d.push(scene);
      model.project.activeScene3DId = scene.id;
      state.selectedObjectId = scene.objects[0]?.id || "";
    });
    refresh();
    exportJson(false);
    setStatus("Cena 3D criada.", "ok");
    return true;
  }

  function duplicateScene3D() {
    if (!ensureEditMode("duplicar cena 3D")) {
      return false;
    }

    const scene = getActiveScene();
    if (!scene) {
      return false;
    }
    runCommand("Duplicar Cena 3D", () => {
      const duplicate = clone(scene);
      duplicate.id = nextScene3DId(model.project);
      duplicate.name = nextScene3DName(model.project, `${scene.name} Copia`);
      model.project.scenes3d.push(duplicate);
      model.project.activeScene3DId = duplicate.id;
      state.selectedObjectId = duplicate.objects[0]?.id || "";
    });
    refresh();
    exportJson(false);
    setStatus("Cena 3D duplicada.", "ok");
    return true;
  }

  function deleteScene3D() {
    if (!ensureEditMode("excluir cena 3D")) {
      return false;
    }

    if ((model.project.scenes3d || []).length <= 1) {
      setStatus("Mantenha ao menos 1 cena 3D.", "danger");
      return false;
    }

    const currentId = model.project.activeScene3DId;
    runCommand("Excluir Cena 3D", () => {
      model.project.scenes3d = model.project.scenes3d.filter((scene) => scene.id !== currentId);
      model.project.activeScene3DId = model.project.scenes3d[0].id;
      const nextScene = getActiveScene();
      state.selectedObjectId = nextScene.objects[0]?.id || "";
    });
    refresh();
    exportJson(false);
    setStatus("Cena 3D removida.", "ok");
    return true;
  }

  function addObject3D(type) {
    if (!ensureEditMode("adicionar objeto 3D")) {
      return false;
    }

    const scene = getActiveScene();
    runCommand(type === "plane" ? "Adicionar Plano 3D" : "Adicionar Cubo 3D", () => {
      const counter = nextObject3DCounter(scene);
      const entry = createScene3DObject(type, counter, {
        y: type === "plane" ? -120 : 0,
        x: type === "plane" ? 0 : 140,
        z: type === "plane" ? 0 : 140
      });
      scene.objects.push(entry);
      state.selectedObjectId = entry.id;
    });
    refresh();
    exportJson(false);
    setStatus(`${type === "plane" ? "Plano" : "Cubo"} 3D criado.`, "ok");
    return true;
  }

  function duplicateSelectedObject3D() {
    if (!ensureEditMode("duplicar objeto 3D")) {
      return false;
    }

    const scene = getActiveScene();
    const selected = getSelectedObject();
    if (!selected) {
      setStatus("Selecione um objeto 3D para duplicar.", "danger");
      return false;
    }

    runCommand("Duplicar Objeto 3D", () => {
      const counter = nextObject3DCounter(scene);
      const duplicate = sanitizeScene3DObject({
        ...clone(selected),
        id: `obj3d_${counter}`,
        name: `${selected.name} Copia`,
        x: Number(selected.x || 0) + 120,
        z: Number(selected.z || 0) + 120
      }, counter);
      scene.objects.push(duplicate);
      state.selectedObjectId = duplicate.id;
    });
    refresh();
    exportJson(false);
    setStatus("Objeto 3D duplicado.", "ok");
    return true;
  }

  function deleteSelectedObject3D() {
    if (!ensureEditMode("excluir objeto 3D")) {
      return false;
    }

    const scene = getActiveScene();
    const selected = getSelectedObject();
    if (!selected) {
      setStatus("Selecione um objeto 3D para excluir.", "danger");
      return false;
    }

    runCommand("Excluir Objeto 3D", () => {
      scene.objects = scene.objects.filter((entry) => entry.id !== selected.id);
      state.selectedObjectId = scene.objects[0]?.id || "";
    });
    refresh();
    exportJson(false);
    setStatus("Objeto 3D removido.", "ok");
    return true;
  }

  function commitInspector3D() {
    const selected = getSelectedObject();
    if (!selected) {
      return;
    }

    const nextCandidate = sanitizeScene3DObject({
      ...selected,
      name: ui.field3dName.value,
      x: Number(ui.field3dX.value),
      y: Number(ui.field3dY.value),
      z: Number(ui.field3dZ.value),
      rx: Number(ui.field3dRX.value),
      ry: Number(ui.field3dRY.value),
      rz: Number(ui.field3dRZ.value),
      sx: Number(ui.field3dSX.value),
      sy: Number(ui.field3dSY.value),
      sz: Number(ui.field3dSZ.value),
      w: Number(ui.field3dW.value),
      h: Number(ui.field3dH.value),
      d: Number(ui.field3dD.value),
      color: ui.field3dColor.value
    }, 1);

    if (!nextCandidate) {
      return;
    }

    const hasChanged = [
      "name", "x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz", "w", "h", "d", "color"
    ].some((key) => String(selected[key]) !== String(nextCandidate[key]));
    if (!hasChanged) {
      return;
    }

    runCommand("Transform 3D", () => {
      Object.assign(selected, nextCandidate);
      selected.id = state.selectedObjectId;
    });
    refresh();
    exportJson(false);
  }

  function resetCamera3D() {
    const scene = getActiveScene();
    runCommand("Resetar Camera 3D", () => {
      scene.camera = {
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        yaw: -0.75,
        pitch: 0.48,
        distance: 1800,
        fov: 920
      };
    });
    draw();
    exportJson(false);
    setStatus("Camera 3D resetada.", "ok");
  }

  function handleScene3DListClick(event) {
    const button = event.target.closest("[data-scene3d-id]");
    if (!button) {
      return;
    }
    const sceneId = String(button.dataset.scene3dId || "");
    if (!sceneId || sceneId === model.project.activeScene3DId) {
      return;
    }
    runCommand("Trocar Cena 3D", () => {
      model.project.activeScene3DId = sceneId;
      const scene = getActiveScene();
      state.selectedObjectId = scene.objects[0]?.id || "";
    });
    refresh();
    focusSelectedObject({ announce: false, fitDistance: true, exportChanges: false });
    exportJson(false);
    setStatus(`Cena 3D ativa: ${getActiveScene().name}.`, "ok");
  }

  function handleObject3DListClick(event) {
    const button = event.target.closest("[data-object3d-id]");
    if (!button) {
      return;
    }

    const objectId = String(button.dataset.object3dId || "");
    if (!objectId) {
      return;
    }

    state.selectedObjectId = objectId;
    refreshObject3DList();
    refreshInspector3D();
    focusSelectedObject({ announce: false, fitDistance: true, exportChanges: false });
    draw();
  }

  function handleGizmoShortcut(event) {
    if (!state.active || isTypingTarget(event.target)) {
      return;
    }

    const key = String(event.key || "").toLowerCase();
    if (model.state.mode === "play") {
      if (key === "w") state.playKeys.forward = true;
      if (key === "s") state.playKeys.backward = true;
      if (key === "a") state.playKeys.left = true;
      if (key === "d") state.playKeys.right = true;
      if (event.key === "Shift") state.playKeys.sprint = true;
      return;
    }

    if (model.state.mode !== "edit") {
      return;
    }

    if (key === "w") {
      setGizmoMode("move", true);
      return;
    }
    if (key === "e") {
      setGizmoMode("rotate", true);
      return;
    }
    if (key === "r") {
      setGizmoMode("scale", true);
      return;
    }
    if (key === "q") {
      toggleGizmoSpace(true);
      return;
    }
    if (key === "x") {
      toggleGizmoSnap(true);
      return;
    }
    if (key === "f") {
      event.preventDefault();
      focusSelectedObject({ announce: true, fitDistance: true, exportChanges: true });
    }
  }

  function handlePlayKeyUp(event) {
    if (!state.active || model.state.mode !== "play") {
      return;
    }

    const key = String(event.key || "").toLowerCase();
    if (key === "w") state.playKeys.forward = false;
    if (key === "s") state.playKeys.backward = false;
    if (key === "a") state.playKeys.left = false;
    if (key === "d") state.playKeys.right = false;
    if (event.key === "Shift") state.playKeys.sprint = false;
  }

  function focusSelectedObject(options = {}) {
    const selected = getSelectedObject();
    if (!selected) {
      if (options.announce) {
        setStatus("Selecione um objeto 3D para focar.", "danger");
      }
      return false;
    }

    return focusObject(selected, options);
  }

  function focusObject(object, options = {}) {
    const scene = getActiveScene();
    const camera = scene.camera;
    const fitDistance = options.fitDistance !== false;

    camera.targetX = Number(object.x || 0);
    camera.targetY = Number(object.y || 0);
    camera.targetZ = Number(object.z || 0);

    if (fitDistance) {
      const objectSize = Math.max(
        Number(object.w || 100) * Math.max(0.05, Number(object.sx || 1)),
        Number(object.h || 100) * Math.max(0.05, Number(object.sy || 1)),
        Number(object.d || 100) * Math.max(0.05, Number(object.sz || 1))
      );
      const minRecommended = objectSize * 1.2;
      const maxRecommended = objectSize * 18;
      if (camera.distance < minRecommended || camera.distance > maxRecommended) {
        camera.distance = clamp(objectSize * 4.2, 180, 9000);
      }
    }

    draw();

    if (options.exportChanges !== false) {
      exportJson(false);
    }

    if (options.announce) {
      setStatus(`Camera focada em ${object.name || object.id}.`, "ok");
    }
    return true;
  }

  function getPointerScreenPoint(event) {
    const bounds = ui.viewport3d.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
  }

  function applyTerrainBrush(pointer, options = {}) {
    if (state.terrainBrushMode === "none" || model.state.mode !== "edit") {
      return;
    }

    const scene = getActiveScene();
    const terrain = scene.terrain;
    if (!terrain.enabled) {
      return;
    }

    const viewport = { cx: ui.viewport3d.width * 0.5, cy: ui.viewport3d.height * 0.56 };
    const hitPoint = screenPointToGround(pointer, scene.camera, viewport, scene.camera.fov);
    if (!hitPoint) {
      return;
    }

    const brushState = state.terrainBrushPaint;
    const inverseRaiseLower = options.invert === true;
    let brushMode = state.terrainBrushMode;
    if (inverseRaiseLower && brushMode === "raise") {
      brushMode = "lower";
    } else if (inverseRaiseLower && brushMode === "lower") {
      brushMode = "raise";
    }

    const radiusWorld = Math.max(terrain.cellSize, state.terrainBrushRadius * terrain.cellSize);
    const strength = Math.max(0.01, state.terrainBrushStrength);
    const targetHeight = state.terrainBrushTarget;
    const hardness = clamp(state.terrainBrushHardness, 0, 1);
    const spacing = clamp(state.terrainBrushSpacing, 0, 2);
    const noiseScale = clamp(state.terrainBrushNoiseScale, 0.01, 3);
    const erosionStrength = clamp(state.terrainBrushErosionStrength, 0.1, 4);
    const shape = ["circle", "square", "diamond"].includes(state.terrainBrushShape) ? state.terrainBrushShape : "circle";
    const { resolutionX, resolutionZ, cellSize, maxHeight } = terrain;
    const halfWidth = (resolutionX - 1) * cellSize * 0.5;
    const halfDepth = (resolutionZ - 1) * cellSize * 0.5;
    let touched = false;

    if (!options.beginStroke && brushState && brushState.lastPoint && spacing > 0) {
      const traveled = Math.hypot(hitPoint.x - brushState.lastPoint.x, hitPoint.z - brushState.lastPoint.z);
      const spacingStep = Math.max(cellSize * 0.28, radiusWorld * spacing);
      if (traveled < spacingStep) {
        return;
      }
    }

    for (let z = 0; z < resolutionZ; z += 1) {
      const worldZ = -halfDepth + z * cellSize;
      for (let x = 0; x < resolutionX; x += 1) {
        const worldX = -halfWidth + x * cellSize;
        const dx = worldX - hitPoint.x;
        const dz = worldZ - hitPoint.z;
        const normalizedDistance = terrainBrushNormalizedDistance(dx, dz, radiusWorld, shape);
        if (normalizedDistance > 1) {
          continue;
        }

        const falloff = terrainBrushFalloff(normalizedDistance, hardness);
        if (falloff <= 0.0001) {
          continue;
        }
        const index = z * resolutionX + x;
        const current = Number(terrain.heights[index] || 0);
        let next = current;
        if (brushMode === "raise") {
          next = current + strength * falloff * 6;
        } else if (brushMode === "lower") {
          next = current - strength * falloff * 6;
        } else if (brushMode === "smooth") {
          const averaged = averageTerrainNeighborhood(terrain, x, z);
          next = current + (averaged - current) * Math.min(1, strength * falloff * 0.35);
        } else if (brushMode === "flatten") {
          next = current + (targetHeight - current) * Math.min(1, strength * falloff * 0.25);
        } else if (brushMode === "noise") {
          const noise = terrainNoiseAt(x, z, resolutionX, resolutionZ, noiseScale);
          next = current + (noise - 0.5) * strength * falloff * 18;
        } else if (brushMode === "erode") {
          const averaged = averageTerrainNeighborhood(terrain, x, z);
          const peakDelta = Math.max(0, current - averaged);
          const valleyDelta = Math.max(0, averaged - current);
          const erosion = Math.min(1, strength * falloff * 0.28 * erosionStrength);
          next = current - peakDelta * erosion + valleyDelta * erosion * 0.14;
        }

        next = clamp(next, -maxHeight, maxHeight);
        if (Math.abs(next - current) < 0.0001) {
          continue;
        }

        terrain.heights[index] = next;
        touched = true;
      }
    }

    if (brushState) {
      brushState.lastPoint = { x: hitPoint.x, z: hitPoint.z };
      if (touched) {
        brushState.changed = true;
      }
    }
    if (touched || options.beginStroke === true) {
      draw();
    }
  }

  function averageTerrainNeighborhood(terrain, cellX, cellZ) {
    const { resolutionX, resolutionZ } = terrain;
    let sum = 0;
    let count = 0;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = cellX + dx;
        const z = cellZ + dz;
        if (x < 0 || z < 0 || x >= resolutionX || z >= resolutionZ) {
          continue;
        }
        sum += Number(terrain.heights[z * resolutionX + x] || 0);
        count += 1;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  function terrainNoiseAt(cellX, cellZ, resolutionX, resolutionZ, scale = 1) {
    const safeScale = Math.max(0.01, Number(scale) || 1);
    const nx = ((Number(cellX) + 0.5) / Math.max(1, Number(resolutionX))) * safeScale;
    const nz = ((Number(cellZ) + 0.5) / Math.max(1, Number(resolutionZ))) * safeScale;
    const v1 = Math.sin(nx * 29.73 + nz * 17.13);
    const v2 = Math.cos(nx * 53.21 - nz * 41.77);
    const v3 = Math.sin((nx + nz) * 84.57);
    return (v1 * 0.5 + v2 * 0.35 + v3 * 0.15 + 1) * 0.5;
  }

  function terrainBrushNormalizedDistance(dx, dz, radiusWorld, shape) {
    const radius = Math.max(0.0001, Number(radiusWorld) || 1);
    const absX = Math.abs(dx);
    const absZ = Math.abs(dz);
    if (shape === "square") {
      return Math.max(absX, absZ) / radius;
    }
    if (shape === "diamond") {
      return (absX + absZ) / radius;
    }
    return Math.hypot(dx, dz) / radius;
  }

  function terrainBrushFalloff(normalizedDistance, hardness) {
    const distance = clamp(Number(normalizedDistance) || 0, 0, 1);
    const hard = clamp(Number(hardness) || 0, 0, 1);
    const hardCore = hard * 0.96;
    if (distance <= hardCore) {
      return 1;
    }
    const range = Math.max(0.0001, 1 - hardCore);
    const t = clamp((distance - hardCore) / range, 0, 1);
    return 1 - (t * t * (3 - 2 * t));
  }

  function resampleTerrainHeights(heights, sourceResolutionX, sourceResolutionZ, targetResolutionX, targetResolutionZ) {
    const srcX = Math.max(2, Math.round(Number(sourceResolutionX) || 2));
    const srcZ = Math.max(2, Math.round(Number(sourceResolutionZ) || 2));
    const dstX = Math.max(2, Math.round(Number(targetResolutionX) || 2));
    const dstZ = Math.max(2, Math.round(Number(targetResolutionZ) || 2));
    const source = Array.isArray(heights) ? heights : [];
    if (srcX === dstX && srcZ === dstZ) {
      const expected = dstX * dstZ;
      return Array.from({ length: expected }, (_, index) => Number(source[index] || 0));
    }

    const out = Array.from({ length: dstX * dstZ }, () => 0);
    for (let z = 0; z < dstZ; z += 1) {
      const sourceZ = dstZ === 1 ? 0 : (z / (dstZ - 1)) * (srcZ - 1);
      const z0 = Math.floor(sourceZ);
      const z1 = Math.min(srcZ - 1, z0 + 1);
      const tz = sourceZ - z0;
      for (let x = 0; x < dstX; x += 1) {
        const sourceX = dstX === 1 ? 0 : (x / (dstX - 1)) * (srcX - 1);
        const x0 = Math.floor(sourceX);
        const x1 = Math.min(srcX - 1, x0 + 1);
        const tx = sourceX - x0;
        const h00 = Number(source[z0 * srcX + x0] || 0);
        const h10 = Number(source[z0 * srcX + x1] || 0);
        const h01 = Number(source[z1 * srcX + x0] || 0);
        const h11 = Number(source[z1 * srcX + x1] || 0);
        const top = h00 + (h10 - h00) * tx;
        const bottom = h01 + (h11 - h01) * tx;
        out[z * dstX + x] = top + (bottom - top) * tz;
      }
    }
    return out;
  }

  function handlePointerDown(event) {
    if (!state.active || event.target !== ui.viewport3d) {
      return;
    }

    ui.viewport3d.setPointerCapture(event.pointerId);

    const scene = getActiveScene();
    const camera = scene.camera;
    const pointer = getPointerScreenPoint(event);

    if (model.state.mode === "play") {
      if (event.button === 0 || event.button === 2) {
        state.playLookDrag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          yaw: state.playRuntime.yaw,
          pitch: state.playRuntime.pitch
        };
      }
      return;
    }

    if (event.button === 1 || event.altKey || event.button === 2) {
      state.drag = {
        mode: event.button === 1 ? "pan" : "orbit",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        camera: { ...camera }
      };
      return;
    }

    if (event.button === 0 && state.terrainBrushMode !== "none" && scene.terrain.enabled) {
      state.terrainBrushPaint = {
        pointerId: event.pointerId,
        beforeHeights: scene.terrain.heights.slice(),
        lastPoint: null,
        changed: false
      };
      applyTerrainBrush(pointer, { beginStroke: true, invert: event.shiftKey });
      return;
    }

    if (event.button === 0 && tryStartGizmoDrag(event, pointer)) {
      return;
    }

    const picked = pickObjectAt(pointer);
    if (picked) {
      state.selectedObjectId = picked.id;
      refreshObject3DList();
      refreshInspector3D();
    }
    draw();
  }

  function handlePointerMove(event) {
    if (!state.active) {
      return;
    }

    if (state.playLookDrag && state.playLookDrag.pointerId === event.pointerId && model.state.mode === "play") {
      const scene = getActiveScene();
      const lookSensitivity = scene.play3d.lookSensitivity;
      const dx = event.clientX - state.playLookDrag.startX;
      const dy = event.clientY - state.playLookDrag.startY;
      state.playRuntime.yaw = wrapRadians(state.playLookDrag.yaw + dx * lookSensitivity);
      state.playRuntime.pitch = clamp(state.playLookDrag.pitch + dy * lookSensitivity, scene.cameraRig.minPitch, scene.cameraRig.maxPitch);
      return;
    }

    if (state.terrainBrushPaint && state.terrainBrushPaint.pointerId === event.pointerId && model.state.mode === "edit") {
      applyTerrainBrush(getPointerScreenPoint(event), { beginStroke: false, invert: event.shiftKey });
      return;
    }

    if (state.gizmoDrag && state.gizmoDrag.pointerId === event.pointerId) {
      updateGizmoDrag(event);
      return;
    }

    if (!state.drag || state.drag.pointerId !== event.pointerId) {
      return;
    }

    const scene = getActiveScene();
    const camera = scene.camera;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;

    if (state.drag.mode === "orbit") {
      camera.yaw = wrapRadians(state.drag.camera.yaw + dx * 0.009);
      camera.pitch = wrapRadians(state.drag.camera.pitch + dy * 0.006);
    } else {
      const panScale = Math.max(0.2, camera.distance / 900);
      const yaw = state.drag.camera.yaw;
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const forwardX = Math.sin(yaw);
      const forwardZ = Math.cos(yaw);
      camera.targetX = state.drag.camera.targetX - rightX * dx * panScale + forwardX * dy * panScale;
      camera.targetZ = state.drag.camera.targetZ - rightZ * dx * panScale + forwardZ * dy * panScale;
    }

    draw();
  }

  function handlePointerUp(event) {
    if (state.playLookDrag && state.playLookDrag.pointerId === event.pointerId) {
      state.playLookDrag = null;
      return;
    }

    if (state.terrainBrushPaint && state.terrainBrushPaint.pointerId === event.pointerId) {
      const paintState = state.terrainBrushPaint;
      const scene = getActiveScene();
      const finalHeights = scene.terrain.heights.slice();
      state.terrainBrushPaint = null;
      if (paintState.changed) {
        scene.terrain.heights = paintState.beforeHeights.slice();
        runCommand("Pintar Terreno 3D", () => {
          scene.terrain.heights = finalHeights.slice();
        });
        exportJson(false);
      }
      return;
    }

    if (state.gizmoDrag && state.gizmoDrag.pointerId === event.pointerId) {
      finishGizmoDrag();
      return;
    }

    if (!state.drag || state.drag.pointerId !== event.pointerId) {
      return;
    }

    state.drag = null;
    exportJson(false);
  }

  function handleWheelZoom(event) {
    if (!state.active) {
      return;
    }
    event.preventDefault();
    const scene = getActiveScene();
    const camera = scene.camera;
    const factor = event.deltaY > 0 ? 1.08 : 0.92;
    camera.distance = clamp(camera.distance * factor, 180, 9000);
    draw();
  }

  function pickObjectAt(pointer) {
    const px = Number(pointer?.x || 0);
    const py = Number(pointer?.y || 0);
    const hits = state.renderCache
      .filter((entry) => px >= entry.bounds.x && px <= entry.bounds.x + entry.bounds.w && py >= entry.bounds.y && py <= entry.bounds.y + entry.bounds.h)
      .sort((a, b) => b.depth - a.depth);
    return hits[0] || null;
  }

  function tryStartGizmoDrag(event, pointer) {
    if (!ensureEditMode("usar gizmos 3D")) {
      return false;
    }

    const selected = getSelectedObject();
    if (!selected) {
      return false;
    }

    const handle = pickGizmoHandle(pointer);
    if (!handle) {
      return false;
    }

    state.gizmoDrag = {
      pointerId: event.pointerId,
      mode: state.gizmoMode,
      axis: handle.axis,
      startX: event.clientX,
      startY: event.clientY,
      axisLengthWorld: Number(handle.lengthWorld || 1),
      axisLengthScreen: Math.max(1, Number(handle.lengthScreen || 1)),
      axisScreenX: Number(handle.screenDirection?.x || 1),
      axisScreenY: Number(handle.screenDirection?.y || 0),
      axisVector: normalizeVector(handle.axisVector || axisToDef(handle.axis)?.vector || { x: 1, y: 0, z: 0 }),
      original: readObjectTransformSnapshot(selected),
      label: state.gizmoMode === "move" ? "Mover Objeto 3D" : state.gizmoMode === "rotate" ? "Rotacionar Objeto 3D" : "Escalar Objeto 3D"
    };
    return true;
  }

  function updateGizmoDrag(event) {
    const drag = state.gizmoDrag;
    const selected = getSelectedObject();
    if (!drag || !selected) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const projected = dx * drag.axisScreenX + dy * drag.axisScreenY;
    const useSnap = event.shiftKey ? !state.gizmoSnap : state.gizmoSnap;

    if (drag.mode === "move") {
      let worldDelta = projected * (drag.axisLengthWorld / drag.axisLengthScreen);
      if (useSnap) {
        worldDelta = quantize(worldDelta, GIZMO_SNAP_STEPS.move);
      }
      selected.x = Number(drag.original.x) + worldDelta * drag.axisVector.x;
      selected.y = Number(drag.original.y) + worldDelta * drag.axisVector.y;
      selected.z = Number(drag.original.z) + worldDelta * drag.axisVector.z;
    } else if (drag.mode === "scale") {
      let scaleDelta = projected / 140;
      if (useSnap) {
        scaleDelta = quantize(scaleDelta, GIZMO_SNAP_STEPS.scale);
      }
      const scaleKey = axisToDef(drag.axis)?.scaleKey;
      if (scaleKey) {
        let nextScale = Number(drag.original[scaleKey]) + scaleDelta;
        if (useSnap) {
          nextScale = quantize(nextScale, GIZMO_SNAP_STEPS.scale);
        }
        selected[scaleKey] = clamp(nextScale, 0.05, 12);
      }
    } else {
      let rotateDelta = projected * 0.45;
      if (useSnap) {
        rotateDelta = quantize(rotateDelta, GIZMO_SNAP_STEPS.rotate);
      }
      const rotateKey = axisToDef(drag.axis)?.rotateKey;
      if (rotateKey) {
        let nextRotation = Number(drag.original[rotateKey]) + rotateDelta;
        if (useSnap) {
          nextRotation = quantize(nextRotation, GIZMO_SNAP_STEPS.rotate);
        }
        selected[rotateKey] = nextRotation;
      }
    }

    refreshInspector3D();
    draw();
  }

  function finishGizmoDrag() {
    const drag = state.gizmoDrag;
    const selected = getSelectedObject();
    state.gizmoDrag = null;
    if (!drag || !selected) {
      return;
    }

    const finalState = readObjectTransformSnapshot(selected);
    if (!hasTransformChanged(drag.original, finalState)) {
      return;
    }

    applyObjectTransformSnapshot(selected, drag.original);
    runCommand(drag.label, () => {
      applyObjectTransformSnapshot(selected, finalState);
    });
    refreshInspector3D();
    draw();
    exportJson(false);
  }

  function pickGizmoHandle(pointer) {
    const px = Number(pointer?.x || 0);
    const py = Number(pointer?.y || 0);
    const handles = Array.isArray(state.gizmoHandles) ? state.gizmoHandles : [];
    if (handles.length === 0) {
      return null;
    }

    if (state.gizmoMode === "rotate") {
      return handles
        .map((handle) => {
          const distance = Math.hypot(px - handle.center.x, py - handle.center.y);
          return { handle, delta: Math.abs(distance - handle.radius) };
        })
        .filter((entry) => entry.delta <= 7)
        .sort((left, right) => left.delta - right.delta)[0]?.handle || null;
    }

    return handles
      .map((handle) => {
        const endpointDistance = Math.hypot(px - handle.end.x, py - handle.end.y);
        const lineDistance = distanceToSegment(px, py, handle.center.x, handle.center.y, handle.end.x, handle.end.y);
        return { handle, endpointDistance, lineDistance };
      })
      .filter((entry) => entry.endpointDistance <= 12 || entry.lineDistance <= 8)
      .sort((left, right) => (left.endpointDistance + left.lineDistance) - (right.endpointDistance + right.lineDistance))[0]?.handle || null;
  }

  function readObjectTransformSnapshot(object) {
    return GIZMO_TRANSFORM_KEYS.reduce((acc, key) => {
      acc[key] = object[key];
      return acc;
    }, {});
  }

  function applyObjectTransformSnapshot(object, snapshot) {
    GIZMO_TRANSFORM_KEYS.forEach((key) => {
      object[key] = snapshot[key];
    });
  }

  function hasTransformChanged(a, b) {
    return GIZMO_TRANSFORM_KEYS.some((key) => String(a[key]) !== String(b[key]));
  }

  function draw() {
    if (!ui.viewport3d || !state.active) {
      return;
    }

    const scene = getActiveScene();
    const ctx = ui.viewport3d.getContext("2d");
    const width = ui.viewport3d.width;
    const height = ui.viewport3d.height;
    ctx.clearRect(0, 0, width, height);
    drawBackground(ctx, width, height);

    const viewport = { cx: width * 0.5, cy: height * 0.56 };
    const camera = scene.camera;
    drawGrid(ctx, scene, camera, viewport);
    drawTerrain(ctx, scene, camera, viewport, width, height);

    const entries = buildObjectRenderEntries(scene, camera, viewport, width, height);
    entries.sort((a, b) => a.depth - b.depth);
    entries.forEach((entry) => drawObjectEntry(ctx, entry, entry.id === state.selectedObjectId));
    state.renderCache = entries;
    if (model.state.mode === "edit") {
      state.gizmoHandles = drawGizmo(ctx, scene, camera, viewport, getSelectedObject(), state.gizmoMode, state.gizmoSpace, state.gizmoSnap);
    } else {
      state.gizmoHandles = [];
    }

    drawHud(ctx, scene, state.gizmoMode, state.gizmoSpace, state.gizmoSnap);
  }

  function drawBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0b1320");
    gradient.addColorStop(0.5, "#0f1b2b");
    gradient.addColorStop(1, "#0b121b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx, scene, camera, viewport) {
    const gridStep = Math.max(20, Number(scene.world.grid || 100));
    const halfW = scene.world.width * 0.5;
    const halfD = scene.world.depth * 0.5;
    ctx.strokeStyle = "rgba(130, 168, 196, 0.24)";
    ctx.lineWidth = 1;

    for (let x = -halfW; x <= halfW; x += gridStep) {
      const a = projectPoint({ x, y: 0, z: -halfD }, camera, viewport, scene.camera.fov);
      const b = projectPoint({ x, y: 0, z: halfD }, camera, viewport, scene.camera.fov);
      if (!a || !b) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (let z = -halfD; z <= halfD; z += gridStep) {
      const a = projectPoint({ x: -halfW, y: 0, z }, camera, viewport, scene.camera.fov);
      const b = projectPoint({ x: halfW, y: 0, z }, camera, viewport, scene.camera.fov);
      if (!a || !b) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawTerrain(ctx, scene, camera, viewport, width, height) {
    const terrain = scene.terrain;
    if (!terrain?.enabled) {
      return;
    }

    const quads = [];
    const { resolutionX, resolutionZ, cellSize } = terrain;
    for (let z = 0; z < resolutionZ - 1; z += 1) {
      for (let x = 0; x < resolutionX - 1; x += 1) {
        const corners = [
          projectTerrainVertex(terrain, x, z, camera, viewport, scene.camera.fov),
          projectTerrainVertex(terrain, x + 1, z, camera, viewport, scene.camera.fov),
          projectTerrainVertex(terrain, x + 1, z + 1, camera, viewport, scene.camera.fov),
          projectTerrainVertex(terrain, x, z + 1, camera, viewport, scene.camera.fov)
        ];
        if (corners.some((corner) => !corner)) {
          continue;
        }

        const minX = Math.min(...corners.map((corner) => corner.x));
        const maxX = Math.max(...corners.map((corner) => corner.x));
        const minY = Math.min(...corners.map((corner) => corner.y));
        const maxY = Math.max(...corners.map((corner) => corner.y));
        if (maxX < -20 || minX > width + 20 || maxY < -20 || minY > height + 20) {
          continue;
        }

        const avgDepth = corners.reduce((sum, corner) => sum + corner.cameraZ, 0) / corners.length;
        const avgHeight = corners.reduce((sum, corner) => sum + corner.worldY, 0) / corners.length;
        quads.push({ corners, avgDepth, avgHeight });
      }
    }

    quads.sort((a, b) => a.avgDepth - b.avgDepth);
    quads.forEach((quad) => {
      const intensity = clamp(0.35 + quad.avgHeight / Math.max(20, terrain.maxHeight * 1.6), 0.18, 0.78);
      const green = Math.round(84 + intensity * 90);
      const blue = Math.round(58 + intensity * 36);
      ctx.fillStyle = `rgba(66,${green},${blue},0.55)`;
      ctx.beginPath();
      ctx.moveTo(quad.corners[0].x, quad.corners[0].y);
      for (let index = 1; index < quad.corners.length; index += 1) {
        ctx.lineTo(quad.corners[index].x, quad.corners[index].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(34, 58, 42, 0.22)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
  }

  function projectTerrainVertex(terrain, cellX, cellZ, camera, viewport, fov) {
    const vertex = getTerrainVertexWorld(terrain, cellX, cellZ);
    const projected = projectPoint(vertex, camera, viewport, fov);
    if (!projected) {
      return null;
    }
    return {
      ...projected,
      worldY: vertex.y
    };
  }

  function buildObjectRenderEntries(scene, camera, viewport, width, height) {
    return scene.objects
      .map((object) => buildObjectEntry(object, camera, viewport, width, height))
      .filter(Boolean);
  }

  function buildObjectEntry(object, camera, viewport, width, height) {
    const vertices = buildObjectVertices(object);
    const projected = vertices
      .map((point) => {
        const cameraPoint = worldToCamera(point, camera);
        const screen = projectCameraPoint(cameraPoint, viewport, camera.fov);
        return screen ? { ...screen, cameraZ: cameraPoint.z } : null;
      });

    if (projected.every((point) => point === null)) {
      return null;
    }

    const validPoints = projected.filter(Boolean);
    const minX = Math.max(0, Math.min(...validPoints.map((point) => point.x)));
    const minY = Math.max(0, Math.min(...validPoints.map((point) => point.y)));
    const maxX = Math.min(width, Math.max(...validPoints.map((point) => point.x)));
    const maxY = Math.min(height, Math.max(...validPoints.map((point) => point.y)));
    const depth = validPoints.reduce((sum, point) => sum + point.cameraZ, 0) / validPoints.length;

    return {
      id: object.id,
      object,
      projected,
      depth,
      bounds: {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY)
      }
    };
  }

  function drawObjectEntry(ctx, entry, selected) {
    const color = entry.object.color || "#8ad5ff";
    const faces = BOX_FACES
      .map((face) => {
        const points = face.map((index) => entry.projected[index]).filter(Boolean);
        if (points.length !== 4) {
          return null;
        }

        const avgZ = points.reduce((sum, point) => sum + point.cameraZ, 0) / points.length;
        return { points, avgZ };
      })
      .filter(Boolean)
      .sort((a, b) => a.avgZ - b.avgZ);

    faces.forEach((face, index) => {
      const alpha = selected ? 0.18 + index * 0.02 : 0.12 + index * 0.015;
      ctx.fillStyle = colorWithAlpha(color, clamp(alpha, 0.08, 0.42));
      ctx.beginPath();
      ctx.moveTo(face.points[0].x, face.points[0].y);
      for (let i = 1; i < face.points.length; i += 1) {
        ctx.lineTo(face.points[i].x, face.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    });

    ctx.strokeStyle = selected ? "#ffd27a" : colorWithAlpha(color, 0.78);
    ctx.lineWidth = selected ? 2.2 : 1.3;
    BOX_EDGES.forEach(([a, b]) => {
      const pa = entry.projected[a];
      const pb = entry.projected[b];
      if (!pa || !pb) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });

    if (selected) {
      ctx.fillStyle = "rgba(7, 15, 24, 0.84)";
      ctx.fillRect(entry.bounds.x, Math.max(0, entry.bounds.y - 20), 180, 18);
      ctx.fillStyle = "#ffd27a";
      ctx.font = "12px JetBrains Mono, monospace";
      ctx.fillText(`${entry.object.name} (${entry.object.type})`, entry.bounds.x + 6, Math.max(12, entry.bounds.y - 7));
    }
  }

  function drawGizmo(ctx, scene, camera, viewport, selectedObject, gizmoMode, gizmoSpace, gizmoSnap) {
    if (!selectedObject) {
      return [];
    }

    const centerWorld = {
      x: Number(selectedObject.x || 0),
      y: Number(selectedObject.y || 0),
      z: Number(selectedObject.z || 0)
    };
    const center = projectPoint(centerWorld, camera, viewport, scene.camera.fov);
    if (!center) {
      return [];
    }

    const baseSize = Math.max(120, Math.min(420, Math.max(
      Number(selectedObject.w || 100) * Math.max(0.05, Number(selectedObject.sx || 1)),
      Number(selectedObject.h || 100) * Math.max(0.05, Number(selectedObject.sy || 1)),
      Number(selectedObject.d || 100) * Math.max(0.05, Number(selectedObject.sz || 1))
    )));

    if (gizmoMode === "rotate") {
      return drawRotateGizmo(ctx, center, baseSize * 0.2, gizmoSpace, gizmoSnap);
    }

    return drawMoveScaleGizmo(ctx, scene, camera, viewport, centerWorld, center, selectedObject, baseSize * 0.95, gizmoMode, gizmoSpace, gizmoSnap);
  }

  function drawMoveScaleGizmo(ctx, scene, camera, viewport, centerWorld, center, selectedObject, axisLength, gizmoMode, gizmoSpace, gizmoSnap) {
    const handles = [];
    const minScreenLength = 12;

    GIZMO_AXIS_DEFS.forEach((axisDef) => {
      const axisVector = getAxisWorldVector(axisDef, selectedObject, gizmoSpace);
      const endpoint = projectPoint({
        x: centerWorld.x + axisVector.x * axisLength,
        y: centerWorld.y + axisVector.y * axisLength,
        z: centerWorld.z + axisVector.z * axisLength
      }, camera, viewport, scene.camera.fov);

      if (!endpoint) {
        return;
      }

      const dx = endpoint.x - center.x;
      const dy = endpoint.y - center.y;
      const lengthScreen = Math.hypot(dx, dy);
      if (lengthScreen < minScreenLength) {
        return;
      }

      const dirX = dx / lengthScreen;
      const dirY = dy / lengthScreen;

      ctx.strokeStyle = axisDef.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.stroke();

      ctx.fillStyle = axisDef.color;
      if (gizmoMode === "scale") {
        const size = 8;
        ctx.fillRect(endpoint.x - size * 0.5, endpoint.y - size * 0.5, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(endpoint.x, endpoint.y, 5.8, 0, Math.PI * 2);
        ctx.fill();
      }

      handles.push({
        axis: axisDef.axis,
        center: { x: center.x, y: center.y },
        end: { x: endpoint.x, y: endpoint.y },
        screenDirection: { x: dirX, y: dirY },
        axisVector,
        lengthWorld: axisLength,
        lengthScreen
      });
    });

    ctx.fillStyle = "rgba(12, 20, 28, 0.88)";
    ctx.fillRect(center.x + 8, center.y + 8, 132, 18);
    ctx.fillStyle = "#cbe7ff";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText(`${gizmoMode === "scale" ? "SCALE" : "MOVE"} ${gizmoSpace.toUpperCase()} ${gizmoSnap ? "SNAP" : "FREE"}`, center.x + 14, center.y + 21);

    return handles;
  }

  function drawRotateGizmo(ctx, center, radiusScale, gizmoSpace, gizmoSnap) {
    const handles = [];

    GIZMO_AXIS_DEFS.forEach((axisDef) => {
      const radius = (GIZMO_ROTATE_RADII[axisDef.axis] || 44) + radiusScale;
      ctx.strokeStyle = axisDef.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      handles.push({
        axis: axisDef.axis,
        center: { x: center.x, y: center.y },
        radius
      });
    });

    ctx.fillStyle = "rgba(12, 20, 28, 0.88)";
    ctx.fillRect(center.x + 8, center.y + 8, 132, 18);
    ctx.fillStyle = "#cbe7ff";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText(`ROTATE ${gizmoSpace.toUpperCase()} ${gizmoSnap ? "SNAP" : "FREE"}`, center.x + 14, center.y + 21);

    return handles;
  }

  function drawHud(ctx, scene, gizmoMode, gizmoSpace, gizmoSnap) {
    ctx.fillStyle = "rgba(8, 16, 24, 0.76)";
    ctx.fillRect(10, 10, 500, 58);
    ctx.fillStyle = "#9fc1dc";
    ctx.font = "12px JetBrains Mono, monospace";
    ctx.fillText(`Cena 3D: ${scene.name} | Objetos: ${scene.objects.length}`, 18, 28);
    if (model.state.mode === "play") {
      ctx.fillText("PLAY 3D: arraste para olhar | WASD move | Shift correr", 18, 44);
      ctx.fillText(`Camera: ${scene.cameraRig.mode === "first-person" ? "1P" : "3P"} | Terreno: ${scene.terrain.enabled ? "ON" : "OFF"}`, 18, 58);
      return;
    }

    ctx.fillText("Alt+arraste: orbita 360 | Botao do meio: pan | Roda: zoom", 18, 44);
    ctx.fillText(`Gizmo: ${gizmoMode.toUpperCase()} | ${gizmoSpace.toUpperCase()} | Snap ${gizmoSnap ? "ON" : "OFF"} | W/E/R Q X F`, 18, 58);
  }

  return {
    init,
    refresh,
    resize,
    setActive,
    enterPlayMode,
    exitPlayMode,
    createScene: createScene3D,
    duplicateScene: duplicateScene3D,
    duplicateSelection: duplicateSelectedObject3D,
    deleteSelection: deleteSelectedObject3D
  };
}

function axisToDef(axis) {
  return GIZMO_AXIS_DEFS.find((entry) => entry.axis === axis) || null;
}

function wrapRadians(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const turn = Math.PI * 2;
  let wrapped = numeric % turn;
  if (wrapped > Math.PI) {
    wrapped -= turn;
  } else if (wrapped < -Math.PI) {
    wrapped += turn;
  }
  return wrapped;
}

function getAxisWorldVector(axisDef, object, gizmoSpace) {
  const baseVector = normalizeVector(axisDef?.vector || { x: 1, y: 0, z: 0 });
  if (!object || gizmoSpace !== "local") {
    return baseVector;
  }

  const rx = toRadians(object.rx || 0);
  const ry = toRadians(object.ry || 0);
  const rz = toRadians(object.rz || 0);
  return normalizeVector(rotatePoint(baseVector, rx, ry, rz));
}

function normalizeVector(vector) {
  const x = Number(vector?.x || 0);
  const y = Number(vector?.y || 0);
  const z = Number(vector?.z || 0);
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 0.000001) {
    return { x: 1, y: 0, z: 0 };
  }

  return { x: x / length, y: y / length, z: z / length };
}

function quantize(value, step) {
  const numeric = Number(value);
  const snapStep = Math.abs(Number(step));
  if (!Number.isFinite(numeric) || !Number.isFinite(snapStep) || snapStep <= 0) {
    return numeric;
  }
  return Math.round(numeric / snapStep) * snapStep;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) {
    return Math.hypot(px - bx, py - by);
  }

  const t = c1 / c2;
  const ix = ax + t * vx;
  const iy = ay + t * vy;
  return Math.hypot(px - ix, py - iy);
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function getTerrainVertexWorld(terrain, cellX, cellZ) {
  const resX = Math.max(2, Number(terrain?.resolutionX || 2));
  const resZ = Math.max(2, Number(terrain?.resolutionZ || 2));
  const cellSize = Number(terrain?.cellSize || 100);
  const heights = Array.isArray(terrain?.heights) ? terrain.heights : [];
  const x = clamp(cellX, 0, resX - 1);
  const z = clamp(cellZ, 0, resZ - 1);
  const halfWidth = (resX - 1) * cellSize * 0.5;
  const halfDepth = (resZ - 1) * cellSize * 0.5;
  const index = z * resX + x;
  return {
    x: -halfWidth + x * cellSize,
    y: Number(heights[index] || 0),
    z: -halfDepth + z * cellSize
  };
}

function sampleTerrainHeight(terrain, worldX, worldZ) {
  const resX = Math.max(2, Number(terrain?.resolutionX || 2));
  const resZ = Math.max(2, Number(terrain?.resolutionZ || 2));
  const cellSize = Number(terrain?.cellSize || 100);
  const heights = Array.isArray(terrain?.heights) ? terrain.heights : [];
  const halfWidth = (resX - 1) * cellSize * 0.5;
  const halfDepth = (resZ - 1) * cellSize * 0.5;
  const fx = clamp((worldX + halfWidth) / cellSize, 0, resX - 1);
  const fz = clamp((worldZ + halfDepth) / cellSize, 0, resZ - 1);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(resX - 1, x0 + 1);
  const z1 = Math.min(resZ - 1, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;

  const h00 = Number(heights[z0 * resX + x0] || 0);
  const h10 = Number(heights[z0 * resX + x1] || 0);
  const h01 = Number(heights[z1 * resX + x0] || 0);
  const h11 = Number(heights[z1 * resX + x1] || 0);
  const top = h00 + (h10 - h00) * tx;
  const bottom = h01 + (h11 - h01) * tx;
  return top + (bottom - top) * tz;
}

function screenPointToGround(pointer, camera, viewport, fov) {
  const px = Number(pointer?.x || 0);
  const py = Number(pointer?.y || 0);
  const dirCam = normalizeVector({
    x: (px - viewport.cx) / Math.max(120, Number(fov || 900)),
    y: -(py - viewport.cy) / Math.max(120, Number(fov || 900)),
    z: -1
  });

  const yaw = Number(camera?.yaw || 0);
  const pitch = Number(camera?.pitch || 0);
  const dirWorld = normalizeVector(rotatePoint(dirCam, pitch, yaw, 0));
  const cameraWorld = {
    x: Number(camera?.targetX || 0),
    y: Number(camera?.targetY || 0),
    z: Number(camera?.targetZ || 0)
  };
  const offset = rotatePoint({ x: 0, y: 0, z: Number(camera?.distance || 0) }, pitch, yaw, 0);
  cameraWorld.x += offset.x;
  cameraWorld.y += offset.y;
  cameraWorld.z += offset.z;

  if (Math.abs(dirWorld.y) < 0.0001) {
    return null;
  }

  const t = (0 - cameraWorld.y) / dirWorld.y;
  if (t <= 0) {
    return null;
  }

  return {
    x: cameraWorld.x + dirWorld.x * t,
    y: 0,
    z: cameraWorld.z + dirWorld.z * t
  };
}

function buildObjectVertices(object) {
  const halfW = Math.max(10, Number(object.w || 100)) * Math.max(0.05, Number(object.sx || 1)) * 0.5;
  const halfH = Math.max(10, Number(object.h || 100)) * Math.max(0.05, Number(object.sy || 1)) * 0.5;
  const halfD = Math.max(10, Number(object.d || 100)) * Math.max(0.05, Number(object.sz || 1)) * 0.5;
  const local = [
    { x: -halfW, y: -halfH, z: -halfD },
    { x: halfW, y: -halfH, z: -halfD },
    { x: halfW, y: halfH, z: -halfD },
    { x: -halfW, y: halfH, z: -halfD },
    { x: -halfW, y: -halfH, z: halfD },
    { x: halfW, y: -halfH, z: halfD },
    { x: halfW, y: halfH, z: halfD },
    { x: -halfW, y: halfH, z: halfD }
  ];

  const rx = toRadians(object.rx || 0);
  const ry = toRadians(object.ry || 0);
  const rz = toRadians(object.rz || 0);
  return local.map((point) => {
    const rotated = rotatePoint(point, rx, ry, rz);
    return {
      x: rotated.x + Number(object.x || 0),
      y: rotated.y + Number(object.y || 0),
      z: rotated.z + Number(object.z || 0)
    };
  });
}

function rotatePoint(point, rx, ry, rz) {
  let x = point.x;
  let y = point.y;
  let z = point.z;

  if (rx !== 0) {
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    y = y1;
    z = z1;
  }

  if (ry !== 0) {
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    x = x1;
    z = z1;
  }

  if (rz !== 0) {
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    const x1 = x * cosZ - y * sinZ;
    const y1 = x * sinZ + y * cosZ;
    x = x1;
    y = y1;
  }

  return { x, y, z };
}

function worldToCamera(point, camera) {
  const yaw = Number(camera.yaw || 0);
  const pitch = Number(camera.pitch || 0);
  const tx = Number(camera.targetX || 0);
  const ty = Number(camera.targetY || 0);
  const tz = Number(camera.targetZ || 0);

  const px = point.x - tx;
  const py = point.y - ty;
  const pz = point.z - tz;

  const cosYaw = Math.cos(-yaw);
  const sinYaw = Math.sin(-yaw);
  const x1 = px * cosYaw - pz * sinYaw;
  const z1 = px * sinYaw + pz * cosYaw;

  const cosPitch = Math.cos(-pitch);
  const sinPitch = Math.sin(-pitch);
  const y2 = py * cosPitch - z1 * sinPitch;
  const z2 = py * sinPitch + z1 * cosPitch;

  return {
    x: x1,
    y: y2,
    z: z2 - Number(camera.distance || 1200)
  };
}

function projectCameraPoint(point, viewport, fov) {
  if (!Number.isFinite(point.z) || point.z > -20) {
    return null;
  }

  const scale = Number(fov || 900) / -point.z;
  return {
    x: viewport.cx + point.x * scale,
    y: viewport.cy - point.y * scale
  };
}

function projectPoint(point, camera, viewport, fov) {
  const cameraPoint = worldToCamera(point, camera);
  const projected = projectCameraPoint(cameraPoint, viewport, fov);
  if (!projected) {
    return null;
  }

  return {
    ...projected,
    cameraZ: cameraPoint.z
  };
}

function colorWithAlpha(hex, alpha = 1) {
  const clean = String(hex || "").trim();
  const safeAlpha = clamp(Number(alpha), 0, 1);
  const match = clean.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return `rgba(138,213,255,${safeAlpha})`;
  }

  const raw = match[1];
  const full = raw.length === 3
    ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
    : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${safeAlpha})`;
}

function toRadians(degrees) {
  return Number(degrees || 0) * (Math.PI / 180);
}

function toFieldNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(fallback);
  }
  return String(Math.round(numeric * 1000) / 1000);
}
