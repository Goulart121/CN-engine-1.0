import {
  OBJECT_TYPE_LABELS,
  PAINT_TOOL_LABELS,
  RIGIDBODY_TYPES,
  SCENE_SPACE_LABELS,
  SURFACE_MATERIAL_IDS,
  TILES,
  TILE_BY_ID,
  TILE_LAYER_LABELS,
  VARIABLE_PRESET_LABELS,
  VARIABLE_TYPE_LABELS,
  VIEWPORT_RENDERER_LABELS
} from "./constants.mjs";
import {
  collectBrushCells,
  collectMutableSceneRefs,
  createGameplayObject,
  createInitialState,
  deleteMutableSceneObjects,
  duplicateMutableSceneObjects,
  floodFillTiles,
  getObjectByRef,
  inferVariableType,
  normalizeVariablePreset,
  getTileAt,
  normalizeVariableType,
  normalizeVariableValueByType,
  paintTile as paintSceneTile,
  paintTileLine,
  paintTileRect,
  resolveRandomPaintTileId,
  pickArea,
  pickAt,
  rebuildTileMap,
  sanitizeVariableMeta,
  syncParentHierarchy,
  syncGameplayCounter,
  syncWallCounter,
  validTransform,
  worldToCell
} from "./core-scene.mjs";
import { createNativeCameraState, createNativePreviewConfig, projectNativeRect } from "./native-3d.mjs";
import { loadProjectEditorPrefs, saveProjectEditorPrefs } from "./editor-prefs.mjs";
import {
  BUILD_PROFILE_IDS,
  PROJECT_TEMPLATE_DEFS,
  createDemoAudioClips,
  createDefaultProject,
  createSceneFromProject,
  createSceneFromTemplate,
  duplicateSceneForProject,
  getActiveScene,
  getSceneById,
  sanitizeAudioClips,
  sanitizeAudioRouting,
  sanitizePrefabs,
  sanitizeSpriteAnimations,
  sanitizeSpriteAtlases,
  sanitizeTimelines,
  validateProject
} from "./project-core.mjs";
import { clampWorld, clone, isTyping, overlap, safe, sameRef, snap } from "./utils.mjs";
import { createRuntime } from "./runtime-2d.mjs";
import { clampSceneDepth, normalizeSceneSpaceMode, projectSceneRect, unprojectScenePoint } from "./scene-space.mjs";
import { bindEditorInput } from "./editor-input.mjs";
import { bindInspectorInputs, readInspectorValues, renderInspector } from "./inspector.mjs";
import { createEditor3D } from "./editor-3d.mjs";
import { createSceneListController } from "./scene-list.mjs";
import { createSceneManagerController } from "./scene-manager.mjs";
import { createHistoryManager } from "./history.mjs";
import { alignSelectionEntries, distributeSelectionEntries, getGroupHandleAtPoint, getSelectionBounds as getSelectionLayoutBounds, resizeSelectionEntries } from "./selection-layout.mjs";
import { collectSnapLines, snapMoveBounds, snapResizeBounds } from "./selection-snap.mjs";
import { createVariableTemplate, VARIABLE_TEMPLATE_DEFS } from "./variable-templates.mjs";

const canvas = document.getElementById("viewport");
const ctx = canvas.getContext("2d");
const AUDIO_ROUTE_LABELS = {
  ui: "UI",
  trigger: "Trigger",
  checkpoint: "Checkpoint",
  portal: "Portal",
  pauseon: "Pause On",
  pauseoff: "Pause Off",
  respawn: "Respawn",
  music: "Musica"
};
const AUDIO_ROUTE_KEYS = Object.keys(AUDIO_ROUTE_LABELS);
let audioPreviewInstance = null;

const ui = {
  btnEdit: document.getElementById("btnEdit"),
  btnPlay: document.getElementById("btnPlay"),
  btnWorkspace2D: document.getElementById("btnWorkspace2D"),
  btnWorkspace3D: document.getElementById("btnWorkspace3D"),
  workspace2d: document.getElementById("workspace2d"),
  workspace3d: document.getElementById("workspace3d"),
  btnUndo: document.getElementById("btnUndo"),
  btnRedo: document.getElementById("btnRedo"),
  btnSaveGame: document.getElementById("btnSaveGame"),
  btnLoadGame: document.getElementById("btnLoadGame"),
  btnExport: document.getElementById("btnExportJson"),
  btnImport: document.getElementById("btnImportJson"),
  btnSceneNew: document.getElementById("btnSceneNew"),
  btnSceneDuplicate: document.getElementById("btnSceneDuplicate"),
  btnSceneDelete: document.getElementById("btnSceneDelete"),
  projectTemplateSelect: document.getElementById("projectTemplateSelect"),
  btnApplyProjectTemplate: document.getElementById("btnApplyProjectTemplate"),
  btnDuplicateSelection: document.getElementById("btnDuplicateSelection"),
  btnDeleteSelection: document.getElementById("btnDeleteSelection"),
  btnAlignLeft: document.getElementById("btnAlignLeft"),
  btnAlignTop: document.getElementById("btnAlignTop"),
  btnAlignHCenter: document.getElementById("btnAlignHCenter"),
  btnAlignVCenter: document.getElementById("btnAlignVCenter"),
  btnDistributeH: document.getElementById("btnDistributeH"),
  btnDistributeV: document.getElementById("btnDistributeV"),
  btnAddSpawn: document.getElementById("btnAddSpawn"),
  btnAddTrigger: document.getElementById("btnAddTrigger"),
  btnAddPortal: document.getElementById("btnAddPortal"),
  btnAddCheckpoint: document.getElementById("btnAddCheckpoint"),
  btnAddDoor: document.getElementById("btnAddDoor"),
  btnAddCameraZone: document.getElementById("btnAddCameraZone"),
  btnAddSpriteShape: document.getElementById("btnAddSpriteShape"),
  btnAddLight2D: document.getElementById("btnAddLight2D"),
  btnAddVariable: document.getElementById("btnAddVariable"),
  spaceModeSelect: document.getElementById("spaceModeSelect"),
  viewportRendererSelect: document.getElementById("viewportRendererSelect"),
  toolSelect: document.getElementById("toolSelect"),
  toolPaint: document.getElementById("toolPaint"),
  toolWall: document.getElementById("toolAddWall"),
  paintToolBrush: document.getElementById("paintToolBrush"),
  paintToolRandom: document.getElementById("paintToolRandom"),
  paintToolLine: document.getElementById("paintToolLine"),
  paintToolRect: document.getElementById("paintToolRect"),
  paintToolFill: document.getElementById("paintToolFill"),
  paintToolEyedropper: document.getElementById("paintToolEyedropper"),
  paintBrushSize: document.getElementById("paintBrushSize"),
  paintBrushShape: document.getElementById("paintBrushShape"),
  paintLineThickness: document.getElementById("paintLineThickness"),
  paintAutoTile: document.getElementById("paintAutoTile"),
  tileLayerSelect: document.getElementById("tileLayerSelect"),
  btnResetLayers: document.getElementById("btnResetLayers"),
  sceneCompositeCollider: document.getElementById("sceneCompositeCollider"),
  scenePixelPerfect: document.getElementById("scenePixelPerfect"),
  scenePixelScale: document.getElementById("scenePixelScale"),
  sceneSortByY: document.getElementById("sceneSortByY"),
  sceneSurfaceFrictionDefault: document.getElementById("sceneSurfaceFrictionDefault"),
  sceneSurfaceFrictionGrass: document.getElementById("sceneSurfaceFrictionGrass"),
  sceneSurfaceFrictionStone: document.getElementById("sceneSurfaceFrictionStone"),
  sceneSurfaceFrictionSand: document.getElementById("sceneSurfaceFrictionSand"),
  sceneSurfaceFrictionWater: document.getElementById("sceneSurfaceFrictionWater"),
  sceneSurfaceFrictionLava: document.getElementById("sceneSurfaceFrictionLava"),
  viewShowGrid: document.getElementById("viewShowGrid"),
  viewShowColliders: document.getElementById("viewShowColliders"),
  viewShowLabels: document.getElementById("viewShowLabels"),
  sceneCameraMode: document.getElementById("sceneCameraMode"),
  sceneCameraDamping: document.getElementById("sceneCameraDamping"),
  sceneCameraDeadZoneW: document.getElementById("sceneCameraDeadZoneW"),
  sceneCameraDeadZoneH: document.getElementById("sceneCameraDeadZoneH"),
  sceneCameraLookAheadX: document.getElementById("sceneCameraLookAheadX"),
  sceneCameraLookAheadY: document.getElementById("sceneCameraLookAheadY"),
  sceneCameraZoom: document.getElementById("sceneCameraZoom"),
  sceneCameraConfine: document.getElementById("sceneCameraConfine"),
  sceneCameraFollowEdit: document.getElementById("sceneCameraFollowEdit"),
  sceneCameraShakeEnabled: document.getElementById("sceneCameraShakeEnabled"),
  sceneCameraShakeIntensity: document.getElementById("sceneCameraShakeIntensity"),
  sceneCameraShakeDuration: document.getElementById("sceneCameraShakeDuration"),
  sceneCameraShakeFrequency: document.getElementById("sceneCameraShakeFrequency"),
  sceneLightingEnabled: document.getElementById("sceneLightingEnabled"),
  sceneLightingAmbientColor: document.getElementById("sceneLightingAmbientColor"),
  sceneLightingAmbientAlpha: document.getElementById("sceneLightingAmbientAlpha"),
  sceneLightingShadowLength: document.getElementById("sceneLightingShadowLength"),
  sceneLightingShadowAlpha: document.getElementById("sceneLightingShadowAlpha"),
  sceneUiShowHud: document.getElementById("sceneUiShowHud"),
  sceneUiShowHints: document.getElementById("sceneUiShowHints"),
  sceneUiShowPauseOverlay: document.getElementById("sceneUiShowPauseOverlay"),
  sceneAudioEnabled: document.getElementById("sceneAudioEnabled"),
  sceneAudioMasterVolume: document.getElementById("sceneAudioMasterVolume"),
  sceneAudioSfxVolume: document.getElementById("sceneAudioSfxVolume"),
  sceneAudioMusicVolume: document.getElementById("sceneAudioMusicVolume"),
  layerControls: document.getElementById("layerControls"),
  variableScopeSelect: document.getElementById("variableScopeSelect"),
  variableFilterInput: document.getElementById("variableFilterInput"),
  variableTemplateList: document.getElementById("variableTemplateList"),
  variableList: document.getElementById("variableList"),
  btnResetNativeCamera: document.getElementById("btnResetNativeCamera"),
  buildProfileSelect: document.getElementById("buildProfileSelect"),
  btnApplyBuildProfile: document.getElementById("btnApplyBuildProfile"),
  btnDownloadBuildConfig: document.getElementById("btnDownloadBuildConfig"),
  buildNameInput: document.getElementById("buildNameInput"),
  buildModeSelect: document.getElementById("buildModeSelect"),
  buildStartSceneSelect: document.getElementById("buildStartSceneSelect"),
  buildIncludeEditor: document.getElementById("buildIncludeEditor"),
  buildIncludeDebug: document.getElementById("buildIncludeDebug"),
  buildCompressAssets: document.getElementById("buildCompressAssets"),
  btnImportSpriteAtlas: document.getElementById("btnImportSpriteAtlas"),
  btnResetSpriteAtlas: document.getElementById("btnResetSpriteAtlas"),
  spriteAtlasEditor: document.getElementById("spriteAtlasEditor"),
  btnImportSpriteAnimations: document.getElementById("btnImportSpriteAnimations"),
  btnResetSpriteAnimations: document.getElementById("btnResetSpriteAnimations"),
  spriteAnimationEditor: document.getElementById("spriteAnimationEditor"),
  btnImportAudioClips: document.getElementById("btnImportAudioClips"),
  btnResetAudioClips: document.getElementById("btnResetAudioClips"),
  audioClipEditor: document.getElementById("audioClipEditor"),
  audioRouteUi: document.getElementById("audioRouteUi"),
  audioRouteTrigger: document.getElementById("audioRouteTrigger"),
  audioRouteCheckpoint: document.getElementById("audioRouteCheckpoint"),
  audioRoutePortal: document.getElementById("audioRoutePortal"),
  audioRoutePauseOn: document.getElementById("audioRoutePauseOn"),
  audioRoutePauseOff: document.getElementById("audioRoutePauseOff"),
  audioRouteRespawn: document.getElementById("audioRouteRespawn"),
  audioRouteMusic: document.getElementById("audioRouteMusic"),
  audioClipQuickName: document.getElementById("audioClipQuickName"),
  audioClipQuickSrc: document.getElementById("audioClipQuickSrc"),
  audioClipQuickKind: document.getElementById("audioClipQuickKind"),
  audioClipQuickVolume: document.getElementById("audioClipQuickVolume"),
  audioClipQuickLoop: document.getElementById("audioClipQuickLoop"),
  btnAddAudioClipQuick: document.getElementById("btnAddAudioClipQuick"),
  audioClipLibraryList: document.getElementById("audioClipLibraryList"),
  btnImportTimelines: document.getElementById("btnImportTimelines"),
  btnResetTimelines: document.getElementById("btnResetTimelines"),
  timelineEditor: document.getElementById("timelineEditor"),
  native3dPreview: document.getElementById("native3dPreview"),
  projectSceneList: document.getElementById("projectSceneList"),
  sceneList: document.getElementById("sceneList"),
  sceneCount: document.getElementById("sceneCountBadge"),
  tilePalette: document.getElementById("tilePalette"),
  objectCount: document.getElementById("objectCountBadge"),
  btnSavePrefab: document.getElementById("btnSavePrefab"),
  btnInstantiatePrefab: document.getElementById("btnInstantiatePrefab"),
  prefabList: document.getElementById("prefabList"),
  prefabCount: document.getElementById("prefabCountBadge"),
  inspectorForm: document.getElementById("inspectorForm"),
  inspectorEmpty: document.getElementById("inspectorEmpty"),
  json: document.getElementById("jsonEditor"),
  status: document.getElementById("statusText"),
  fps: document.getElementById("fpsLabel"),
  camera: document.getElementById("cameraLabel"),
  tool: document.getElementById("toolLabel"),
  scene3DCount: document.getElementById("scene3DCountBadge"),
  scene3DList: document.getElementById("scene3DList"),
  btnScene3DNew: document.getElementById("btnScene3DNew"),
  btnScene3DDuplicate: document.getElementById("btnScene3DDuplicate"),
  btnScene3DDelete: document.getElementById("btnScene3DDelete"),
  object3DList: document.getElementById("object3DList"),
  btnAddCube3D: document.getElementById("btnAddCube3D"),
  btnAddPlane3D: document.getElementById("btnAddPlane3D"),
  btnDuplicateObject3D: document.getElementById("btnDuplicateObject3D"),
  btnDeleteObject3D: document.getElementById("btnDeleteObject3D"),
  btnResetCamera3D: document.getElementById("btnResetCamera3D"),
  btnGizmoMove3D: document.getElementById("btnGizmoMove3D"),
  btnGizmoRotate3D: document.getElementById("btnGizmoRotate3D"),
  btnGizmoScale3D: document.getElementById("btnGizmoScale3D"),
  btnGizmoSpace3D: document.getElementById("btnGizmoSpace3D"),
  btnGizmoSnap3D: document.getElementById("btnGizmoSnap3D"),
  scene3dCameraMode: document.getElementById("scene3dCameraMode"),
  scene3dPlayerObject: document.getElementById("scene3dPlayerObject"),
  scene3dMoveSpeed: document.getElementById("scene3dMoveSpeed"),
  scene3dLookSensitivity: document.getElementById("scene3dLookSensitivity"),
  scene3dFirstBob: document.getElementById("scene3dFirstBob"),
  scene3dThirdDistance: document.getElementById("scene3dThirdDistance"),
  scene3dTerrainEnabled: document.getElementById("scene3dTerrainEnabled"),
  btnTerrainRaise3D: document.getElementById("btnTerrainRaise3D"),
  btnTerrainLower3D: document.getElementById("btnTerrainLower3D"),
  btnTerrainSmooth3D: document.getElementById("btnTerrainSmooth3D"),
  btnTerrainFlatten3D: document.getElementById("btnTerrainFlatten3D"),
  btnTerrainNoise3D: document.getElementById("btnTerrainNoise3D"),
  btnTerrainErode3D: document.getElementById("btnTerrainErode3D"),
  btnTerrainBrushOff3D: document.getElementById("btnTerrainBrushOff3D"),
  btnTerrainReset3D: document.getElementById("btnTerrainReset3D"),
  terrainBrushPresetGrid3D: document.getElementById("terrainBrushPresetGrid3D"),
  terrainBrushRadius3D: document.getElementById("terrainBrushRadius3D"),
  terrainBrushStrength3D: document.getElementById("terrainBrushStrength3D"),
  terrainBrushHardness3D: document.getElementById("terrainBrushHardness3D"),
  terrainBrushSpacing3D: document.getElementById("terrainBrushSpacing3D"),
  terrainBrushShape3D: document.getElementById("terrainBrushShape3D"),
  terrainBrushTarget3D: document.getElementById("terrainBrushTarget3D"),
  terrainBrushNoiseScale3D: document.getElementById("terrainBrushNoiseScale3D"),
  terrainBrushErosion3D: document.getElementById("terrainBrushErosion3D"),
  scene3dTerrainResolutionX: document.getElementById("scene3dTerrainResolutionX"),
  scene3dTerrainResolutionZ: document.getElementById("scene3dTerrainResolutionZ"),
  scene3dTerrainCellSize: document.getElementById("scene3dTerrainCellSize"),
  scene3dTerrainMaxHeight: document.getElementById("scene3dTerrainMaxHeight"),
  btnTerrainApplySettings3D: document.getElementById("btnTerrainApplySettings3D"),
  btnTerrainRandomize3D: document.getElementById("btnTerrainRandomize3D"),
  terrainUnityImportFile: document.getElementById("terrainUnityImportFile"),
  btnTerrainImportUnity3D: document.getElementById("btnTerrainImportUnity3D"),
  terrainImportFormat3D: document.getElementById("terrainImportFormat3D"),
  terrainImportSourceWidth3D: document.getElementById("terrainImportSourceWidth3D"),
  terrainImportSourceHeight3D: document.getElementById("terrainImportSourceHeight3D"),
  terrainImportEndian3D: document.getElementById("terrainImportEndian3D"),
  terrainImportFlipX3D: document.getElementById("terrainImportFlipX3D"),
  terrainImportFlipZ3D: document.getElementById("terrainImportFlipZ3D"),
  terrainImportNormalize3D: document.getElementById("terrainImportNormalize3D"),
  terrainImportCentered3D: document.getElementById("terrainImportCentered3D"),
  terrainImportHeightScale3D: document.getElementById("terrainImportHeightScale3D"),
  terrainImportHeightOffset3D: document.getElementById("terrainImportHeightOffset3D"),
  viewport3d: document.getElementById("viewport3d"),
  inspector3dEmpty: document.getElementById("inspector3dEmpty"),
  inspector3dForm: document.getElementById("inspector3dForm"),
  field3dName: document.getElementById("field3dName"),
  field3dType: document.getElementById("field3dType"),
  field3dX: document.getElementById("field3dX"),
  field3dY: document.getElementById("field3dY"),
  field3dZ: document.getElementById("field3dZ"),
  field3dRX: document.getElementById("field3dRX"),
  field3dRY: document.getElementById("field3dRY"),
  field3dRZ: document.getElementById("field3dRZ"),
  field3dSX: document.getElementById("field3dSX"),
  field3dSY: document.getElementById("field3dSY"),
  field3dSZ: document.getElementById("field3dSZ"),
  field3dW: document.getElementById("field3dW"),
  field3dH: document.getElementById("field3dH"),
  field3dD: document.getElementById("field3dD"),
  field3dColor: document.getElementById("field3dColor"),
  f: {
    name: document.getElementById("fieldName"),
    type: document.getElementById("fieldType"),
    state: document.getElementById("fieldState"),
    metaFields: document.getElementById("fieldMetaFields"),
    x: document.getElementById("fieldX"),
    y: document.getElementById("fieldY"),
    z: document.getElementById("fieldZ"),
    w: document.getElementById("fieldW"),
    h: document.getElementById("fieldH")
  }
};

const model = {
  project: createDefaultProject(),
  scene: null,
  state: {
    ...createInitialState(),
    selectedPrefabId: ""
  }
};

const historyMeta = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null
};

const history = createHistoryManager({
  limit: 250,
  isEqual: isEditorSnapshotEqual,
  onChange(meta) {
    historyMeta.canUndo = meta.canUndo;
    historyMeta.canRedo = meta.canRedo;
    historyMeta.undoLabel = meta.undoLabel;
    historyMeta.redoLabel = meta.redoLabel;
    applyHistoryUi();
  }
});

syncActiveScene();
rebuildTileMap(model.scene, model.state.tileMaps);
model.state.wallCounter = syncWallCounter(model.scene);
model.state.gameplayCounter = syncGameplayCounter(model.scene);
applySavedPreferences();

const runtime = createRuntime({
  canvas,
  ctx,
  ui,
  model,
  TILE_BY_ID,
  getSelectedRef: () => model.state.selected,
  getSelectedRefs: () => getSelectedRefs(),
  setStatus,
  onPlaySceneChange: switchSceneInPlay
});

const projectSceneController = createSceneManagerController({
  container: ui.projectSceneList,
  countBadge: ui.sceneCount,
  getProject: () => model.project,
  getActiveSceneId: () => model.project.activeSceneId,
  onSelect: selectProjectScene,
  safe
});

const sceneListController = createSceneListController({
  container: ui.sceneList,
  objectCountBadge: ui.objectCount,
  getScene: () => model.scene,
  getSelectedRef: () => model.state.selected,
  getSelectedRefs: () => getSelectedRefs(),
  onSelect: selectRef,
  sameRef,
  safe
});

const editor3d = createEditor3D({
  ui,
  model,
  setStatus,
  runCommand,
  exportJson
});

bindInspectorInputs(ui.inspectorForm, ui.f, commitInspector);

bindEditorInput({
  canvas,
  model,
  isTyping,
  getViewportRenderer: () => model.state.viewportRenderer,
  setMode,
  pickAt,
  getObjectByRef,
  getSelectedRefs: () => getSelectedRefs(),
  paintBrush: (point, tileId) => {
    if (!canEditActiveLayer()) {
      return;
    }
    paintBrushTiles(point, tileId);
  },
  paintLine: (startPoint, endPoint, tileId) => {
    if (!canEditActiveLayer()) {
      return;
    }
    paintTileLine(model.scene, model.state.tileMaps, model.state.tileLayer, startPoint, endPoint, tileId, {
      autoTile: model.state.autoTileEnabled !== false,
      thickness: normalizePaintLineThickness(model.state.paintLineThickness),
      brushShape: normalizePaintBrushShape(model.state.paintBrushShape)
    });
  },
  paintRect: (startPoint, endPoint, tileId) => {
    if (!canEditActiveLayer()) {
      return;
    }
    paintTileRect(model.scene, model.state.tileMaps, model.state.tileLayer, startPoint, endPoint, tileId, { autoTile: model.state.autoTileEnabled !== false });
  },
  fillTiles: (point, tileId) => {
    if (!canEditActiveLayer()) {
      return;
    }
    floodFillTiles(model.scene, model.state.tileMaps, model.state.tileLayer, point.x, point.y, tileId, { autoTile: model.state.autoTileEnabled !== false });
  },
  sampleTile: (point) => sampleActiveLayerTile(point),
  hitGroupHandle: (viewPoint, worldPoint) => hitGroupHandle(viewPoint, worldPoint),
  startPaintShapePreview: (point, erase) => startPaintShapePreview(point, erase),
  updatePaintShapePreview: (point) => updatePaintShapePreview(point),
  clearPaintShapePreview,
  startSelectionBox: (point) => startSelectionBox(point),
  updateSelectionBox: (point) => updateSelectionBox(point),
  clearSelectionBox,
  selectArea: (point, options) => selectArea(point, options),
  addWall: (point) => addWall(point.x, point.y),
  onSelect: selectRef,
  onDragMove: handleDragMove,
  onDragStart: (dragMeta) => {
    model.state.drag.startPositions = null;
    beginCommandGroup(dragMeta?.mode === "resizeGroup" ? "Redimensionar Selecao" : "Mover Objeto");
  },
  onDragEnd: () => {
    model.state.drag.startPositions = null;
    const changed = commitCommandGroup();
    if (changed) {
      exportJson(false);
    }
  },
  onPaintStart: () => beginCommandGroup("Pintar Tiles"),
  onPaintEnd: () => {
    const changed = commitCommandGroup();
    if (changed) {
      exportJson(false);
    }
  },
  onViewportOrbit: orbitNativeViewport,
  onViewportPan: panActiveViewport,
  onViewportZoom: zoomActiveViewport,
  onViewportNavigateEnd: commitViewportNavigation,
  onDuplicateSelection: duplicateSelectionFromShortcut,
  onDeleteSelection: deleteSelectionFromShortcut,
  onUndo: undoCommand,
  onRedo: redoCommand
});

init();

function init() {
  buildProjectTemplateOptions();
  buildBuildProfileOptions();
  buildPalette();
  buildLayerControls();
  buildVariableTemplates();
  bindUiEvents();
  editor3d.init();
  runtime.resize();
  editor3d.resize();
  refreshAll();
  setStatus(buildInitialStatusMessage());
  runtime.start();
}

function buildInitialStatusMessage() {
  const hasDemoTrigger = Array.isArray(model.scene?.gameObjects)
    && model.scene.gameObjects.some((item) => item.type === "trigger" && item.triggerTag === "gatilho_demo");

  if (hasDemoTrigger) {
    return "Engine pronta. Cena demo carregada: entre em JOGAR, aproxime-se do gatilho e pressione E.";
  }

  return "Engine pronta. Projeto 2D ativo.";
}

function buildProjectTemplateOptions() {
  ui.projectTemplateSelect.innerHTML = PROJECT_TEMPLATE_DEFS.map((template) => `<option value="${safe(template.id)}">${safe(template.label)}</option>`).join("");
}

function buildBuildProfileOptions() {
  ui.buildProfileSelect.innerHTML = BUILD_PROFILE_IDS.map((profileId) => `<option value="${safe(profileId)}">${safe(profileId)}</option>`).join("");
}

function bindUiEvents() {
  window.addEventListener("resize", handleWindowResize);
  document.addEventListener("keydown", handleWorkspace3DShortcuts);

  ui.btnEdit.addEventListener("click", () => setMode("edit"));
  ui.btnPlay.addEventListener("click", () => setMode("play"));
  ui.btnWorkspace2D.addEventListener("click", () => setWorkspaceMode("2d"));
  ui.btnWorkspace3D.addEventListener("click", () => setWorkspaceMode("3d"));
  ui.btnUndo.addEventListener("click", undoCommand);
  ui.btnRedo.addEventListener("click", redoCommand);
  ui.btnSaveGame.addEventListener("click", saveGameState);
  ui.btnLoadGame.addEventListener("click", loadGameState);
  ui.btnSceneNew.addEventListener("click", createNewScene);
  ui.btnSceneDuplicate.addEventListener("click", duplicateActiveScene);
  ui.btnSceneDelete.addEventListener("click", deleteActiveScene);
  ui.btnApplyProjectTemplate.addEventListener("click", applyProjectTemplate);
  ui.btnDuplicateSelection.addEventListener("click", duplicateSelection);
  ui.btnDeleteSelection.addEventListener("click", deleteSelection);
  ui.btnAlignLeft.addEventListener("click", () => alignSelection("left"));
  ui.btnAlignTop.addEventListener("click", () => alignSelection("top"));
  ui.btnAlignHCenter.addEventListener("click", () => alignSelection("h-center"));
  ui.btnAlignVCenter.addEventListener("click", () => alignSelection("v-center"));
  ui.btnDistributeH.addEventListener("click", () => distributeSelection("x"));
  ui.btnDistributeV.addEventListener("click", () => distributeSelection("y"));
  ui.btnAddSpawn.addEventListener("click", () => addGameplayObject("spawn"));
  ui.btnAddTrigger.addEventListener("click", () => addGameplayObject("trigger"));
  ui.btnAddPortal.addEventListener("click", () => addGameplayObject("portal"));
  ui.btnAddCheckpoint.addEventListener("click", () => addGameplayObject("checkpoint"));
  ui.btnAddDoor.addEventListener("click", () => addGameplayObject("door"));
  ui.btnAddCameraZone.addEventListener("click", () => addGameplayObject("cameraZone"));
  ui.btnAddSpriteShape.addEventListener("click", () => addGameplayObject("spriteShape"));
  ui.btnAddLight2D.addEventListener("click", () => addGameplayObject("light2d"));
  ui.toolSelect.addEventListener("click", () => setTool("select", { announce: true }));
  ui.toolPaint.addEventListener("click", () => setTool("paint", { announce: true }));
  ui.toolWall.addEventListener("click", () => setTool("addWall", { announce: true }));
  ui.paintToolBrush.addEventListener("click", () => setPaintTool("brush", { announce: true }));
  ui.paintToolRandom.addEventListener("click", () => setPaintTool("random", { announce: true }));
  ui.paintToolLine.addEventListener("click", () => setPaintTool("line", { announce: true }));
  ui.paintToolRect.addEventListener("click", () => setPaintTool("rect", { announce: true }));
  ui.paintToolFill.addEventListener("click", () => setPaintTool("fill", { announce: true }));
  ui.paintToolEyedropper.addEventListener("click", () => setPaintTool("eyedropper", { announce: true }));
  ui.paintBrushSize.addEventListener("change", handlePaintBrushSizeChange);
  ui.paintBrushShape.addEventListener("change", handlePaintBrushShapeChange);
  ui.paintLineThickness.addEventListener("change", handlePaintLineThicknessChange);
  ui.paintAutoTile.addEventListener("change", handlePaintAutoTileChange);
  ui.spaceModeSelect.addEventListener("change", handleSpaceModeChange);
  ui.viewportRendererSelect.addEventListener("change", handleViewportRendererChange);
  ui.tileLayerSelect.addEventListener("change", handleTileLayerChange);
  ui.btnResetLayers.addEventListener("click", resetLayerControls);
  ui.sceneCompositeCollider.addEventListener("change", commitScenePhysicsInputs);
  ui.scenePixelPerfect.addEventListener("change", commitScenePhysicsInputs);
  ui.scenePixelScale.addEventListener("change", commitScenePhysicsInputs);
  ui.scenePixelScale.addEventListener("blur", refreshScenePhysicsPanel);
  ui.sceneSortByY.addEventListener("change", commitScenePhysicsInputs);
  [
    ui.sceneSurfaceFrictionDefault,
    ui.sceneSurfaceFrictionGrass,
    ui.sceneSurfaceFrictionStone,
    ui.sceneSurfaceFrictionSand,
    ui.sceneSurfaceFrictionWater,
    ui.sceneSurfaceFrictionLava
  ].forEach((field) => {
    field.addEventListener("change", commitScenePhysicsInputs);
    field.addEventListener("blur", refreshScenePhysicsPanel);
  });
  ui.viewShowGrid.addEventListener("change", commitEditorVisualInputs);
  ui.viewShowColliders.addEventListener("change", commitEditorVisualInputs);
  ui.viewShowLabels.addEventListener("change", commitEditorVisualInputs);
  [
    ui.sceneCameraMode,
    ui.sceneCameraDamping,
    ui.sceneCameraDeadZoneW,
    ui.sceneCameraDeadZoneH,
    ui.sceneCameraLookAheadX,
    ui.sceneCameraLookAheadY,
    ui.sceneCameraZoom,
    ui.sceneCameraConfine,
    ui.sceneCameraFollowEdit,
    ui.sceneCameraShakeEnabled,
    ui.sceneCameraShakeIntensity,
    ui.sceneCameraShakeDuration,
    ui.sceneCameraShakeFrequency
  ]
    .forEach((field) => field.addEventListener("change", commitSceneCameraInputs));
  [ui.sceneLightingEnabled, ui.sceneLightingAmbientColor, ui.sceneLightingAmbientAlpha, ui.sceneLightingShadowLength, ui.sceneLightingShadowAlpha]
    .forEach((field) => field.addEventListener("change", commitSceneLightingInputs));
  [ui.sceneUiShowHud, ui.sceneUiShowHints, ui.sceneUiShowPauseOverlay]
    .forEach((field) => field.addEventListener("change", commitSceneUiInputs));
  [ui.sceneAudioEnabled, ui.sceneAudioMasterVolume, ui.sceneAudioSfxVolume, ui.sceneAudioMusicVolume]
    .forEach((field) => field.addEventListener("change", commitSceneAudioInputs));
  [ui.sceneAudioMasterVolume, ui.sceneAudioSfxVolume, ui.sceneAudioMusicVolume]
    .forEach((field) => field.addEventListener("blur", refreshSceneAudioPanel));
  ui.layerControls.addEventListener("click", handleLayerControlsClick);
  ui.variableScopeSelect.addEventListener("change", () => {
    refreshVariableTemplates();
    refreshVariablePanel();
  });
  ui.variableFilterInput.addEventListener("input", refreshVariablePanel);
  ui.btnAddVariable.addEventListener("click", addVariableEntry);
  ui.btnSavePrefab.addEventListener("click", saveSelectedAsPrefab);
  ui.btnInstantiatePrefab.addEventListener("click", instantiateSelectedPrefab);
  ui.prefabList.addEventListener("click", handlePrefabListClick);
  ui.btnResetNativeCamera.addEventListener("click", resetNativeViewportCamera);
  ui.btnImportSpriteAtlas.addEventListener("click", importSpriteAtlas);
  ui.btnResetSpriteAtlas.addEventListener("click", resetSpriteAtlas);
  ui.btnImportSpriteAnimations.addEventListener("click", importSpriteAnimations);
  ui.btnResetSpriteAnimations.addEventListener("click", resetSpriteAnimations);
  ui.btnImportAudioClips.addEventListener("click", importAudioClips);
  ui.btnResetAudioClips.addEventListener("click", resetAudioClips);
  [
    ui.audioRouteUi,
    ui.audioRouteTrigger,
    ui.audioRouteCheckpoint,
    ui.audioRoutePortal,
    ui.audioRoutePauseOn,
    ui.audioRoutePauseOff,
    ui.audioRouteRespawn,
    ui.audioRouteMusic
  ].forEach((field) => field.addEventListener("change", commitAudioRoutingInputs));
  ui.btnAddAudioClipQuick.addEventListener("click", addAudioClipQuick);
  ui.audioClipLibraryList.addEventListener("click", handleAudioClipLibraryClick);
  ui.audioClipQuickKind.addEventListener("change", () => {
    if (ui.audioClipQuickKind.value === "music") {
      ui.audioClipQuickLoop.checked = true;
    }
  });
  ui.btnImportTimelines.addEventListener("click", importTimelines);
  ui.btnResetTimelines.addEventListener("click", resetTimelines);
  ui.btnApplyBuildProfile.addEventListener("click", applyBuildProfile);
  ui.btnDownloadBuildConfig.addEventListener("click", downloadBuildConfig);
  ui.buildProfileSelect.addEventListener("change", refreshBuildPanel);
  ui.buildNameInput.addEventListener("change", commitBuildConfigInputs);
  ui.buildModeSelect.addEventListener("change", commitBuildConfigInputs);
  ui.buildStartSceneSelect.addEventListener("change", commitBuildConfigInputs);
  ui.buildIncludeEditor.addEventListener("change", commitBuildConfigInputs);
  ui.buildIncludeDebug.addEventListener("change", commitBuildConfigInputs);
  ui.buildCompressAssets.addEventListener("change", commitBuildConfigInputs);
  ui.variableTemplateList.addEventListener("click", handleVariableTemplateClick);
  ui.variableList.addEventListener("click", handleVariableListClick);
  ui.variableList.addEventListener("change", commitVariablePanel);
  ui.variableList.addEventListener("blur", handleVariableListBlur, true);
  ui.btnExport.addEventListener("click", () => exportJson(true));
  ui.btnImport.addEventListener("click", importJson);
}

function normalizeWorkspaceMode(mode) {
  return String(mode || "2d").trim().toLowerCase() === "3d" ? "3d" : "2d";
}

function isWorkspace3DActive() {
  return normalizeWorkspaceMode(model.state.workspaceMode) === "3d";
}

function applyWorkspaceUiState() {
  const workspaceMode = normalizeWorkspaceMode(model.state.workspaceMode);
  const is3D = workspaceMode === "3d";
  model.state.workspaceMode = workspaceMode;

  ui.btnWorkspace2D.classList.toggle("active", !is3D);
  ui.btnWorkspace3D.classList.toggle("active", is3D);
  ui.workspace2d.classList.toggle("hidden", is3D);
  ui.workspace3d.classList.toggle("hidden", !is3D);

  editor3d.setActive(is3D);
}

function setWorkspaceMode(workspaceMode, options = {}) {
  const nextMode = normalizeWorkspaceMode(workspaceMode);
  const previousMode = normalizeWorkspaceMode(model.state.workspaceMode);
  if (nextMode === previousMode) {
    applyWorkspaceUiState();
    return;
  }

  if (nextMode !== previousMode && model.state.mode === "play") {
    setMode("edit");
  }

  model.state.workspaceMode = nextMode;
  clearPaintShapePreview();
  clearSelectionBox();
  clearSnapGuides();
  refreshAll();
  if (nextMode === "3d") {
    editor3d.resize();
  } else {
    runtime.resize();
  }

  if (options.announce === false) {
    return;
  }

  if (nextMode === "3d") {
    setStatus("Editor 3D ativo. O modo JOGAR permanece no painel 2D.", "ok");
    return;
  }

  setStatus("Editor 2D ativo.", "ok");
}

function handleWindowResize() {
  runtime.resize();
  editor3d.resize();
}

function handleWorkspace3DShortcuts(event) {
  if (!isWorkspace3DActive() || isTyping(event.target)) {
    return;
  }

  const ctrlOrCmd = event.ctrlKey || event.metaKey;
  if (!ctrlOrCmd) {
    return;
  }

  const key = String(event.key || "").toLowerCase();
  if (key === "n" && !event.shiftKey) {
    event.preventDefault();
    editor3d.createScene?.();
    return;
  }

  if (key === "d" && event.shiftKey) {
    event.preventDefault();
    const duplicated = editor3d.duplicateSelection?.();
    if (!duplicated) {
      editor3d.duplicateScene?.();
    }
  }
}

function duplicateSelectionFromShortcut() {
  if (isWorkspace3DActive()) {
    editor3d.duplicateSelection?.();
    return;
  }
  duplicateSelection();
}

function deleteSelectionFromShortcut() {
  if (isWorkspace3DActive()) {
    editor3d.deleteSelection?.();
    return;
  }
  deleteSelection();
}

function syncActiveScene() {
  model.scene = getActiveScene(model.project);
  if (!model.scene && Array.isArray(model.project?.scenes) && model.project.scenes.length > 0) {
    model.project.activeSceneId = model.project.scenes[0].id;
    model.scene = model.project.scenes[0];
  }
}

function resetActiveSceneView() {
  syncActiveScene();
  rebuildTileMap(model.scene, model.state.tileMaps);
  model.state.wallCounter = syncWallCounter(model.scene);
  model.state.gameplayCounter = syncGameplayCounter(model.scene);
  syncSelectionState();
  clearPaintShapePreview();
  clearSelectionBox();
  clearSnapGuides();
}

function syncSelectionState(options = {}) {
  const refs = getSelectedRefs().filter((ref) => getObjectByRef(model.scene, ref));
  if (refs.length === 0) {
    if (options.allowEmpty) {
      model.state.selected = null;
      model.state.selectedRefs = [];
      return;
    }

    model.state.selected = { kind: "entity", id: "player" };
    model.state.selectedRefs = [{ kind: "entity", id: "player" }];
    return;
  }

  model.state.selectedRefs = refs.map((ref) => ({ ...ref }));
  model.state.selected = refs.some((ref) => sameRef(ref, model.state.selected)) ? { ...model.state.selected } : { ...refs[refs.length - 1] };
}

function getSelectedRefs() {
  const refs = Array.isArray(model.state.selectedRefs) ? model.state.selectedRefs : model.state.selected ? [model.state.selected] : [];
  const unique = [];
  refs.forEach((ref) => {
    if (!ref || unique.some((entry) => sameRef(entry, ref))) {
      return;
    }
    unique.push({ ...ref });
  });
  return unique;
}

function setSelectedRefs(refs, primaryRef = null) {
  const nextRefs = (Array.isArray(refs) ? refs : [])
    .filter(Boolean)
    .filter((ref, index, all) => all.findIndex((entry) => sameRef(entry, ref)) === index)
    .map((ref) => ({ ...ref }));

  if (nextRefs.length === 0) {
    model.state.selected = null;
    model.state.selectedRefs = [];
  } else {
    const nextPrimary = primaryRef && nextRefs.some((ref) => sameRef(ref, primaryRef)) ? primaryRef : nextRefs[nextRefs.length - 1];
    model.state.selected = { ...nextPrimary };
    model.state.selectedRefs = nextRefs;
  }

  clearSnapGuides();
  refreshList();
  refreshInspector();
  refreshSelectionActionButtons();
}

function getSelectionBounds(objects) {
  return getSelectionLayoutBounds(objects);
}

function getViewportPickOptions() {
  return {
    camera: model.state.cam,
    viewportRenderer: model.state.viewportRenderer,
    nativeCamera: ensureNativeCameraState(),
    viewport: {
      width: Math.max(1, canvas.width || canvas.clientWidth || 1),
      height: Math.max(1, canvas.height || canvas.clientHeight || 1)
    }
  };
}

function ensureNativeCameraState() {
  model.state.nativeCamera = createNativeCameraState(model.state.nativeCamera);
  return model.state.nativeCamera;
}

function getNativeViewportConfig() {
  return createNativePreviewConfig(
    model.scene,
    model.state.cam,
    {
      width: Math.max(1, canvas.width || canvas.clientWidth || 1),
      height: Math.max(1, canvas.height || canvas.clientHeight || 1)
    },
    ensureNativeCameraState()
  );
}

function getProjectedSelectionEntries(objects) {
  const items = (Array.isArray(objects) ? objects : []).filter(Boolean);
  if (model.state.viewportRenderer === "native-3d") {
    const config = getNativeViewportConfig();
    return items
      .map((object) => projectNativeRect(object, model.scene, config).rect)
      .filter(Boolean)
      .map((rect) => ({
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h
      }));
  }

  return items.map((object) => {
    const rect = projectSceneRect(object, model.state.cam, model.scene);
    return {
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h
    };
  });
}

function getProjectedSelectionBounds(objects) {
  return getSelectionLayoutBounds(getProjectedSelectionEntries(objects));
}

function getProjectedResizeEntries(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean);
  if (list.length === 0) {
    return [];
  }

  if (model.state.viewportRenderer === "native-3d") {
    const config = getNativeViewportConfig();
    return list
      .map((entry) => {
        const rect = projectNativeRect(entry, model.scene, config).rect;
        return rect
          ? {
              ...entry,
              x: rect.x,
              y: rect.y,
              w: rect.w,
              h: rect.h
            }
          : null;
      })
      .filter(Boolean);
  }

  return list.map((entry) => {
    const rect = projectSceneRect(entry, model.state.cam, model.scene);
    return {
      ...entry,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h
    };
  });
}

function scaleBoundsByHandle(bounds, scaleX, scaleY, handle, minSize = 8) {
  if (!bounds) {
    return null;
  }

  const nextWidth = Math.max(minSize, Math.round(bounds.w * scaleX));
  const nextHeight = Math.max(minSize, Math.round(bounds.h * scaleY));

  return {
    x: Math.round(handle.includes("w") ? bounds.x + bounds.w - nextWidth : bounds.x),
    y: Math.round(handle.includes("n") ? bounds.y + bounds.h - nextHeight : bounds.y),
    w: nextWidth,
    h: nextHeight
  };
}

function scaleEntriesToBounds(entries, nextBounds, minSize = 8) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean).map((entry) => ({ ...entry }));
  const bounds = getSelectionBounds(list);
  if (!bounds || !nextBounds) {
    return list;
  }

  return list.map((entry) => {
    const relLeft = (entry.x - bounds.x) / Math.max(1, bounds.w);
    const relTop = (entry.y - bounds.y) / Math.max(1, bounds.h);
    const relRight = (entry.x + entry.w - bounds.x) / Math.max(1, bounds.w);
    const relBottom = (entry.y + entry.h - bounds.y) / Math.max(1, bounds.h);

    const nextX = nextBounds.x + relLeft * nextBounds.w;
    const nextY = nextBounds.y + relTop * nextBounds.h;
    const nextRight = nextBounds.x + relRight * nextBounds.w;
    const nextBottom = nextBounds.y + relBottom * nextBounds.h;

    return {
      ...entry,
      x: Math.round(nextX),
      y: Math.round(nextY),
      w: Math.max(minSize, Math.round(nextRight - nextX)),
      h: Math.max(minSize, Math.round(nextBottom - nextY))
    };
  });
}

function mapMetaEntries(metaEntries) {
  return (Array.isArray(metaEntries) ? metaEntries : []).reduce((acc, entry) => {
    acc[String(entry.key || "")] = entry.value;
    return acc;
  }, {});
}

function buildTriggerActionsFromMeta(meta) {
  const actions = [];

  for (let index = 1; index <= 3; index += 1) {
    const type = String(meta[`action${index}Type`] || "none");
    if (type === "none") {
      continue;
    }

    actions.push({
      type,
      value: String(meta[`action${index}Value`] || ""),
      timelineId: String(meta[`action${index}TimelineId`] || meta[`action${index}Value`] || ""),
      sceneId: String(meta[`action${index}SceneId`] || ""),
      spawnTag: String(meta[`action${index}SpawnTag`] || ""),
      targetTag: String(meta[`action${index}TargetTag`] || ""),
      speaker: String(meta[`action${index}Speaker`] || ""),
      lines: [1, 2, 3].map((lineIndex) => String(meta[`action${index}Line${lineIndex}`] || "").trim()),
      x: Number.isFinite(Number(meta[`action${index}X`])) ? Math.round(Number(meta[`action${index}X`])) : 0,
      y: Number.isFinite(Number(meta[`action${index}Y`])) ? Math.round(Number(meta[`action${index}Y`])) : 0,
      duration: Math.max(0.05, Number.isFinite(Number(meta[`action${index}Duration`])) ? Number(meta[`action${index}Duration`]) : 0.6)
    });
  }

  return actions;
}

function syncLegacyTriggerFields(trigger) {
  const primaryAction =
    Array.isArray(trigger.actions) && trigger.actions.length > 0
      ? trigger.actions[0]
      : { type: "message", value: "", sceneId: "", spawnTag: "", targetTag: "", speaker: "", lines: ["", "", ""], x: 0, y: 0, duration: 0.6 };
  trigger.actionType = primaryAction.type;
  trigger.actionValue = primaryAction.value;
  trigger.actionSceneId = primaryAction.sceneId;
  trigger.actionSpawnTag = primaryAction.spawnTag;
  trigger.actionTargetTag = primaryAction.targetTag;
  trigger.actionTimelineId = String(primaryAction.timelineId || "");
  trigger.actionSpeaker = String(primaryAction.speaker || "");
  trigger.actionLines = Array.isArray(primaryAction.lines) ? primaryAction.lines.slice(0, 3) : ["", "", ""];
  trigger.actionX = Number.isFinite(Number(primaryAction.x)) ? Number(primaryAction.x) : 0;
  trigger.actionY = Number.isFinite(Number(primaryAction.y)) ? Number(primaryAction.y) : 0;
  trigger.actionDuration = Number.isFinite(Number(primaryAction.duration)) ? Number(primaryAction.duration) : 0.6;
}

function getMutableSelectedRefs() {
  return collectMutableSceneRefs(model.scene, getSelectedRefs());
}

function getSelectedObjects() {
  return getSelectedRefs().map((ref) => getObjectByRef(model.scene, ref)).filter(Boolean);
}

function resolvePaintTileId(tileId) {
  if (model.state.paintTool !== "random") {
    return tileId;
  }

  return resolveRandomPaintTileId(tileId, Math.random);
}

function normalizePaintBrushShape(shape) {
  return String(shape || "square").trim().toLowerCase() === "circle" ? "circle" : "square";
}

function normalizePaintLineThickness(value) {
  const numeric = Number.isFinite(Number(value)) ? Math.round(Number(value)) : 1;
  return Math.max(1, Math.min(8, numeric));
}

function describeBrushShape(shape) {
  return normalizePaintBrushShape(shape) === "circle" ? "(circulo)" : "(quadrado)";
}

function setSnapGuides(guides, ttl = 0.45) {
  model.state.snapGuides = {
    ttl,
    vertical: Array.isArray(guides?.vertical) ? guides.vertical.map((guide) => ({ ...guide })) : [],
    horizontal: Array.isArray(guides?.horizontal) ? guides.horizontal.map((guide) => ({ ...guide })) : []
  };
}

function clearSnapGuides() {
  model.state.snapGuides = {
    ttl: 0,
    vertical: [],
    horizontal: []
  };
}

function getSnapTargetObjects(ignoreRefs) {
  const ignoreSet = new Set((Array.isArray(ignoreRefs) ? ignoreRefs : []).map((ref) => `${ref.kind}:${ref.id}`));
  return [
    ...model.scene.walls.filter((wall) => !ignoreSet.has(`wall:${wall.id}`)),
    ...model.scene.gameObjects.filter((item) => !ignoreSet.has(`gameplayObject:${item.id}`)),
    ...(!ignoreSet.has("entity:player") ? [model.scene.player] : []),
    ...(!ignoreSet.has("entity:enemy") ? [model.scene.enemy] : [])
  ];
}

function applySavedPreferences() {
  const prefs = loadProjectEditorPrefs(model.project);
  if (!prefs || typeof prefs !== "object") {
    return;
  }

  const state = model.state;
  state.tool = typeof prefs.tool === "string" ? prefs.tool : state.tool;
  state.viewportRenderer = prefs.viewportRenderer === "native-3d" ? "native-3d" : state.viewportRenderer;
  state.paintTool = typeof prefs.paintTool === "string" ? prefs.paintTool : state.paintTool;
  state.paintBrushSize = Math.max(1, Math.min(8, Number.isFinite(Number(prefs.paintBrushSize)) ? Math.round(Number(prefs.paintBrushSize)) : state.paintBrushSize));
  state.paintBrushShape = normalizePaintBrushShape(prefs.paintBrushShape || state.paintBrushShape);
  state.paintLineThickness = normalizePaintLineThickness(prefs.paintLineThickness || state.paintLineThickness);
  state.autoTileEnabled = prefs.autoTileEnabled !== false;
  state.tileLayer = typeof prefs.tileLayer === "string" ? prefs.tileLayer : state.tileLayer;
  state.tileId = Number.isInteger(prefs.tileId) ? prefs.tileId : state.tileId;
  state.showGrid = prefs.showGrid !== false;
  state.showColliders = prefs.showColliders !== false;
  state.showLabels = prefs.showLabels !== false;
  state.editorZoomOverride = Number.isFinite(Number(prefs.editorZoomOverride)) ? Number(prefs.editorZoomOverride) : null;
  state.editorCameraManual =
    prefs.editorCameraManual && Number.isFinite(Number(prefs.editorCameraManual.x)) && Number.isFinite(Number(prefs.editorCameraManual.y))
      ? { x: Number(prefs.editorCameraManual.x), y: Number(prefs.editorCameraManual.y) }
      : null;
  state.nativeCamera = createNativeCameraState(prefs.nativeCamera);

  if (prefs.layerSettings && typeof prefs.layerSettings === "object") {
    Object.keys(TILE_LAYER_LABELS).forEach((layer) => {
      const current = prefs.layerSettings[layer];
      if (!current) {
        return;
      }

      state.layerSettings[layer] = {
        visible: current.visible !== false,
        locked: current.locked === true
      };
    });
  }
}

function persistEditorPrefs() {
  saveProjectEditorPrefs(model.project, {
    tool: model.state.tool,
    viewportRenderer: model.state.viewportRenderer,
    nativeCamera: ensureNativeCameraState(),
    paintTool: model.state.paintTool,
    paintBrushSize: model.state.paintBrushSize,
    paintBrushShape: normalizePaintBrushShape(model.state.paintBrushShape),
    paintLineThickness: normalizePaintLineThickness(model.state.paintLineThickness),
    autoTileEnabled: model.state.autoTileEnabled !== false,
    tileLayer: model.state.tileLayer,
    tileId: model.state.tileId,
    showGrid: model.state.showGrid !== false,
    showColliders: model.state.showColliders !== false,
    showLabels: model.state.showLabels !== false,
    editorZoomOverride: Number.isFinite(Number(model.state.editorZoomOverride)) ? Number(model.state.editorZoomOverride) : null,
    editorCameraManual:
      model.state.editorCameraManual && Number.isFinite(Number(model.state.editorCameraManual.x)) && Number.isFinite(Number(model.state.editorCameraManual.y))
        ? { x: Number(model.state.editorCameraManual.x), y: Number(model.state.editorCameraManual.y) }
        : null,
    layerSettings: model.state.layerSettings
  });
}

function setMode(mode) {
  const state = model.state;
  if (mode === state.mode) {
    return;
  }

  if (history.hasOpenTransaction()) {
    commitCommandGroup();
  }

  const using3DWorkspace = isWorkspace3DActive();

  if (mode === "play") {
    state.input = { up: false, down: false, left: false, right: false, run: false, interactQueued: false, pauseQueued: false };
    state.playSnapshot = clone(model.project);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    clearPaintShapePreview();
    clearSelectionBox();
    if (using3DWorkspace) {
      editor3d.enterPlayMode?.();
      setStatus(`Modo JOGAR 3D ativo na cena ${model.project.activeScene3DId}.`);
    } else {
      runtime.beginPlaySession();
      setStatus(`Modo JOGAR ativo na cena ${model.scene.name}.`);
    }
  } else {
    state.input = { up: false, down: false, left: false, right: false, run: false, interactQueued: false, pauseQueued: false };
    if (using3DWorkspace) {
      editor3d.exitPlayMode?.();
    } else {
      runtime.endPlaySession();
    }
    if (state.playSnapshot) {
      model.project = clone(state.playSnapshot);
      state.playSnapshot = null;
      resetActiveSceneView();
    }
    setStatus("Modo EDITAR ativo.");
  }

  state.mode = mode;
  refreshAll();
}

function switchSceneInPlay(sceneId) {
  const targetScene = getSceneById(model.project, sceneId);
  if (!targetScene) {
    return false;
  }

  if (sceneId === model.project.activeSceneId) {
    return true;
  }

  model.project.activeSceneId = sceneId;
  resetActiveSceneView();
  refreshAll();
  return true;
}

function setTool(tool, options = { announce: false }) {
  const state = model.state;
  if (state.mode !== "edit" && options.announce) {
    return;
  }

  state.tool = tool;
  if (tool !== "paint") {
    clearPaintShapePreview();
  }
  if (tool !== "select") {
    clearSelectionBox();
  }
  refreshToolLabel();

  ui.toolSelect.classList.toggle("active", tool === "select");
  ui.toolPaint.classList.toggle("active", tool === "paint");
  ui.toolWall.classList.toggle("active", tool === "addWall");
  persistEditorPrefs();

  if (!options.announce) {
    return;
  }

  if (tool === "addWall") setStatus("Ferramenta + Parede ativa.");
  if (tool === "paint") {
    setStatus(
      `Pintura de tiles ativa com ${PAINT_TOOL_LABELS[state.paintTool]} na camada ${describeLayerForStatus(state.tileLayer)} (pincel ${state.paintBrushSize}x${state.paintBrushSize} ${describeBrushShape(state.paintBrushShape)}, linha ${normalizePaintLineThickness(state.paintLineThickness)}, autotile ${state.autoTileEnabled !== false ? "ligado" : "desligado"}).`
    );
  }
  if (tool === "select") setStatus("Ferramenta Selecionar ativa.");
}

function setPaintTool(paintTool, options = { announce: false }) {
  const state = model.state;
  state.paintTool = paintTool;
  if (paintTool !== "rect" && paintTool !== "line") {
    clearPaintShapePreview();
  }

  ui.paintToolBrush.classList.toggle("active", paintTool === "brush");
  ui.paintToolRandom.classList.toggle("active", paintTool === "random");
  ui.paintToolLine.classList.toggle("active", paintTool === "line");
  ui.paintToolRect.classList.toggle("active", paintTool === "rect");
  ui.paintToolFill.classList.toggle("active", paintTool === "fill");
  ui.paintToolEyedropper.classList.toggle("active", paintTool === "eyedropper");
  refreshToolLabel();
  persistEditorPrefs();

  if (!options.announce || state.tool !== "paint") {
    return;
  }

  setStatus(
    `Ferramenta de pintura: ${PAINT_TOOL_LABELS[paintTool]} (pincel ${state.paintBrushSize}x${state.paintBrushSize} ${describeBrushShape(state.paintBrushShape)}, linha ${normalizePaintLineThickness(state.paintLineThickness)}, autotile ${state.autoTileEnabled !== false ? "ligado" : "desligado"}).`,
    "ok"
  );
}

function refreshToolLabel() {
  const state = model.state;
  if (isWorkspace3DActive()) {
    ui.tool.textContent = "Ferramenta: Editor 3D / Alt+arraste orbita / Meio arrasta / Roda zoom";
    return;
  }

  const spaceLabel = SCENE_SPACE_LABELS[normalizeSceneSpaceMode(model.scene?.space?.mode)] || "2D";
  const rendererLabel = VIEWPORT_RENDERER_LABELS[state.viewportRenderer] || VIEWPORT_RENDERER_LABELS.scene;
  if (state.tool === "paint") {
    ui.tool.textContent = `Ferramenta: Pintar / ${PAINT_TOOL_LABELS[state.paintTool]} (${describeLayerForStatus(state.tileLayer)}, ${state.paintBrushSize}x${state.paintBrushSize} ${describeBrushShape(state.paintBrushShape)}, linha ${normalizePaintLineThickness(state.paintLineThickness)}, autotile ${state.autoTileEnabled !== false ? "ligado" : "desligado"}) / ${spaceLabel} / ${rendererLabel}`;
    return;
  }

  ui.tool.textContent = `Ferramenta: ${state.tool === "addWall" ? "+ Parede" : "Selecionar"} / ${spaceLabel} / ${rendererLabel}`;
}

function handleSpaceModeChange() {
  const nextMode = normalizeSceneSpaceMode(ui.spaceModeSelect.value);
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para trocar a visualizacao.", "danger");
    ui.spaceModeSelect.value = normalizeSceneSpaceMode(model.scene?.space?.mode);
    return;
  }

  if (normalizeSceneSpaceMode(model.scene?.space?.mode) === nextMode) {
    return;
  }

  runCommand("Espaco da Visualizacao", () => {
    model.scene.space = {
      upAxis: "y",
      forwardAxis: "z",
      ...(model.scene.space || {}),
      mode: nextMode
    };
  });

  refreshAll();
  setStatus(`Visualizacao em ${SCENE_SPACE_LABELS[nextMode] || nextMode}.`, "ok");
}

function handleViewportRendererChange() {
  const nextRenderer = ui.viewportRendererSelect.value === "native-3d" ? "native-3d" : "scene";
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para trocar o renderizador da visualizacao.", "danger");
    ui.viewportRendererSelect.value = model.state.viewportRenderer;
    return;
  }

  if (model.state.viewportRenderer === nextRenderer) {
    return;
  }

  model.state.viewportRenderer = nextRenderer;
  clearSelectionBox();
  clearSnapGuides();
  refreshAll();
  persistEditorPrefs();
  const suffix =
    nextRenderer === "native-3d"
      ? " Use Alt+arraste para orbitar, botao do meio para deslocar e a roda para aproximar ou afastar."
      : " Use botao do meio para arrastar o cenario e a roda do mouse para zoom.";
  setStatus(`Visualizacao principal em ${VIEWPORT_RENDERER_LABELS[nextRenderer] || nextRenderer}.${suffix}`, "ok");
}

function resetNativeViewportCamera(options = {}) {
  model.state.nativeCamera = createNativeCameraState();
  if (!options.skipPersist) {
    persistEditorPrefs();
  }
  if (options.announce !== false) {
    setStatus("Camera do 3D Nativo resetada.", "ok");
  }
  refreshAll();
}

function orbitNativeViewport(deltaYaw, deltaPitch) {
  const camera = ensureNativeCameraState();
  camera.yaw += deltaYaw;
  camera.pitch = clamp(camera.pitch + deltaPitch, 0.18, Math.PI / 2.25);
}

function panNativeViewport(deltaX, deltaY) {
  const camera = ensureNativeCameraState();
  const config = getNativeViewportConfig();
  camera.focusX = (camera.focusX ?? config.focusX) + deltaX;
  camera.focusY = (camera.focusY ?? config.focusY) + deltaY;
}

function zoomNativeViewport(multiplier) {
  const camera = ensureNativeCameraState();
  camera.zoom = clamp(camera.zoom * multiplier, 0.45, 2.4);
}

function commitNativeViewportCamera() {
  persistEditorPrefs();
  refreshAll();
}

function resolveEditorZoom() {
  const overrideZoom = Number(model.state.editorZoomOverride);
  if (Number.isFinite(overrideZoom)) {
    return Math.max(0.35, Math.min(3, overrideZoom));
  }
  const sceneZoom = Number(model.scene?.camera2D?.zoom);
  return Math.max(0.35, Math.min(3, Number.isFinite(sceneZoom) ? sceneZoom : 1));
}

function panSceneViewport(deltaX, deltaY) {
  if (model.state.mode !== "edit") {
    return;
  }

  const currentCenter = model.state.editorCameraManual && Number.isFinite(Number(model.state.editorCameraManual.x)) && Number.isFinite(Number(model.state.editorCameraManual.y))
    ? { x: Number(model.state.editorCameraManual.x), y: Number(model.state.editorCameraManual.y) }
    : { x: model.state.cam.x + model.state.cam.w * 0.5, y: model.state.cam.y + model.state.cam.h * 0.5 };

  model.state.editorCameraManual = {
    x: currentCenter.x + deltaX,
    y: currentCenter.y + deltaY
  };
}

function zoomSceneViewport(multiplier, pointer) {
  if (model.state.mode !== "edit") {
    return;
  }

  const currentZoom = resolveEditorZoom();
  const nextZoom = Math.max(0.35, Math.min(3, currentZoom * multiplier));
  if (Math.abs(nextZoom - currentZoom) < 0.0001) {
    return;
  }

  model.state.editorZoomOverride = nextZoom;

  const hasAnchor = pointer && pointer.world && Number.isFinite(Number(pointer.world.x)) && Number.isFinite(Number(pointer.world.y));
  if (!hasAnchor) {
    return;
  }

  const rawLocal = pointer.rawLocal && Number.isFinite(Number(pointer.rawLocal.x)) && Number.isFinite(Number(pointer.rawLocal.y))
    ? pointer.rawLocal
    : {
        x: Number(pointer.local?.x || 0) * currentZoom,
        y: Number(pointer.local?.y || 0) * currentZoom
      };

  const nextCamW = Math.max(1, canvas.width / nextZoom);
  const nextCamH = Math.max(1, canvas.height / nextZoom);
  const nextCamX = Number(pointer.world.x) - rawLocal.x / nextZoom;
  const nextCamY = Number(pointer.world.y) - rawLocal.y / nextZoom;
  model.state.editorCameraManual = {
    x: nextCamX + nextCamW * 0.5,
    y: nextCamY + nextCamH * 0.5
  };
}

function panActiveViewport(deltaX, deltaY) {
  if (model.state.viewportRenderer === "native-3d") {
    panNativeViewport(deltaX, deltaY);
    return;
  }
  panSceneViewport(deltaX, deltaY);
}

function zoomActiveViewport(multiplier, pointer) {
  if (model.state.viewportRenderer === "native-3d") {
    zoomNativeViewport(multiplier);
    return;
  }
  zoomSceneViewport(multiplier, pointer);
}

function commitViewportNavigation() {
  if (model.state.viewportRenderer === "native-3d") {
    commitNativeViewportCamera();
    return;
  }
  persistEditorPrefs();
}

function ensureScenePhysicsState() {
  if (!model.scene.physics || typeof model.scene.physics !== "object") {
    model.scene.physics = {};
  }

  const sourceFriction = model.scene.physics.surfaceFriction && typeof model.scene.physics.surfaceFriction === "object"
    ? model.scene.physics.surfaceFriction
    : {};
  const defaults = {
    default: 0.22,
    grass: 0.28,
    stone: 0.16,
    sand: 0.56,
    water: 0.86,
    lava: 0.94
  };
  const surfaceFriction = SURFACE_MATERIAL_IDS.reduce((acc, materialId) => {
    const fallback = defaults[materialId];
    const value = Number.isFinite(Number(sourceFriction[materialId])) ? Number(sourceFriction[materialId]) : fallback;
    acc[materialId] = Math.max(0, Math.min(2, value));
    return acc;
  }, {});

  model.scene.physics = {
    compositeCollider: model.scene.physics.compositeCollider !== false,
    pixelPerfect: model.scene.physics.pixelPerfect === true,
    pixelScale: Math.max(1, Number.isFinite(Number(model.scene.physics.pixelScale)) ? Math.round(Number(model.scene.physics.pixelScale)) : 1),
    surfaceFriction
  };
  model.scene.sortingY = model.scene.sortingY === true;

  return model.scene.physics;
}

function refreshScenePhysicsPanel() {
  const physics = ensureScenePhysicsState();
  ui.sceneCompositeCollider.checked = physics.compositeCollider !== false;
  ui.scenePixelPerfect.checked = physics.pixelPerfect === true;
  ui.scenePixelScale.value = String(physics.pixelScale);
  ui.sceneSurfaceFrictionDefault.value = String(physics.surfaceFriction.default);
  ui.sceneSurfaceFrictionGrass.value = String(physics.surfaceFriction.grass);
  ui.sceneSurfaceFrictionStone.value = String(physics.surfaceFriction.stone);
  ui.sceneSurfaceFrictionSand.value = String(physics.surfaceFriction.sand);
  ui.sceneSurfaceFrictionWater.value = String(physics.surfaceFriction.water);
  ui.sceneSurfaceFrictionLava.value = String(physics.surfaceFriction.lava);
  ui.sceneSortByY.checked = model.scene.sortingY === true;
}

function commitScenePhysicsInputs() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar a configuracao 2D.", "danger");
    refreshScenePhysicsPanel();
    return;
  }

  const current = ensureScenePhysicsState();
  const nextPhysics = {
    compositeCollider: ui.sceneCompositeCollider.checked === true,
    pixelPerfect: ui.scenePixelPerfect.checked === true,
    pixelScale: Math.max(1, Number.isFinite(Number(ui.scenePixelScale.value)) ? Math.round(Number(ui.scenePixelScale.value)) : 1),
    surfaceFriction: {
      default: Math.max(0, Math.min(2, Number.isFinite(Number(ui.sceneSurfaceFrictionDefault.value)) ? Number(ui.sceneSurfaceFrictionDefault.value) : current.surfaceFriction.default)),
      grass: Math.max(0, Math.min(2, Number.isFinite(Number(ui.sceneSurfaceFrictionGrass.value)) ? Number(ui.sceneSurfaceFrictionGrass.value) : current.surfaceFriction.grass)),
      stone: Math.max(0, Math.min(2, Number.isFinite(Number(ui.sceneSurfaceFrictionStone.value)) ? Number(ui.sceneSurfaceFrictionStone.value) : current.surfaceFriction.stone)),
      sand: Math.max(0, Math.min(2, Number.isFinite(Number(ui.sceneSurfaceFrictionSand.value)) ? Number(ui.sceneSurfaceFrictionSand.value) : current.surfaceFriction.sand)),
      water: Math.max(0, Math.min(2, Number.isFinite(Number(ui.sceneSurfaceFrictionWater.value)) ? Number(ui.sceneSurfaceFrictionWater.value) : current.surfaceFriction.water)),
      lava: Math.max(0, Math.min(2, Number.isFinite(Number(ui.sceneSurfaceFrictionLava.value)) ? Number(ui.sceneSurfaceFrictionLava.value) : current.surfaceFriction.lava))
    }
  };
  const nextSortingY = ui.sceneSortByY.checked === true;

  ui.scenePixelScale.value = String(nextPhysics.pixelScale);
  ui.sceneSurfaceFrictionDefault.value = String(nextPhysics.surfaceFriction.default);
  ui.sceneSurfaceFrictionGrass.value = String(nextPhysics.surfaceFriction.grass);
  ui.sceneSurfaceFrictionStone.value = String(nextPhysics.surfaceFriction.stone);
  ui.sceneSurfaceFrictionSand.value = String(nextPhysics.surfaceFriction.sand);
  ui.sceneSurfaceFrictionWater.value = String(nextPhysics.surfaceFriction.water);
  ui.sceneSurfaceFrictionLava.value = String(nextPhysics.surfaceFriction.lava);

  if (
    current.compositeCollider === nextPhysics.compositeCollider
    && current.pixelPerfect === nextPhysics.pixelPerfect
    && current.pixelScale === nextPhysics.pixelScale
    && JSON.stringify(current.surfaceFriction) === JSON.stringify(nextPhysics.surfaceFriction)
    && model.scene.sortingY === nextSortingY
  ) {
    return;
  }

  runCommand("Config 2D da Cena", () => {
    model.scene.physics = { ...nextPhysics };
    model.scene.sortingY = nextSortingY;
  });

  refreshScenePhysicsPanel();
  exportJson(false);
  setStatus(
    `Config 2D atualizada: Composite ${nextPhysics.compositeCollider ? "ligado" : "desligado"}, Pixel Perfect ${nextPhysics.pixelPerfect ? `ligado x${nextPhysics.pixelScale}` : "desligado"}, Sorting Y ${nextSortingY ? "ligado" : "desligado"}, Atrito por superficie atualizado.`,
    "ok"
  );
}

function ensureSceneCameraState() {
  if (!model.scene.camera2D || typeof model.scene.camera2D !== "object") {
    model.scene.camera2D = {};
  }

  const camera = model.scene.camera2D;
  model.scene.camera2D = {
    mode: String(camera.mode || "follow") === "snap" ? "snap" : "follow",
    damping: Math.max(0.01, Number.isFinite(Number(camera.damping)) ? Number(camera.damping) : 0.16),
    deadZoneW: Math.max(0, Number.isFinite(Number(camera.deadZoneW)) ? Number(camera.deadZoneW) : 220),
    deadZoneH: Math.max(0, Number.isFinite(Number(camera.deadZoneH)) ? Number(camera.deadZoneH) : 132),
    lookAheadX: Number.isFinite(Number(camera.lookAheadX)) ? Number(camera.lookAheadX) : 24,
    lookAheadY: Number.isFinite(Number(camera.lookAheadY)) ? Number(camera.lookAheadY) : 16,
    confineToWorld: camera.confineToWorld !== false,
    zoom: Math.max(0.35, Math.min(3, Number.isFinite(Number(camera.zoom)) ? Number(camera.zoom) : 1)),
    followDuringEdit: camera.followDuringEdit !== false,
    shakeEnabled: camera.shakeEnabled !== false,
    shakeIntensity: Math.max(0, Number.isFinite(Number(camera.shakeIntensity)) ? Number(camera.shakeIntensity) : 12),
    shakeDuration: Math.max(0.01, Number.isFinite(Number(camera.shakeDuration)) ? Number(camera.shakeDuration) : 0.28),
    shakeFrequency: Math.max(1, Number.isFinite(Number(camera.shakeFrequency)) ? Number(camera.shakeFrequency) : 32)
  };
  return model.scene.camera2D;
}

function refreshSceneCameraPanel() {
  const camera = ensureSceneCameraState();
  ui.sceneCameraMode.value = camera.mode;
  ui.sceneCameraDamping.value = String(camera.damping);
  ui.sceneCameraDeadZoneW.value = String(Math.round(camera.deadZoneW));
  ui.sceneCameraDeadZoneH.value = String(Math.round(camera.deadZoneH));
  ui.sceneCameraLookAheadX.value = String(Math.round(camera.lookAheadX));
  ui.sceneCameraLookAheadY.value = String(Math.round(camera.lookAheadY));
  ui.sceneCameraZoom.value = String(camera.zoom);
  ui.sceneCameraConfine.checked = camera.confineToWorld === true;
  ui.sceneCameraFollowEdit.checked = camera.followDuringEdit === true;
  ui.sceneCameraShakeEnabled.checked = camera.shakeEnabled !== false;
  ui.sceneCameraShakeIntensity.value = String(camera.shakeIntensity);
  ui.sceneCameraShakeDuration.value = String(camera.shakeDuration);
  ui.sceneCameraShakeFrequency.value = String(camera.shakeFrequency);
}

function commitSceneCameraInputs() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar a camera 2D.", "danger");
    refreshSceneCameraPanel();
    return;
  }

  const current = ensureSceneCameraState();
  const nextCamera = {
    mode: ui.sceneCameraMode.value === "snap" ? "snap" : "follow",
    damping: Math.max(0.01, Number.isFinite(Number(ui.sceneCameraDamping.value)) ? Number(ui.sceneCameraDamping.value) : 0.16),
    deadZoneW: Math.max(0, Number.isFinite(Number(ui.sceneCameraDeadZoneW.value)) ? Number(ui.sceneCameraDeadZoneW.value) : 220),
    deadZoneH: Math.max(0, Number.isFinite(Number(ui.sceneCameraDeadZoneH.value)) ? Number(ui.sceneCameraDeadZoneH.value) : 132),
    lookAheadX: Number.isFinite(Number(ui.sceneCameraLookAheadX.value)) ? Number(ui.sceneCameraLookAheadX.value) : 24,
    lookAheadY: Number.isFinite(Number(ui.sceneCameraLookAheadY.value)) ? Number(ui.sceneCameraLookAheadY.value) : 16,
    confineToWorld: ui.sceneCameraConfine.checked === true,
    zoom: Math.max(0.35, Math.min(3, Number.isFinite(Number(ui.sceneCameraZoom.value)) ? Number(ui.sceneCameraZoom.value) : 1)),
    followDuringEdit: ui.sceneCameraFollowEdit.checked === true,
    shakeEnabled: ui.sceneCameraShakeEnabled.checked === true,
    shakeIntensity: Math.max(0, Number.isFinite(Number(ui.sceneCameraShakeIntensity.value)) ? Number(ui.sceneCameraShakeIntensity.value) : 12),
    shakeDuration: Math.max(0.01, Number.isFinite(Number(ui.sceneCameraShakeDuration.value)) ? Number(ui.sceneCameraShakeDuration.value) : 0.28),
    shakeFrequency: Math.max(1, Number.isFinite(Number(ui.sceneCameraShakeFrequency.value)) ? Number(ui.sceneCameraShakeFrequency.value) : 32)
  };

  ui.sceneCameraShakeIntensity.value = String(nextCamera.shakeIntensity);
  ui.sceneCameraShakeDuration.value = String(nextCamera.shakeDuration);
  ui.sceneCameraShakeFrequency.value = String(nextCamera.shakeFrequency);

  if (JSON.stringify(current) === JSON.stringify(nextCamera)) {
    return;
  }

  runCommand("Camera 2D", () => {
    model.scene.camera2D = { ...nextCamera };
  });

  refreshSceneCameraPanel();
  exportJson(false);
  setStatus(`Camera 2D atualizada (${nextCamera.mode}, zoom ${nextCamera.zoom.toFixed(2)}).`, "ok");
}

function ensureSceneLightingState() {
  if (!model.scene.lighting2D || typeof model.scene.lighting2D !== "object") {
    model.scene.lighting2D = {};
  }

  const lighting = model.scene.lighting2D;
  model.scene.lighting2D = {
    enabled: lighting.enabled === true,
    ambientColor: String(lighting.ambientColor || "#0b1220"),
    ambientAlpha: Math.max(0, Math.min(1, Number.isFinite(Number(lighting.ambientAlpha)) ? Number(lighting.ambientAlpha) : 0.58)),
    shadowLength: Math.max(20, Number.isFinite(Number(lighting.shadowLength)) ? Number(lighting.shadowLength) : 110),
    shadowAlpha: Math.max(0, Math.min(1, Number.isFinite(Number(lighting.shadowAlpha)) ? Number(lighting.shadowAlpha) : 0.36))
  };
  return model.scene.lighting2D;
}

function refreshSceneLightingPanel() {
  const lighting = ensureSceneLightingState();
  ui.sceneLightingEnabled.checked = lighting.enabled === true;
  ui.sceneLightingAmbientColor.value = String(lighting.ambientColor || "#0b1220");
  ui.sceneLightingAmbientAlpha.value = String(lighting.ambientAlpha);
  ui.sceneLightingShadowLength.value = String(Math.round(lighting.shadowLength));
  ui.sceneLightingShadowAlpha.value = String(lighting.shadowAlpha);
}

function commitSceneLightingInputs() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar a luz 2D.", "danger");
    refreshSceneLightingPanel();
    return;
  }

  const current = ensureSceneLightingState();
  const nextLighting = {
    enabled: ui.sceneLightingEnabled.checked === true,
    ambientColor: String(ui.sceneLightingAmbientColor.value || "#0b1220").trim() || "#0b1220",
    ambientAlpha: Math.max(0, Math.min(1, Number.isFinite(Number(ui.sceneLightingAmbientAlpha.value)) ? Number(ui.sceneLightingAmbientAlpha.value) : 0.58)),
    shadowLength: Math.max(20, Number.isFinite(Number(ui.sceneLightingShadowLength.value)) ? Number(ui.sceneLightingShadowLength.value) : 110),
    shadowAlpha: Math.max(0, Math.min(1, Number.isFinite(Number(ui.sceneLightingShadowAlpha.value)) ? Number(ui.sceneLightingShadowAlpha.value) : 0.36))
  };

  if (JSON.stringify(current) === JSON.stringify(nextLighting)) {
    return;
  }

  runCommand("Luz 2D", () => {
    model.scene.lighting2D = { ...nextLighting };
  });

  refreshSceneLightingPanel();
  exportJson(false);
  setStatus(`Luz 2D ${nextLighting.enabled ? "ativada" : "desativada"}.`, "ok");
}

function ensureSceneUiState() {
  if (!model.scene.ui2D || typeof model.scene.ui2D !== "object") {
    model.scene.ui2D = {};
  }

  const ui2D = model.scene.ui2D;
  model.scene.ui2D = {
    showHud: ui2D.showHud !== false,
    showHints: ui2D.showHints !== false,
    showPauseOverlay: ui2D.showPauseOverlay !== false
  };
  return model.scene.ui2D;
}

function refreshSceneUiPanel() {
  const ui2D = ensureSceneUiState();
  ui.sceneUiShowHud.checked = ui2D.showHud !== false;
  ui.sceneUiShowHints.checked = ui2D.showHints !== false;
  ui.sceneUiShowPauseOverlay.checked = ui2D.showPauseOverlay !== false;
}

function commitSceneUiInputs() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar a UI runtime.", "danger");
    refreshSceneUiPanel();
    return;
  }

  const current = ensureSceneUiState();
  const nextUi2D = {
    showHud: ui.sceneUiShowHud.checked === true,
    showHints: ui.sceneUiShowHints.checked === true,
    showPauseOverlay: ui.sceneUiShowPauseOverlay.checked === true
  };

  if (JSON.stringify(current) === JSON.stringify(nextUi2D)) {
    return;
  }

  runCommand("UI Runtime 2D", () => {
    model.scene.ui2D = { ...nextUi2D };
  });

  refreshSceneUiPanel();
  exportJson(false);
  setStatus("UI runtime 2D atualizada.", "ok");
}

function ensureSceneAudioState() {
  if (!model.scene.audio2D || typeof model.scene.audio2D !== "object") {
    model.scene.audio2D = {};
  }

  const audio = model.scene.audio2D;
  model.scene.audio2D = {
    enabled: audio.enabled !== false,
    masterVolume: clamp01(audio.masterVolume, 0.85),
    sfxVolume: clamp01(audio.sfxVolume, 0.9),
    musicVolume: clamp01(audio.musicVolume, 0)
  };
  return model.scene.audio2D;
}

function refreshSceneAudioPanel() {
  const audio = ensureSceneAudioState();
  ui.sceneAudioEnabled.checked = audio.enabled !== false;
  ui.sceneAudioMasterVolume.value = String(audio.masterVolume);
  ui.sceneAudioSfxVolume.value = String(audio.sfxVolume);
  ui.sceneAudioMusicVolume.value = String(audio.musicVolume);
}

function commitSceneAudioInputs() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar o audio runtime.", "danger");
    refreshSceneAudioPanel();
    return;
  }

  const current = ensureSceneAudioState();
  const nextAudio = {
    enabled: ui.sceneAudioEnabled.checked === true,
    masterVolume: clamp01(ui.sceneAudioMasterVolume.value, current.masterVolume),
    sfxVolume: clamp01(ui.sceneAudioSfxVolume.value, current.sfxVolume),
    musicVolume: clamp01(ui.sceneAudioMusicVolume.value, current.musicVolume)
  };

  ui.sceneAudioMasterVolume.value = String(nextAudio.masterVolume);
  ui.sceneAudioSfxVolume.value = String(nextAudio.sfxVolume);
  ui.sceneAudioMusicVolume.value = String(nextAudio.musicVolume);

  if (JSON.stringify(current) === JSON.stringify(nextAudio)) {
    return;
  }

  runCommand("Audio Runtime 2D", () => {
    model.scene.audio2D = { ...nextAudio };
  });

  refreshSceneAudioPanel();
  exportJson(false);
  setStatus(`Audio runtime 2D ${nextAudio.enabled ? "ativado" : "desativado"}.`, "ok");
}

function handlePaintBrushSizeChange() {
  const nextSize = Math.max(1, Math.min(8, Number.isFinite(Number(ui.paintBrushSize.value)) ? Math.round(Number(ui.paintBrushSize.value)) : 1));
  model.state.paintBrushSize = nextSize;
  ui.paintBrushSize.value = String(nextSize);
  refreshToolLabel();
  persistEditorPrefs();
}

function handlePaintBrushShapeChange() {
  const nextShape = normalizePaintBrushShape(ui.paintBrushShape.value);
  model.state.paintBrushShape = nextShape;
  ui.paintBrushShape.value = nextShape;
  refreshToolLabel();
  persistEditorPrefs();
}

function handlePaintLineThicknessChange() {
  const nextThickness = normalizePaintLineThickness(ui.paintLineThickness.value);
  model.state.paintLineThickness = nextThickness;
  ui.paintLineThickness.value = String(nextThickness);
  refreshToolLabel();
  persistEditorPrefs();
}

function handlePaintAutoTileChange() {
  model.state.autoTileEnabled = ui.paintAutoTile.checked !== false;
  refreshToolLabel();
  persistEditorPrefs();
}

function commitEditorVisualInputs() {
  model.state.showGrid = ui.viewShowGrid.checked !== false;
  model.state.showColliders = ui.viewShowColliders.checked !== false;
  model.state.showLabels = ui.viewShowLabels.checked !== false;
  persistEditorPrefs();
  refreshToolLabel();
}

function handleTileLayerChange() {
  const nextLayer = ui.tileLayerSelect.value;
  if (!TILE_LAYER_LABELS[nextLayer]) {
    ui.tileLayerSelect.value = model.state.tileLayer;
    return;
  }

  model.state.tileLayer = nextLayer;
  refreshToolLabel();
  refreshLayerControls();
  persistEditorPrefs();

  const settings = getLayerSettings(nextLayer);
  const stateInfo = [];
  if (!settings.visible) stateInfo.push("oculta");
  if (settings.locked) stateInfo.push("bloqueada");
  const suffix = stateInfo.length ? ` (${stateInfo.join(", ")})` : "";
  setStatus(`Camada ativa: ${TILE_LAYER_LABELS[nextLayer]}${suffix}.`, "ok");
}

function resetLayerControls() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para resetar camadas.", "danger");
    return;
  }

  runCommand("Resetar Camadas", () => {
    const settings = ensureLayerSettingsState();
    Object.keys(TILE_LAYER_LABELS).forEach((layer) => {
      settings[layer] = { visible: true, locked: false };
    });
    model.state.tileLayer = "gameplay";
    ui.tileLayerSelect.value = "gameplay";
  });

  refreshToolLabel();
  refreshLayerControls();
  persistEditorPrefs();
  setStatus("Camadas resetadas: todas visiveis, livres e camada ativa em Jogabilidade.", "ok");
}

function ensureLayerSettingsState() {
  const state = model.state;
  if (!state.layerSettings || typeof state.layerSettings !== "object") {
    state.layerSettings = {};
  }

  Object.keys(TILE_LAYER_LABELS).forEach((layer) => {
    const current = state.layerSettings[layer];
    state.layerSettings[layer] = {
      visible: current ? current.visible !== false : true,
      locked: current ? current.locked === true : false
    };
  });

  return state.layerSettings;
}

function getLayerSettings(layer) {
  const settings = ensureLayerSettingsState();
  return settings[layer] || { visible: true, locked: false };
}

function describeLayerForStatus(layer) {
  const label = TILE_LAYER_LABELS[layer] || layer;
  const settings = getLayerSettings(layer);
  const flags = [];
  if (!settings.visible) flags.push("oculta");
  if (settings.locked) flags.push("bloqueada");
  return flags.length ? `${label} - ${flags.join("/")}` : label;
}

function canEditActiveLayer() {
  const layer = model.state.tileLayer;
  const settings = getLayerSettings(layer);

  if (settings.locked) {
    setStatus(`A camada ${TILE_LAYER_LABELS[layer]} esta bloqueada.`, "danger");
    return false;
  }

  if (!settings.visible) {
    setStatus(`A camada ${TILE_LAYER_LABELS[layer]} esta oculta. Ative a visibilidade para editar.`, "danger");
    return false;
  }

  return true;
}

function buildLayerControls() {
  ui.layerControls.innerHTML = "";

  Object.keys(TILE_LAYER_LABELS).forEach((layer) => {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.dataset.layer = layer;
    row.innerHTML = `
      <button type="button" class="layer-select" data-action="select" data-layer="${layer}">${TILE_LAYER_LABELS[layer]}</button>
      <button type="button" class="layer-toggle" data-action="visibility" data-layer="${layer}">Visivel</button>
      <button type="button" class="layer-toggle" data-action="lock" data-layer="${layer}">Livre</button>
    `;
    ui.layerControls.appendChild(row);
  });

  refreshLayerControls();
}

function refreshLayerControls() {
  ensureLayerSettingsState();

  const isEditMode = model.state.mode === "edit";
  const rows = Array.from(ui.layerControls.querySelectorAll(".layer-row"));

  rows.forEach((row) => {
    const layer = row.dataset.layer;
    const settings = getLayerSettings(layer);
    row.classList.toggle("active", model.state.tileLayer === layer);
    row.classList.toggle("hidden", !settings.visible);
    row.classList.toggle("locked", settings.locked);

    const selectButton = row.querySelector('[data-action="select"]');
    const visibilityButton = row.querySelector('[data-action="visibility"]');
    const lockButton = row.querySelector('[data-action="lock"]');

    visibilityButton.textContent = settings.visible ? "Visivel" : "Oculta";
    visibilityButton.classList.toggle("off", !settings.visible);
    lockButton.textContent = settings.locked ? "Bloqueada" : "Livre";
    lockButton.classList.toggle("off", !settings.locked);

    selectButton.disabled = !isEditMode;
    visibilityButton.disabled = !isEditMode;
    lockButton.disabled = !isEditMode;
  });
}

function handleLayerControlsClick(event) {
  const button = event.target.closest("button[data-action][data-layer]");
  if (!button) {
    return;
  }

  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar camadas.", "danger");
    return;
  }

  const layer = button.dataset.layer;
  const action = button.dataset.action;
  if (!TILE_LAYER_LABELS[layer]) {
    return;
  }

  if (action === "select") {
    model.state.tileLayer = layer;
    ui.tileLayerSelect.value = layer;
    refreshToolLabel();
    refreshLayerControls();
    persistEditorPrefs();
    setStatus(`Camada ativa: ${describeLayerForStatus(layer)}.`, "ok");
    return;
  }

  const settings = getLayerSettings(layer);

  if (action === "visibility") {
    settings.visible = !settings.visible;
    setStatus(`Visibilidade da camada ${TILE_LAYER_LABELS[layer]}: ${settings.visible ? "ligada" : "desligada"}.`, settings.visible ? "ok" : "danger");
  }

  if (action === "lock") {
    settings.locked = !settings.locked;
    setStatus(`Bloqueio da camada ${TILE_LAYER_LABELS[layer]}: ${settings.locked ? "ligado" : "desligado"}.`, settings.locked ? "danger" : "ok");
  }

  refreshToolLabel();
  refreshLayerControls();
  persistEditorPrefs();
}

function buildVariableTemplates() {
  ui.variableTemplateList.innerHTML = VARIABLE_TEMPLATE_DEFS.map(
    (template) => `
      <button type="button" class="btn btn-tool variable-template-btn" data-template-id="${template.id}" title="${safe(template.description)}">
        ${safe(template.label)}
        <small>${safe(template.description)}</small>
      </button>
    `
  ).join("");

  refreshVariableTemplates();
}

function refreshVariableTemplates() {
  const disabled = model.state.mode !== "edit";
  Array.from(ui.variableTemplateList.querySelectorAll("[data-template-id]")).forEach((button) => {
    button.disabled = disabled;
  });
}

function ensureVariableStores() {
  if (!model.project.variables || typeof model.project.variables !== "object" || Array.isArray(model.project.variables)) {
    model.project.variables = {};
  }

  model.project.variableMeta = sanitizeVariableMeta(model.project.variableMeta, model.project.variables);

  if (!model.scene.variables || typeof model.scene.variables !== "object" || Array.isArray(model.scene.variables)) {
    model.scene.variables = {};
  }

  model.scene.variableMeta = sanitizeVariableMeta(model.scene.variableMeta, model.scene.variables);
}

function getVariableScope() {
  return ui.variableScopeSelect.value === "project" ? "project" : "scene";
}

function getVariableTarget(scope = getVariableScope()) {
  ensureVariableStores();
  return scope === "project" ? model.project : model.scene;
}

function buildVariableTypeOptionsHtml(selectedType) {
  return Object.entries(VARIABLE_TYPE_LABELS)
    .map(([type, label]) => `<option value="${type}" ${selectedType === type ? "selected" : ""}>${safe(label)}</option>`)
    .join("");
}

function buildVariablePresetOptionsHtml(selectedPreset) {
  return Object.entries(VARIABLE_PRESET_LABELS)
    .map(([preset, label]) => `<option value="${preset}" ${selectedPreset === preset ? "selected" : ""}>${safe(label)}</option>`)
    .join("");
}

function pushVariablePresetOption(options, seen, value, label) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue || seen.has(cleanValue)) {
    return;
  }

  seen.add(cleanValue);
  options.push({
    value: cleanValue,
    label: String(label || cleanValue)
  });
}

function collectVariablePresetOptions(preset) {
  const normalizedPreset = normalizeVariablePreset(preset);
  const scenes = Array.isArray(model.project?.scenes) ? model.project.scenes : [];
  const options = [];
  const seen = new Set();

  if (normalizedPreset === "none") {
    return options;
  }

  if (normalizedPreset === "scene-id") {
    scenes.forEach((scene) => {
      pushVariablePresetOption(options, seen, scene.id, `${scene.id} - ${scene.name}`);
    });
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }

  scenes.forEach((scene) => {
    const items = Array.isArray(scene.gameObjects) ? scene.gameObjects : [];
    if (normalizedPreset === "team-id") {
      items.forEach((item) => {
        pushVariablePresetOption(options, seen, item.teamId, `${item.teamId} - ${scene.name}`);
        pushVariablePresetOption(options, seen, item.targetTeamId, `${item.targetTeamId} - ${scene.name}`);
      });
      return;
    }

    items.forEach((item) => {
      if (normalizedPreset === "spawn-tag" && item.type === "spawn") {
        pushVariablePresetOption(options, seen, item.spawnTag, `${item.spawnTag || item.name} - ${scene.name}`);
      }
      if (normalizedPreset === "door-tag" && item.type === "door") {
        pushVariablePresetOption(options, seen, item.doorTag, `${item.doorTag || item.name} - ${scene.name}`);
      }
      if (normalizedPreset === "trigger-tag" && item.type === "trigger") {
        pushVariablePresetOption(options, seen, item.triggerTag, `${item.triggerTag || item.name} - ${scene.name}`);
      }
      if (normalizedPreset === "checkpoint-id" && item.type === "checkpoint") {
        pushVariablePresetOption(options, seen, item.checkpointId, `${item.checkpointId || item.name} - ${scene.name}`);
      }
    });
  });

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function getVariableEntriesFromUi() {
  return Array.from(ui.variableList.querySelectorAll(".variable-row")).reduce(
    (acc, row) => {
      const keyInput = row.querySelector('[data-role="key"]');
      const typeInput = row.querySelector('[data-role="type"]');
      const presetInput = row.querySelector('[data-role="preset"]');
      const valueInput = row.querySelector('[data-role="value"]');
      const key = String(keyInput?.value || "").trim();
      if (!key) {
        return acc;
      }

      const preset = normalizeVariablePreset(presetInput?.value);
      const type = preset === "none" ? normalizeVariableType(typeInput?.value || inferVariableType(valueInput?.value)) : "string";
      const value = normalizeVariableValueByType(type, valueInput?.value ?? "");

      acc.variables[key] = value;
      acc.variableMeta[key] = { type, preset };
      return acc;
    },
    { variables: {}, variableMeta: {} }
  );
}

function formatVariableValueForInput(value, type, preset = "none") {
  const effectiveType = normalizeVariablePreset(preset) === "none" ? normalizeVariableType(type) : "string";
  return normalizeVariableValueByType(effectiveType, value);
}

function buildPresetValueControl(key, value, preset) {
  const options = collectVariablePresetOptions(preset);
  const currentValue = String(value ?? "").trim();
  const hasCurrentValue = currentValue && options.some((entry) => entry.value === currentValue);
  const allOptions = [
    { value: "", label: "-- vazio --" },
    ...(!hasCurrentValue && currentValue ? [{ value: currentValue, label: `${currentValue} - atual` }] : []),
    ...options
  ];

  return `
    <select data-role="value" data-key="${safe(key)}" class="variable-value variable-value-select">
      ${allOptions
        .map((entry) => `<option value="${safe(entry.value)}" ${entry.value === currentValue ? "selected" : ""}>${safe(entry.label)}</option>`)
        .join("")}
    </select>
  `;
}

function buildVariableValueControl(key, value, type, preset = "none") {
  const normalizedPreset = normalizeVariablePreset(preset);
  if (normalizedPreset !== "none") {
    return buildPresetValueControl(key, value, normalizedPreset);
  }

  const normalizedType = normalizeVariableType(type);
  const formattedValue = formatVariableValueForInput(value, normalizedType, normalizedPreset);
  if (normalizedType === "boolean") {
    return `
      <select data-role="value" data-key="${safe(key)}" class="variable-value variable-value-select">
        <option value="false" ${formattedValue === "false" ? "selected" : ""}>false</option>
        <option value="true" ${formattedValue === "true" ? "selected" : ""}>true</option>
      </select>
    `;
  }

  if (normalizedType === "color") {
    return `<input type="color" data-role="value" data-key="${safe(key)}" class="variable-value variable-value-color" value="${safe(formattedValue)}" />`;
  }

  if (normalizedType === "json") {
    return `<textarea data-role="value" data-key="${safe(key)}" class="variable-value variable-value-json" placeholder='{\"key\":\"value\"}'>${safe(formattedValue)}</textarea>`;
  }

  const inputType = normalizedType === "number" ? "number" : "text";
  const placeholder = normalizedType === "number" ? "0" : "valor";
  const step = normalizedType === "number" ? ' step="any"' : "";
  return `<input type="${inputType}"${step} data-role="value" data-key="${safe(key)}" class="variable-value" value="${safe(formattedValue)}" placeholder="${placeholder}" />`;
}

function getVariableScopeLabel(scope) {
  return scope === "project" ? "Projeto" : "Cena";
}

function getObjectDisplayLabel(type) {
  return OBJECT_TYPE_LABELS[type] || type || "Objeto";
}

function getAlignmentModeLabel(mode) {
  const labels = {
    left: "esquerda",
    top: "topo",
    "h-center": "centro horizontal",
    "v-center": "centro vertical"
  };
  return labels[mode] || mode;
}

function refreshVariablePanel() {
  ensureVariableStores();
  const scope = getVariableScope();
  const target = getVariableTarget(scope);
  const entries = Object.entries(target.variables || {}).sort((left, right) => left[0].localeCompare(right[0]));
  const scopeLabel = getVariableScopeLabel(scope);
  const filterText = String(ui.variableFilterInput?.value || "").trim().toLowerCase();
  let visibleCount = 0;

  ui.variableList.innerHTML = entries.length
    ? entries
        .map(([key, value]) => {
          const preset = normalizeVariablePreset(target.variableMeta?.[key]?.preset);
          const type = preset === "none" ? normalizeVariableType(target.variableMeta?.[key]?.type || inferVariableType(value)) : "string";
          const searchText = [
            key,
            value,
            scopeLabel,
            VARIABLE_TYPE_LABELS[type],
            VARIABLE_PRESET_LABELS[preset]
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const matchesFilter = !filterText || searchText.includes(filterText);
          if (matchesFilter) {
            visibleCount += 1;
          }

          return `
            <div class="variable-row ${matchesFilter ? "" : "filtered-out"}" data-key="${safe(key)}">
              <div class="variable-row-head">
                <span class="variable-scope-badge">${safe(scopeLabel)}</span>
                <button type="button" class="btn btn-tool variable-remove" data-action="remove" data-key="${safe(key)}">X</button>
              </div>
              <input type="text" data-role="key" value="${safe(key)}" class="variable-key" placeholder="var_key" />
              <select data-role="type" class="variable-type" ${preset !== "none" ? 'disabled title="Predefinicao usa texto automaticamente."' : ""}>
                ${buildVariableTypeOptionsHtml(type)}
              </select>
              <select data-role="preset" class="variable-preset">
                ${buildVariablePresetOptionsHtml(preset)}
              </select>
              <div class="variable-value-wrap">
                ${buildVariableValueControl(key, value, type, preset)}
              </div>
            </div>
          `;
        })
        .join("") +
      (visibleCount === 0 ? `<div class="variable-empty filter-empty">Nenhuma variavel encontrada para "${safe(filterText)}".</div>` : "")
    : `<div class="variable-empty">${scope === "project" ? "Projeto sem variaveis padrao." : "Cena sem variaveis padrao."}</div>`;

  const disabled = model.state.mode !== "edit";
  ui.variableScopeSelect.disabled = disabled;
  ui.btnAddVariable.disabled = disabled;
  Array.from(ui.variableList.querySelectorAll("input, select, textarea, button")).forEach((field) => {
    field.disabled = disabled;
  });
}

function nextPrefabId(prefabs) {
  const source = Array.isArray(prefabs) ? prefabs : [];
  let index = 1;
  let id = `prefab_${index}`;
  while (source.some((item) => item.id === id)) {
    index += 1;
    id = `prefab_${index}`;
  }
  return id;
}

function refreshPrefabPanel() {
  ensureProjectAssetDefaults();
  const prefabs = Array.isArray(model.project.prefabs) ? model.project.prefabs : [];
  ui.prefabCount.textContent = `${prefabs.length} prefab${prefabs.length === 1 ? "" : "s"}`;

  if (prefabs.length === 0) {
    ui.prefabList.innerHTML = `<div class="variable-empty">Sem prefabs. Selecione um objeto e clique em "Salvar Sel.".</div>`;
    return;
  }

  ui.prefabList.innerHTML = prefabs
    .map((prefab) => {
      const active = prefab.id === model.state.selectedPrefabId ? "active" : "";
      const sourceKind = prefab.sourceKind === "wall" ? "Parede" : getObjectDisplayLabel(prefab?.data?.type || "gameplayObject");
      return `
        <div class="scene-item ${active}" data-prefab-id="${safe(prefab.id)}">
          <strong>${safe(prefab.name || prefab.id)}</strong>
          <small>${safe(prefab.id)} | ${safe(sourceKind)}</small>
          <div class="mini-tool-grid">
            <button class="btn btn-tool" type="button" data-prefab-id="${safe(prefab.id)}" data-action="select">Selecionar</button>
            <button class="btn btn-tool" type="button" data-prefab-id="${safe(prefab.id)}" data-action="delete">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");

  const disabled = model.state.mode !== "edit";
  Array.from(ui.prefabList.querySelectorAll("button")).forEach((button) => {
    button.disabled = disabled;
  });
}

function saveSelectedAsPrefab() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para salvar prefab.", "danger");
    return;
  }

  const selectedRefs = getSelectedRefs();
  if (selectedRefs.length !== 1) {
    setStatus("Selecione um unico objeto (parede ou objeto de jogo) para salvar prefab.", "danger");
    return;
  }

  const selectedRef = selectedRefs[0];
  if (!["wall", "gameplayObject"].includes(selectedRef.kind)) {
    setStatus("Prefab basico suporta parede e objeto de jogo.", "danger");
    return;
  }

  const selectedObject = getObjectByRef(model.scene, selectedRef);
  if (!selectedObject) {
    setStatus("Objeto selecionado nao encontrado.", "danger");
    return;
  }

  let createdPrefabId = "";
  runCommand("Salvar Prefab", () => {
    ensureProjectAssetDefaults();
    const prefabId = nextPrefabId(model.project.prefabs);
    createdPrefabId = prefabId;
    const data = clone(selectedObject);
    delete data.id;
    data.prefabRef = prefabId;
    model.project.prefabs = sanitizePrefabs(
      model.project.prefabs.concat({
        id: prefabId,
        name: `${selectedObject.name || getObjectDisplayLabel(selectedObject.type)} Prefab`,
        sourceKind: selectedRef.kind,
        data
      })
    );
    model.state.selectedPrefabId = createdPrefabId;
  });

  refreshPrefabPanel();
  exportJson(false);
  setStatus(`Prefab salvo: ${createdPrefabId}.`, "ok");
}

function getPrefabPlacement(prefab) {
  const data = prefab?.data || {};
  const w = Math.max(8, Number.isFinite(Number(data.w)) ? Number(data.w) : model.scene.world.tileSize);
  const h = Math.max(8, Number.isFinite(Number(data.h)) ? Number(data.h) : model.scene.world.tileSize);
  const centerX = model.state.cam.x + model.state.cam.w * 0.5 - w * 0.5;
  const centerY = model.state.cam.y + model.state.cam.h * 0.5 - h * 0.5;
  return {
    x: snap(centerX, model.scene.world.tileSize),
    y: snap(centerY, model.scene.world.tileSize),
    w,
    h
  };
}

function instantiateSelectedPrefab() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para instanciar prefab.", "danger");
    return;
  }

  ensureProjectAssetDefaults();
  const prefab = model.project.prefabs.find((entry) => entry.id === model.state.selectedPrefabId);
  if (!prefab) {
    setStatus("Selecione um prefab para instanciar.", "danger");
    return;
  }

  const placement = getPrefabPlacement(prefab);
  let createdRef = null;
  runCommand("Instanciar Prefab", () => {
    const data = clone(prefab.data || {});
    if (prefab.sourceKind === "wall") {
      const wallId = `wall_${model.state.wallCounter}`;
      model.state.wallCounter += 1;
      const wall = {
        ...data,
        id: wallId,
        name: `${prefab.name} ${model.state.wallCounter - 1}`,
        type: "wall",
        x: placement.x,
        y: placement.y,
        w: placement.w,
        h: placement.h,
        prefabRef: prefab.id
      };
      clampWorld(wall, model.scene.world);
      model.scene.walls.push(wall);
      createdRef = { kind: "wall", id: wallId };
      return;
    }

    const gameplayId = `go_${model.state.gameplayCounter}`;
    model.state.gameplayCounter += 1;
    const object = {
      ...data,
      id: gameplayId,
      name: `${prefab.name} ${model.state.gameplayCounter - 1}`,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
      prefabRef: prefab.id
    };
    clampWorld(object, model.scene.world);
    model.scene.gameObjects.push(object);
    createdRef = { kind: "gameplayObject", id: gameplayId };
  });

  if (createdRef) {
    setSelectedRefs([createdRef], createdRef);
    refreshList();
    refreshInspector();
  }
  exportJson(false);
  setStatus(`Prefab instanciado: ${prefab.name}.`, "ok");
}

function handlePrefabListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionButton = target.closest("button[data-prefab-id][data-action]");
  const card = target.closest("[data-prefab-id]");
  const prefabId = String(actionButton?.dataset.prefabId || card?.dataset.prefabId || "");
  if (!prefabId) {
    return;
  }

  if (actionButton?.dataset.action === "delete") {
    if (model.state.mode !== "edit") {
      setStatus("Volte para EDITAR para excluir prefab.", "danger");
      return;
    }

    runCommand("Excluir Prefab", () => {
      model.project.prefabs = sanitizePrefabs(model.project.prefabs.filter((entry) => entry.id !== prefabId));
      if (model.state.selectedPrefabId === prefabId) {
        model.state.selectedPrefabId = model.project.prefabs[0]?.id || "";
      }
    });
    refreshPrefabPanel();
    exportJson(false);
    setStatus(`Prefab removido: ${prefabId}.`, "ok");
    return;
  }

  model.state.selectedPrefabId = prefabId;
  refreshPrefabPanel();
}

function nextVariableKey(variables) {
  const source = variables && typeof variables === "object" ? variables : {};
  let index = 1;
  let key = `var_${index}`;
  while (Object.prototype.hasOwnProperty.call(source, key)) {
    index += 1;
    key = `var_${index}`;
  }
  return key;
}

function handleVariableTemplateClick(event) {
  const button = event.target.closest("[data-template-id]");
  if (!button) {
    return;
  }

  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para usar templates de variavel.", "danger");
    return;
  }

  const templateId = String(button.dataset.templateId || "");
  const scope = getVariableScope();
  runCommand(scope === "project" ? "Adicionar Template de Variavel do Projeto" : "Adicionar Template de Variavel da Cena", () => {
    const target = getVariableTarget(scope);
    const template = createVariableTemplate(templateId, {
      project: model.project,
      scene: model.scene,
      scope,
      existingVariables: target.variables
    });
    target.variables = {
      ...(target.variables || {}),
      [template.key]: template.value
    };
    target.variableMeta = {
      ...(target.variableMeta || {}),
      [template.key]: { ...template.meta }
    };
  });

  refreshVariableTemplates();
  refreshVariablePanel();
  exportJson(false);
  const template = VARIABLE_TEMPLATE_DEFS.find((entry) => entry.id === templateId);
  setStatus(`Template ${template?.label || templateId} adicionado aos padroes de ${scope === "project" ? "projeto" : "cena"}.`, "ok");
}

function addVariableEntry() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para adicionar variaveis.", "danger");
    return;
  }

  const scope = getVariableScope();
  runCommand(scope === "project" ? "Adicionar Variavel do Projeto" : "Adicionar Variavel da Cena", () => {
    const target = getVariableTarget(scope);
    const key = nextVariableKey(target.variables);
    target.variables = {
      ...(target.variables || {}),
      [key]: ""
    };
    target.variableMeta = {
      ...(target.variableMeta || {}),
      [key]: { type: "string", preset: "none" }
    };
  });

  refreshVariablePanel();
  exportJson(false);
  setStatus(`Variavel adicionada aos padroes de ${scope === "project" ? "projeto" : "cena"}.`, "ok");
}

function handleVariableListClick(event) {
  const button = event.target.closest("button[data-action=\"remove\"][data-key]");
  if (!button) {
    return;
  }

  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para remover variaveis.", "danger");
    return;
  }

  const scope = getVariableScope();
  const key = String(button.dataset.key || "");
  runCommand(scope === "project" ? "Excluir Variavel do Projeto" : "Excluir Variavel da Cena", () => {
    const target = getVariableTarget(scope);
    const nextVariables = { ...(target.variables || {}) };
    const nextMeta = { ...(target.variableMeta || {}) };
    delete nextVariables[key];
    delete nextMeta[key];
    target.variables = nextVariables;
    target.variableMeta = nextMeta;
  });

  refreshVariablePanel();
  exportJson(false);
  setStatus(`Variavel ${key} removida.`, "ok");
}

function handleVariableListBlur(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.closest(".variable-row")) {
    return;
  }

  commitVariablePanel();
}

function commitVariablePanel() {
  if (model.state.mode !== "edit") {
    return;
  }

  const scope = getVariableScope();
  runCommand(scope === "project" ? "Editar Variaveis do Projeto" : "Editar Variaveis da Cena", () => {
    const target = getVariableTarget(scope);
    const nextEntries = getVariableEntriesFromUi();
    target.variables = nextEntries.variables;
    target.variableMeta = nextEntries.variableMeta;
  });

  refreshVariablePanel();
  exportJson(false);
}

function selectProjectScene(sceneId) {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para trocar de mapa.", "danger");
    return;
  }

  if (model.project.activeSceneId === sceneId) {
    return;
  }

  if (history.hasOpenTransaction()) {
    commitCommandGroup();
  }

  runCommand("Trocar Cena", () => {
    model.project.activeSceneId = sceneId;
    resetActiveSceneView();
  });

  refreshAll();
  setStatus(`Cena ativa: ${model.scene.name}.`, "ok");
}

function createNewScene() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para criar mapas.", "danger");
    return;
  }

  runCommand("Nova Cena", () => {
    const newScene = createSceneFromProject(model.project);
    model.project.scenes.push(newScene);
    model.project.activeSceneId = newScene.id;
    syncBuildSceneReferences();
    resetActiveSceneView();
  });

  refreshAll();
  setStatus(`Nova cena criada: ${model.scene.name}.`, "ok");
}

function duplicateActiveScene() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para duplicar mapas.", "danger");
    return;
  }

  runCommand("Duplicar Cena", () => {
    const duplicate = duplicateSceneForProject(model.project, model.scene);
    model.project.scenes.push(duplicate);
    model.project.activeSceneId = duplicate.id;
    syncBuildSceneReferences();
    resetActiveSceneView();
  });

  refreshAll();
  setStatus(`Cena duplicada: ${model.scene.name}.`, "ok");
}

function deleteActiveScene() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para excluir mapas.", "danger");
    return;
  }

  if (model.project.scenes.length <= 1) {
    setStatus("O projeto precisa ter pelo menos uma cena.", "danger");
    return;
  }

  const deletedSceneName = model.scene.name;

  runCommand("Excluir Cena", () => {
    model.project.scenes = model.project.scenes.filter((scene) => scene.id !== model.project.activeSceneId);
    model.project.activeSceneId = model.project.scenes[0].id;
    syncBuildSceneReferences();
    resetActiveSceneView();
  });

  refreshAll();
  setStatus(`Cena removida: ${deletedSceneName}.`, "ok");
}

function applyProjectTemplate() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para aplicar template de projeto.", "danger");
    return;
  }

  const templateId = String(ui.projectTemplateSelect.value || model.project.templateId || "top-down");
  const templateMeta = PROJECT_TEMPLATE_DEFS.find((entry) => entry.id === templateId);
  let createdScene = null;

  runCommand("Criar Cena por Template", () => {
    model.project.templateId = templateId;
    createdScene = createSceneFromTemplate(model.project, templateId);
    model.project.scenes.push(createdScene);
    model.project.activeSceneId = createdScene.id;
    syncBuildSceneReferences();
    resetActiveSceneView();
  });

  refreshAll();
  setStatus(`Template ${templateMeta?.label || templateId} aplicado em nova cena: ${createdScene?.name || "Cena"}.`, "ok");
}

function applyBuildProfile() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para aplicar perfil de build.", "danger");
    return;
  }

  ensureBuildDefaults();
  const profileId = normalizeBuildProfileId(ui.buildProfileSelect.value);
  const profile = model.project.buildProfiles?.[profileId];
  if (!profile) {
    setStatus("Perfil de build invalido.", "danger");
    return;
  }

  runCommand("Aplicar Perfil de Build", () => {
    model.project.activeBuildProfile = profileId;
    model.project.buildConfig = clone(profile);
    if (!model.project.scenes.some((scene) => scene.id === model.project.buildConfig.startScene)) {
      model.project.buildConfig.startScene = model.project.activeSceneId;
    }
  });

  refreshBuildPanel();
  exportJson(false);
  setStatus(`Perfil de build ${profileId} aplicado.`, "ok");
}

function commitBuildConfigInputs() {
  if (model.state.mode !== "edit") {
    return;
  }

  ensureBuildDefaults();
  const nextBuildConfig = readBuildConfigInputs();
  const currentConfig = model.project.buildConfig || {};

  if (JSON.stringify(currentConfig) === JSON.stringify(nextBuildConfig)) {
    return;
  }

  runCommand("Atualizar Build Config", () => {
    model.project.buildConfig = nextBuildConfig;
  });

  refreshBuildPanel();
  exportJson(false);
  setStatus("Build config atualizada.", "ok");
}

function downloadBuildConfig() {
  ensureBuildDefaults();
  const payload = {
    projectName: model.project.name,
    templateId: model.project.templateId,
    activeBuildProfile: model.project.activeBuildProfile,
    buildConfig: model.project.buildConfig
  };

  const fileSafeName = String(model.project.buildConfig?.buildName || "cn-build")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "cn-build";
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileSafeName}.build.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus("Build config baixada.", "ok");
}

function getGameSaveStorageKey() {
  const projectName = String(model.project?.name || "CN_Engine").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return `cn-engine:savegame:${projectName || "default"}`;
}

function saveGameState() {
  if (typeof localStorage === "undefined") {
    setStatus("Salvar jogo indisponivel neste ambiente.", "danger");
    return;
  }

  const savePayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    activeSceneId: String(model.project.activeSceneId || ""),
    project: clone(model.project),
    playSaveData: model.state.mode === "play" ? runtime.createPlaySaveData() : null
  };

  try {
    localStorage.setItem(getGameSaveStorageKey(), JSON.stringify(savePayload));
    setStatus("Jogo salvo localmente.", "ok");
  } catch {
    setStatus("Falha ao salvar jogo no navegador.", "danger");
  }
}

function loadGameState() {
  if (typeof localStorage === "undefined") {
    setStatus("Carregar jogo indisponivel neste ambiente.", "danger");
    return;
  }

  const raw = localStorage.getItem(getGameSaveStorageKey());
  if (!raw) {
    setStatus("Nenhum save local encontrado para este projeto.", "danger");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    setStatus("Save local corrompido.", "danger");
    return;
  }

  const validated = validateProject(parsed?.project);
  if (!validated?.ok) {
    setStatus(`Save invalido: ${validated?.message || "erro de estrutura"}.`, "danger");
    return;
  }

  model.project = validated.project;
  if (parsed.activeSceneId && model.project.scenes.some((scene) => scene.id === parsed.activeSceneId)) {
    model.project.activeSceneId = parsed.activeSceneId;
  }

  resetActiveSceneView();

  if (model.state.mode === "play") {
    runtime.beginPlaySession({
      skipSpawn: true,
      playSaveData: parsed.playSaveData || null
    });
  }

  refreshAll();
  setStatus("Jogo carregado do save local.", "ok");
}

function selectRef(ref, options = {}) {
  if (!ref) {
    setSelectedRefs([]);
    return;
  }

  const current = getSelectedRefs();
  if (options.toggle) {
    const exists = current.some((entry) => sameRef(entry, ref));
    if (exists) {
      setSelectedRefs(current.filter((entry) => !sameRef(entry, ref)), model.state.selected);
      return;
    }

    setSelectedRefs(current.concat(ref), ref);
    return;
  }

  if (options.additive) {
    const nextRefs = current.some((entry) => sameRef(entry, ref)) ? current : current.concat(ref);
    setSelectedRefs(nextRefs, ref);
    return;
  }

  setSelectedRefs([ref], ref);
}

function refreshAll() {
  const state = model.state;
  state.workspaceMode = normalizeWorkspaceMode(state.workspaceMode);
  ensureProjectAssetDefaults();
  ensureLayerSettingsState();
  syncActiveScene();
  ensureScenePhysicsState();
  syncParentHierarchy(model.scene, { includeEntities: true });
  applyWorkspaceUiState();

  ui.btnEdit.classList.toggle("active", state.mode === "edit");
  ui.btnPlay.classList.toggle("active", state.mode === "play");

  const editDisabled = state.mode !== "edit";
  ui.toolSelect.disabled = editDisabled;
  ui.toolPaint.disabled = editDisabled;
  ui.toolWall.disabled = editDisabled;
  ui.paintToolBrush.disabled = editDisabled;
  ui.paintToolRandom.disabled = editDisabled;
  ui.paintToolLine.disabled = editDisabled;
  ui.paintToolRect.disabled = editDisabled;
  ui.paintToolFill.disabled = editDisabled;
  ui.paintToolEyedropper.disabled = editDisabled;
  ui.paintBrushSize.disabled = editDisabled;
  ui.paintBrushShape.disabled = editDisabled;
  ui.paintLineThickness.disabled = editDisabled;
  ui.paintAutoTile.disabled = editDisabled;
  ui.spaceModeSelect.disabled = editDisabled;
  ui.viewportRendererSelect.disabled = editDisabled;
  ui.tileLayerSelect.disabled = editDisabled;
  ui.btnResetLayers.disabled = editDisabled;
  ui.sceneCompositeCollider.disabled = editDisabled;
  ui.scenePixelPerfect.disabled = editDisabled;
  ui.scenePixelScale.disabled = editDisabled;
  ui.sceneSortByY.disabled = editDisabled;
  ui.sceneSurfaceFrictionDefault.disabled = editDisabled;
  ui.sceneSurfaceFrictionGrass.disabled = editDisabled;
  ui.sceneSurfaceFrictionStone.disabled = editDisabled;
  ui.sceneSurfaceFrictionSand.disabled = editDisabled;
  ui.sceneSurfaceFrictionWater.disabled = editDisabled;
  ui.sceneSurfaceFrictionLava.disabled = editDisabled;
  ui.viewShowGrid.disabled = editDisabled;
  ui.viewShowColliders.disabled = editDisabled;
  ui.viewShowLabels.disabled = editDisabled;
  ui.sceneCameraMode.disabled = editDisabled;
  ui.sceneCameraDamping.disabled = editDisabled;
  ui.sceneCameraDeadZoneW.disabled = editDisabled;
  ui.sceneCameraDeadZoneH.disabled = editDisabled;
  ui.sceneCameraLookAheadX.disabled = editDisabled;
  ui.sceneCameraLookAheadY.disabled = editDisabled;
  ui.sceneCameraZoom.disabled = editDisabled;
  ui.sceneCameraConfine.disabled = editDisabled;
  ui.sceneCameraFollowEdit.disabled = editDisabled;
  ui.sceneCameraShakeEnabled.disabled = editDisabled;
  ui.sceneCameraShakeIntensity.disabled = editDisabled;
  ui.sceneCameraShakeDuration.disabled = editDisabled;
  ui.sceneCameraShakeFrequency.disabled = editDisabled;
  ui.sceneLightingEnabled.disabled = editDisabled;
  ui.sceneLightingAmbientColor.disabled = editDisabled;
  ui.sceneLightingAmbientAlpha.disabled = editDisabled;
  ui.sceneLightingShadowLength.disabled = editDisabled;
  ui.sceneLightingShadowAlpha.disabled = editDisabled;
  ui.sceneUiShowHud.disabled = editDisabled;
  ui.sceneUiShowHints.disabled = editDisabled;
  ui.sceneUiShowPauseOverlay.disabled = editDisabled;
  ui.sceneAudioEnabled.disabled = editDisabled;
  ui.sceneAudioMasterVolume.disabled = editDisabled;
  ui.sceneAudioSfxVolume.disabled = editDisabled;
  ui.sceneAudioMusicVolume.disabled = editDisabled;
  ui.btnSceneNew.disabled = editDisabled;
  ui.btnSceneDuplicate.disabled = editDisabled;
  ui.btnSceneDelete.disabled = editDisabled || model.project.scenes.length <= 1;
  ui.projectTemplateSelect.disabled = editDisabled;
  ui.btnApplyProjectTemplate.disabled = editDisabled;
  ui.btnDuplicateSelection.disabled = editDisabled;
  ui.btnDeleteSelection.disabled = editDisabled;
  ui.btnAddSpawn.disabled = editDisabled;
  ui.btnAddTrigger.disabled = editDisabled;
  ui.btnAddPortal.disabled = editDisabled;
  ui.btnAddCheckpoint.disabled = editDisabled;
  ui.btnAddDoor.disabled = editDisabled;
  ui.btnAddCameraZone.disabled = editDisabled;
  ui.btnAddSpriteShape.disabled = editDisabled;
  ui.btnAddLight2D.disabled = editDisabled;
  ui.btnSavePrefab.disabled = editDisabled;
  ui.btnInstantiatePrefab.disabled = editDisabled;
  ui.btnResetNativeCamera.disabled = editDisabled || state.viewportRenderer !== "native-3d";
  ui.buildProfileSelect.disabled = editDisabled;
  ui.btnApplyBuildProfile.disabled = editDisabled;
  ui.btnDownloadBuildConfig.disabled = false;
  ui.buildNameInput.disabled = editDisabled;
  ui.buildModeSelect.disabled = editDisabled;
  ui.buildStartSceneSelect.disabled = editDisabled;
  ui.buildIncludeEditor.disabled = editDisabled;
  ui.buildIncludeDebug.disabled = editDisabled;
  ui.buildCompressAssets.disabled = editDisabled;
  ui.btnImportSpriteAtlas.disabled = editDisabled;
  ui.btnResetSpriteAtlas.disabled = editDisabled;
  ui.spriteAtlasEditor.disabled = editDisabled;
  ui.btnImportSpriteAnimations.disabled = editDisabled;
  ui.btnResetSpriteAnimations.disabled = editDisabled;
  ui.spriteAnimationEditor.disabled = editDisabled;
  ui.btnImportAudioClips.disabled = editDisabled;
  ui.btnResetAudioClips.disabled = editDisabled;
  ui.audioClipEditor.disabled = editDisabled;
  ui.audioRouteUi.disabled = editDisabled;
  ui.audioRouteTrigger.disabled = editDisabled;
  ui.audioRouteCheckpoint.disabled = editDisabled;
  ui.audioRoutePortal.disabled = editDisabled;
  ui.audioRoutePauseOn.disabled = editDisabled;
  ui.audioRoutePauseOff.disabled = editDisabled;
  ui.audioRouteRespawn.disabled = editDisabled;
  ui.audioRouteMusic.disabled = editDisabled;
  ui.audioClipQuickName.disabled = editDisabled;
  ui.audioClipQuickSrc.disabled = editDisabled;
  ui.audioClipQuickKind.disabled = editDisabled;
  ui.audioClipQuickVolume.disabled = editDisabled;
  ui.audioClipQuickLoop.disabled = editDisabled;
  ui.btnAddAudioClipQuick.disabled = editDisabled;
  ui.btnImportTimelines.disabled = editDisabled;
  ui.btnResetTimelines.disabled = editDisabled;
  ui.timelineEditor.disabled = editDisabled;

  if (!TILE_LAYER_LABELS[state.tileLayer]) {
    state.tileLayer = "gameplay";
  }
  state.paintBrushShape = normalizePaintBrushShape(state.paintBrushShape);
  state.paintLineThickness = normalizePaintLineThickness(state.paintLineThickness);
  ui.spaceModeSelect.value = normalizeSceneSpaceMode(model.scene?.space?.mode);
  ui.viewportRendererSelect.value = state.viewportRenderer === "native-3d" ? "native-3d" : "scene";
  ui.tileLayerSelect.value = state.tileLayer;
  ui.paintBrushSize.value = String(Math.max(1, Math.min(8, Number.isFinite(Number(state.paintBrushSize)) ? Math.round(Number(state.paintBrushSize)) : 1)));
  ui.paintBrushShape.value = normalizePaintBrushShape(state.paintBrushShape);
  ui.paintLineThickness.value = String(normalizePaintLineThickness(state.paintLineThickness));
  ui.paintAutoTile.checked = state.autoTileEnabled !== false;
  ui.viewShowGrid.checked = state.showGrid !== false;
  ui.viewShowColliders.checked = state.showColliders !== false;
  ui.viewShowLabels.checked = state.showLabels !== false;
  refreshScenePhysicsPanel();
  refreshSceneCameraPanel();
  refreshSceneLightingPanel();
  refreshSceneUiPanel();
  refreshSceneAudioPanel();

  [ui.f.x, ui.f.y, ui.f.z, ui.f.w, ui.f.h].forEach((field) => {
    field.disabled = editDisabled;
  });

  projectSceneController.refresh();
  refreshList();
  refreshInspector();
  refreshProjectTemplatePanel();
  refreshBuildPanel();
  refreshPrefabPanel();
  refreshSpriteAtlasPanel();
  refreshSpriteAnimationsPanel();
  refreshAudioClipPanel();
  refreshTimelinePanel();
  refreshVariableTemplates();
  refreshVariablePanel();
  applyInspectorDisabledState(editDisabled);
  exportJson(false);
  setTool(state.tool, { announce: false });
  setPaintTool(state.paintTool, { announce: false });
  refreshLayerControls();
  refreshSelectionActionButtons();
  applyHistoryUi();
  editor3d.refresh();
}

function refreshList() {
  sceneListController.refresh();
}

function refreshInspector() {
  const selectedRefs = getSelectedRefs();
  const selectedObjects = selectedRefs.map((ref) => getObjectByRef(model.scene, ref)).filter(Boolean);
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  renderInspector({
    inspectorEmpty: ui.inspectorEmpty,
    inspectorForm: ui.inspectorForm,
    fields: ui.f,
    project: model.project,
    scene: model.scene,
    selectedObject,
    selectedObjects,
    selectedRef: model.state.selected,
    mode: model.state.mode
  });
  applyInspectorDisabledState(model.state.mode !== "edit");
}

function applyInspectorDisabledState(editDisabled) {
  Array.from(ui.f.metaFields.querySelectorAll(".inspector-meta-input")).forEach((field) => {
    field.disabled = editDisabled;
  });
}

function refreshSelectionActionButtons() {
  const editableRefs = getMutableSelectedRefs();
  const selectedObjects = getSelectedObjects();
  const editDisabled = model.state.mode !== "edit";
  const duplicateLabel = editableRefs.length > 1 ? `Duplicar ${editableRefs.length}` : "Duplicar Sel.";
  const deleteLabel = editableRefs.length > 1 ? `Excluir ${editableRefs.length}` : "Excluir Sel.";
  const hasGroup = selectedObjects.length > 1;

  ui.btnDuplicateSelection.textContent = duplicateLabel;
  ui.btnDeleteSelection.textContent = deleteLabel;
  ui.btnDuplicateSelection.disabled = editDisabled || editableRefs.length === 0;
  ui.btnDeleteSelection.disabled = editDisabled || editableRefs.length === 0;
  ui.btnAlignLeft.disabled = editDisabled || !hasGroup;
  ui.btnAlignTop.disabled = editDisabled || !hasGroup;
  ui.btnAlignHCenter.disabled = editDisabled || !hasGroup;
  ui.btnAlignVCenter.disabled = editDisabled || !hasGroup;
  ui.btnDistributeH.disabled = editDisabled || selectedObjects.length < 3;
  ui.btnDistributeV.disabled = editDisabled || selectedObjects.length < 3;
}

function refreshProjectTemplatePanel() {
  const fallbackTemplate = PROJECT_TEMPLATE_DEFS[0]?.id || "top-down";
  const selectedTemplate = PROJECT_TEMPLATE_DEFS.some((entry) => entry.id === model.project.templateId) ? model.project.templateId : fallbackTemplate;
  model.project.templateId = selectedTemplate;
  ui.projectTemplateSelect.value = selectedTemplate;
}

function refreshBuildPanel() {
  ensureBuildDefaults();
  syncBuildStartSceneOptions();
  ui.buildProfileSelect.value = normalizeBuildProfileId(ui.buildProfileSelect.value || model.project.activeBuildProfile);

  const config = model.project.buildConfig;
  ui.buildNameInput.value = String(config.buildName || "");
  ui.buildModeSelect.value = normalizeBuildMode(config.mode);
  ui.buildStartSceneSelect.value = model.project.scenes.some((scene) => scene.id === config.startScene) ? config.startScene : model.project.activeSceneId;
  ui.buildIncludeEditor.checked = config.includeEditorUI === true;
  ui.buildIncludeDebug.checked = config.includeDebugPanel === true;
  ui.buildCompressAssets.checked = config.compressAssets === true;
}

function ensureProjectAssetDefaults() {
  if (!Array.isArray(model.project.spriteAtlases) || model.project.spriteAtlases.length === 0) {
    model.project.spriteAtlases = sanitizeSpriteAtlases(model.project.spriteAtlases);
  }

  if (!Array.isArray(model.project.spriteAnimations)) {
    model.project.spriteAnimations = sanitizeSpriteAnimations(model.project.spriteAnimations);
  }

  if (!Array.isArray(model.project.audioClips)) {
    model.project.audioClips = sanitizeAudioClips(model.project.audioClips);
  }
  model.project.audioRouting = sanitizeAudioRouting(model.project.audioRouting, model.project.audioClips);

  if (!Array.isArray(model.project.prefabs)) {
    model.project.prefabs = sanitizePrefabs(model.project.prefabs);
  }

  if (!Array.isArray(model.project.timelines)) {
    model.project.timelines = sanitizeTimelines(model.project.timelines);
  }

  if (!model.project.prefabs.some((prefab) => prefab.id === model.state.selectedPrefabId)) {
    model.state.selectedPrefabId = model.project.prefabs[0]?.id || "";
  }
}

function refreshSpriteAtlasPanel() {
  ensureProjectAssetDefaults();
  ui.spriteAtlasEditor.value = JSON.stringify(model.project.spriteAtlases, null, 2);
}

function refreshSpriteAnimationsPanel() {
  ensureProjectAssetDefaults();
  ui.spriteAnimationEditor.value = JSON.stringify(model.project.spriteAnimations, null, 2);
}

function refreshAudioClipPanel() {
  ensureProjectAssetDefaults();
  ui.audioClipEditor.value = JSON.stringify(model.project.audioClips, null, 2);
  refreshAudioRoutingPanel();
  refreshAudioClipLibraryList();
}

function getAudioRoutingInputs() {
  return {
    ui: ui.audioRouteUi.value,
    trigger: ui.audioRouteTrigger.value,
    checkpoint: ui.audioRouteCheckpoint.value,
    portal: ui.audioRoutePortal.value,
    pauseon: ui.audioRoutePauseOn.value,
    pauseoff: ui.audioRoutePauseOff.value,
    respawn: ui.audioRouteRespawn.value,
    music: ui.audioRouteMusic.value
  };
}

function buildAudioRouteOptionsHtml(selectedClipId) {
  const clips = Array.isArray(model.project?.audioClips) ? model.project.audioClips : [];
  const selected = String(selectedClipId || "").trim().toLowerCase();
  const options = ['<option value="">Sem clip</option>'];
  const seen = new Set();

  clips.forEach((clip) => {
    const id = String(clip?.id || "").trim().toLowerCase();
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    const label = `${clip.name || id} (${id})`;
    options.push(`<option value="${safe(id)}"${selected === id ? " selected" : ""}>${safe(label)}</option>`);
  });

  if (selected && !seen.has(selected)) {
    options.push(`<option value="${safe(selected)}" selected>${safe(selected)} (ausente)</option>`);
  }

  return options.join("");
}

function refreshAudioRoutingPanel() {
  ensureProjectAssetDefaults();
  model.project.audioRouting = sanitizeAudioRouting(model.project.audioRouting, model.project.audioClips);
  ui.audioRouteUi.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.ui);
  ui.audioRouteTrigger.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.trigger);
  ui.audioRouteCheckpoint.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.checkpoint);
  ui.audioRoutePortal.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.portal);
  ui.audioRoutePauseOn.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.pauseon);
  ui.audioRoutePauseOff.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.pauseoff);
  ui.audioRouteRespawn.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.respawn);
  ui.audioRouteMusic.innerHTML = buildAudioRouteOptionsHtml(model.project.audioRouting.music);
}

function refreshAudioClipLibraryList() {
  ensureProjectAssetDefaults();
  const clips = Array.isArray(model.project.audioClips) ? model.project.audioClips : [];
  const routing = sanitizeAudioRouting(model.project.audioRouting, clips);
  const isEditMode = model.state.mode === "edit";

  if (clips.length === 0) {
    ui.audioClipLibraryList.innerHTML = '<div class="variable-empty">Biblioteca vazia. Use + Adicionar Biblioteca ou importe JSON.</div>';
    return;
  }

  ui.audioClipLibraryList.innerHTML = clips
    .map((clip) => {
      const clipId = String(clip.id || "").trim().toLowerCase();
      const routes = AUDIO_ROUTE_KEYS
        .filter((routeKey) => routing[routeKey] === clipId)
        .map((routeKey) => AUDIO_ROUTE_LABELS[routeKey] || routeKey);
      const routeText = routes.length > 0 ? `Rota: ${routes.join(", ")}` : "Rota: nao vinculada";
      return `
        <article class="audio-clip-row">
          <div class="audio-clip-head">
            <strong>${safe(clip.name || clipId)}</strong>
            <span class="audio-clip-kind">${safe(String(clip.kind || "custom"))}</span>
          </div>
          <div class="audio-clip-meta">${safe(clipId)} | vol ${safe(String(clip.volume ?? 1))} | loop ${clip.loop === true ? "on" : "off"}</div>
          <div class="audio-clip-meta">${safe(String(clip.src || ""))}</div>
          <div class="audio-clip-meta">${safe(routeText)}</div>
          <div class="audio-clip-actions">
            <button class="btn btn-tool" type="button" data-action="play" data-clip-id="${safe(clipId)}">Tocar</button>
            <button class="btn btn-tool" type="button" data-action="remove" data-clip-id="${safe(clipId)}" ${isEditMode ? "" : "disabled"}>Remover</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function commitAudioRoutingInputs() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alterar a biblioteca de audio.", "danger");
    refreshAudioRoutingPanel();
    return;
  }

  ensureProjectAssetDefaults();
  const current = sanitizeAudioRouting(model.project.audioRouting, model.project.audioClips);
  const next = sanitizeAudioRouting(getAudioRoutingInputs(), model.project.audioClips);
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return;
  }

  runCommand("Roteamento da Biblioteca de Audio", () => {
    model.project.audioRouting = { ...next };
  });

  refreshAudioClipPanel();
  exportJson(false);
  setStatus("Biblioteca de audio atualizada.", "ok");
}

function normalizeAudioClipIdSeed(source) {
  const seed = String(source || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return seed || `clip_${Date.now()}`;
}

function addAudioClipQuick() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para adicionar audio na biblioteca.", "danger");
    return;
  }

  const name = String(ui.audioClipQuickName.value || "").trim();
  const src = String(ui.audioClipQuickSrc.value || "").trim();
  const kind = String(ui.audioClipQuickKind.value || "custom").trim().toLowerCase();
  const volume = clamp01(ui.audioClipQuickVolume.value, 1);
  const loop = ui.audioClipQuickLoop.checked === true;

  if (!src) {
    setStatus("Informe o caminho do arquivo para adicionar na biblioteca.", "danger");
    return;
  }

  const sourceName = name || src.split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, "");
  const clipDraft = {
    id: normalizeAudioClipIdSeed(sourceName),
    name: name || sourceName || "Audio Clip",
    src,
    kind,
    volume,
    loop
  };

  runCommand("Adicionar Audio na Biblioteca", () => {
    const merged = sanitizeAudioClips([...(model.project.audioClips || []), clipDraft]);
    model.project.audioClips = merged;
    model.project.audioRouting = sanitizeAudioRouting(model.project.audioRouting, merged);
  });

  ui.audioClipQuickName.value = "";
  ui.audioClipQuickSrc.value = "";
  ui.audioClipQuickLoop.checked = kind === "music";
  refreshAudioClipPanel();
  exportJson(false);
  setStatus(`Audio adicionado na biblioteca (${clipDraft.name}).`, "ok");
}

function playAudioClipPreview(clipId) {
  const clips = Array.isArray(model.project.audioClips) ? model.project.audioClips : [];
  const clip = clips.find((entry) => String(entry?.id || "").trim().toLowerCase() === String(clipId || "").trim().toLowerCase());
  if (!clip) {
    setStatus("Clip nao encontrado na biblioteca.", "danger");
    return;
  }

  if (typeof Audio === "undefined") {
    setStatus("Audio nao suportado neste navegador.", "danger");
    return;
  }

  try {
    if (audioPreviewInstance) {
      audioPreviewInstance.pause();
      audioPreviewInstance.currentTime = 0;
    }
    audioPreviewInstance = new Audio(clip.src);
    audioPreviewInstance.volume = clamp01(clip.volume, 1);
    audioPreviewInstance.loop = false;
    const maybePromise = audioPreviewInstance.play();
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => {});
    }
    setStatus(`Preview: ${clip.name || clip.id}.`, "ok");
  } catch {
    setStatus("Nao foi possivel tocar o audio de preview.", "danger");
  }
}

function removeAudioClipFromLibrary(clipId) {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para remover audio da biblioteca.", "danger");
    return;
  }

  const cleanClipId = String(clipId || "").trim().toLowerCase();
  if (!cleanClipId) {
    return;
  }

  runCommand("Remover Audio da Biblioteca", () => {
    const nextClips = (model.project.audioClips || []).filter((clip) => String(clip?.id || "").trim().toLowerCase() !== cleanClipId);
    model.project.audioClips = sanitizeAudioClips(nextClips);
    model.project.audioRouting = sanitizeAudioRouting(model.project.audioRouting, model.project.audioClips);
  });

  refreshAudioClipPanel();
  exportJson(false);
  setStatus(`Audio removido da biblioteca (${cleanClipId}).`, "ok");
}

function handleAudioClipLibraryClick(event) {
  const actionButton = event.target.closest("button[data-action][data-clip-id]");
  if (!actionButton) {
    return;
  }

  const action = String(actionButton.dataset.action || "");
  const clipId = String(actionButton.dataset.clipId || "");
  if (!clipId) {
    return;
  }

  if (action === "play") {
    playAudioClipPreview(clipId);
    return;
  }

  if (action === "remove") {
    removeAudioClipFromLibrary(clipId);
  }
}

function refreshTimelinePanel() {
  ensureProjectAssetDefaults();
  ui.timelineEditor.value = JSON.stringify(model.project.timelines, null, 2);
}

function importSpriteAtlas() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para importar atlas.", "danger");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(ui.spriteAtlasEditor.value);
  } catch {
    setStatus("JSON de atlas invalido.", "danger");
    return;
  }

  runCommand("Importar Sprite Atlas", () => {
    model.project.spriteAtlases = sanitizeSpriteAtlases(Array.isArray(parsed) ? parsed : [parsed]);
  });

  refreshSpriteAtlasPanel();
  exportJson(false);
  setStatus(`Sprite atlas importado (${model.project.spriteAtlases.length} atlas).`, "ok");
}

function resetSpriteAtlas() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para resetar atlas.", "danger");
    return;
  }

  runCommand("Resetar Sprite Atlas", () => {
    model.project.spriteAtlases = sanitizeSpriteAtlases(null);
  });

  refreshSpriteAtlasPanel();
  exportJson(false);
  setStatus("Sprite atlas demo restaurado.", "ok");
}

function importTimelines() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para importar timelines.", "danger");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(ui.timelineEditor.value);
  } catch {
    setStatus("JSON de timeline invalido.", "danger");
    return;
  }

  runCommand("Importar Timeline 2D", () => {
    model.project.timelines = sanitizeTimelines(Array.isArray(parsed) ? parsed : [parsed]);
  });

  refreshTimelinePanel();
  exportJson(false);
  setStatus(`Timelines importadas (${model.project.timelines.length}).`, "ok");
}

function resetTimelines() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para resetar timelines.", "danger");
    return;
  }

  runCommand("Resetar Timeline 2D", () => {
    model.project.timelines = sanitizeTimelines([
      {
        id: "timeline_demo_intro",
        name: "Intro Demo",
        actions: [
          {
            type: "start-dialogue",
            speaker: "Diretora",
            lines: ["Bem-vindo ao editor CN.", "Camera entrando em cena.", "Vamos abrir a porta inicial."]
          },
          { type: "move-camera", x: 520, y: 180, duration: 0.9 },
          { type: "open-door", targetTag: "porta_demo" }
        ]
      }
    ]);
  });

  refreshTimelinePanel();
  exportJson(false);
  setStatus("Timeline demo restaurada.", "ok");
}

function importSpriteAnimations() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para importar animacoes.", "danger");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(ui.spriteAnimationEditor.value);
  } catch {
    setStatus("JSON de animacoes invalido.", "danger");
    return;
  }

  runCommand("Importar Animacoes Sprite", () => {
    model.project.spriteAnimations = sanitizeSpriteAnimations(Array.isArray(parsed) ? parsed : [parsed]);
  });

  refreshSpriteAnimationsPanel();
  exportJson(false);
  setStatus(`Animacoes importadas (${model.project.spriteAnimations.length}).`, "ok");
}

function resetSpriteAnimations() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para limpar animacoes.", "danger");
    return;
  }

  runCommand("Resetar Animacoes Sprite", () => {
    model.project.spriteAnimations = sanitizeSpriteAnimations([]);
  });

  refreshSpriteAnimationsPanel();
  exportJson(false);
  setStatus("Animacoes limpas.", "ok");
}

function importAudioClips() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para importar audio.", "danger");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(ui.audioClipEditor.value);
  } catch {
    setStatus("JSON de audio invalido.", "danger");
    return;
  }

  runCommand("Importar Audio Clips", () => {
    model.project.audioClips = sanitizeAudioClips(Array.isArray(parsed) ? parsed : [parsed]);
    model.project.audioRouting = sanitizeAudioRouting(model.project.audioRouting, model.project.audioClips);
  });

  refreshAudioClipPanel();
  exportJson(false);
  setStatus(`Audio clips importados (${model.project.audioClips.length}).`, "ok");
}

function resetAudioClips() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para restaurar audio demo.", "danger");
    return;
  }

  runCommand("Resetar Audio Clips", () => {
    model.project.audioClips = createDemoAudioClips();
    model.project.audioRouting = sanitizeAudioRouting(null, model.project.audioClips);
  });

  refreshAudioClipPanel();
  exportJson(false);
  setStatus("Audio clips demo restaurados.", "ok");
}

function syncBuildStartSceneOptions() {
  const currentValue = String(ui.buildStartSceneSelect.value || "");
  ui.buildStartSceneSelect.innerHTML = model.project.scenes
    .map((scene) => `<option value="${safe(scene.id)}">${safe(scene.name)} (${safe(scene.id)})</option>`)
    .join("");
  if (model.project.scenes.some((scene) => scene.id === currentValue)) {
    ui.buildStartSceneSelect.value = currentValue;
  }
}

function ensureBuildDefaults() {
  if (!Array.isArray(model.project.scenes) || model.project.scenes.length === 0) {
    return;
  }

  const fallbackSceneId = model.project.activeSceneId || model.project.scenes[0].id;
  if (!PROJECT_TEMPLATE_DEFS.some((entry) => entry.id === model.project.templateId)) {
    model.project.templateId = PROJECT_TEMPLATE_DEFS[0]?.id || "top-down";
  }

  if (!model.project.buildProfiles || typeof model.project.buildProfiles !== "object") {
    model.project.buildProfiles = {};
  }

  BUILD_PROFILE_IDS.forEach((profileId) => {
    model.project.buildProfiles[profileId] = normalizeBuildConfig(model.project.buildProfiles[profileId], fallbackSceneId, profileId);
  });

  model.project.activeBuildProfile = normalizeBuildProfileId(model.project.activeBuildProfile);
  model.project.buildConfig = normalizeBuildConfig(
    model.project.buildConfig,
    fallbackSceneId,
    normalizeBuildMode(model.project.buildConfig?.mode || model.project.activeBuildProfile || "dev")
  );
}

function syncBuildSceneReferences() {
  ensureBuildDefaults();
  const fallbackSceneId = model.project.activeSceneId || model.project.scenes[0]?.id || "scene_1";

  BUILD_PROFILE_IDS.forEach((profileId) => {
    const profile = model.project.buildProfiles[profileId];
    if (!model.project.scenes.some((scene) => scene.id === profile.startScene)) {
      profile.startScene = fallbackSceneId;
    }
  });

  if (!model.project.scenes.some((scene) => scene.id === model.project.buildConfig.startScene)) {
    model.project.buildConfig.startScene = fallbackSceneId;
  }
}

function readBuildConfigInputs() {
  ensureBuildDefaults();
  const fallbackSceneId = model.project.activeSceneId || model.project.scenes[0]?.id || "scene_1";
  const startScene = String(ui.buildStartSceneSelect.value || "");

  return {
    buildName: sanitizeBuildName(ui.buildNameInput.value, ui.buildModeSelect.value),
    mode: normalizeBuildMode(ui.buildModeSelect.value),
    startScene: model.project.scenes.some((scene) => scene.id === startScene) ? startScene : fallbackSceneId,
    includeEditorUI: ui.buildIncludeEditor.checked === true,
    includeDebugPanel: ui.buildIncludeDebug.checked === true,
    compressAssets: ui.buildCompressAssets.checked === true
  };
}

function normalizeBuildProfileId(profileId) {
  const normalized = String(profileId || "").trim().toLowerCase();
  return BUILD_PROFILE_IDS.includes(normalized) ? normalized : "dev";
}

function normalizeBuildMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  return ["dev", "test", "release", "custom"].includes(normalized) ? normalized : "dev";
}

function sanitizeBuildName(value, mode) {
  const text = String(value || "").trim();
  if (!text) {
    return `cn-${normalizeBuildMode(mode)}`;
  }
  return text.slice(0, 64);
}

function normalizeBuildConfig(config, fallbackSceneId, fallbackMode) {
  const source = config && typeof config === "object" ? config : {};
  const mode = normalizeBuildMode(source.mode || fallbackMode || "dev");
  const safeStartScene = model.project.scenes.some((scene) => scene.id === source.startScene) ? source.startScene : fallbackSceneId;

  return {
    buildName: sanitizeBuildName(source.buildName, mode),
    mode,
    startScene: safeStartScene,
    includeEditorUI: source.includeEditorUI === true,
    includeDebugPanel: source.includeDebugPanel === true,
    compressAssets: source.compressAssets === true
  };
}

function clamp01(value, fallback = 0) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function buildPalette() {
  ui.tilePalette.innerHTML = "";

  TILES.forEach((tile) => {
    const button = document.createElement("button");
    button.className = "tile-btn";
    button.style.background = tile.color;
    button.innerHTML = `<span class="tile-label">${tile.id}</span>`;
    button.title = tile.name;
    button.addEventListener("click", () => {
      model.state.tileId = tile.id;
      refreshPaletteSelection();
      refreshToolLabel();
      persistEditorPrefs();
    });
    ui.tilePalette.appendChild(button);
  });

  refreshPaletteSelection();
}

function refreshPaletteSelection() {
  Array.from(ui.tilePalette.children).forEach((child, index) => {
    child.classList.toggle("active", TILES[index].id === model.state.tileId);
  });
}

function paintBrushTiles(point, tileId) {
  const center = worldToCell(model.scene, point.x, point.y);
  if (!center) {
    return;
  }

  const brushSize = Math.max(1, Math.min(8, Number.isFinite(Number(model.state.paintBrushSize)) ? Math.round(Number(model.state.paintBrushSize)) : 1));
  const brushShape = normalizePaintBrushShape(model.state.paintBrushShape);
  const tileSize = model.scene.world.tileSize;
  const cells = collectBrushCells(model.scene, center, { size: brushSize, shape: brushShape });

  cells.forEach((cell) => {
    const wx = cell.tx * tileSize + 1;
    const wy = cell.ty * tileSize + 1;
    const targetTileId = resolvePaintTileId(tileId);
    paintSceneTile(model.scene, model.state.tileMaps, model.state.tileLayer, wx, wy, targetTileId, { autoTile: model.state.autoTileEnabled !== false });
  });
}

function startPaintShapePreview(point, erase) {
  const start = worldToCell(model.scene, point.x, point.y);
  if (!start) {
    return;
  }

  model.state.paintPreview = {
    active: true,
    start,
    end: start,
    erase,
    shape: model.state.paintTool,
    brushShape: normalizePaintBrushShape(model.state.paintBrushShape),
    lineThickness: normalizePaintLineThickness(model.state.paintLineThickness)
  };
}

function updatePaintShapePreview(point) {
  if (!model.state.paintPreview.active) {
    return;
  }

  const nextCell = worldToCell(model.scene, point.x, point.y);
  if (!nextCell) {
    return;
  }

  model.state.paintPreview.end = nextCell;
}

function clearPaintShapePreview() {
  model.state.paintPreview = {
    active: false,
    start: null,
    end: null,
    erase: false,
    shape: "rect",
    brushShape: "square",
    lineThickness: 1
  };
}

function startSelectionBox(point) {
  model.state.selectionBox = {
    active: true,
    projected: true,
    start: { x: point.x, y: point.y },
    end: { x: point.x, y: point.y }
  };
}

function updateSelectionBox(point) {
  if (!model.state.selectionBox.active) {
    return;
  }

  model.state.selectionBox.end = { x: point.x, y: point.y };
}

function clearSelectionBox() {
  model.state.selectionBox = {
    active: false,
    projected: false,
    start: null,
    end: null
  };
}

function selectArea(point, options = {}) {
  const selection = model.state.selectionBox;
  if (!selection.start) {
    return;
  }

  const result = pickArea(model.scene, selection.start, point, getViewportPickOptions());
  if (!result.refs || result.refs.length === 0) {
    if (!options.toggle) {
      setSelectedRefs([]);
    }
    setStatus("Nenhum objeto encontrado na area.");
    return;
  }

  if (options.toggle) {
    const current = getSelectedRefs();
    const next = [...current];
    result.refs.forEach((ref) => {
      const index = next.findIndex((entry) => sameRef(entry, ref));
      if (index >= 0) {
        next.splice(index, 1);
      } else {
        next.push(ref);
      }
    });
    setSelectedRefs(next, result.ref);
  } else {
    setSelectedRefs(result.refs, result.ref);
  }

  if (result.count > 1) {
    setStatus(`${result.count} objetos selecionados na area.`, "ok");
  } else {
    setStatus("Objeto selecionado por area.", "ok");
  }
}

function sampleActiveLayerTile(point) {
  const tileId = getTileAt(model.scene, model.state.tileMaps, model.state.tileLayer, point.x, point.y);
  if (!tileId) {
    setStatus(`Nenhum tile encontrado na camada ${TILE_LAYER_LABELS[model.state.tileLayer]}.`);
    return;
  }

  model.state.tileId = tileId;
  refreshPaletteSelection();
  refreshToolLabel();
  persistEditorPrefs();
  setStatus(`Tile ${tileId} selecionado com o conta-gotas.`, "ok");
}

function addWall(x, y) {
  const scene = model.scene;
  const state = model.state;
  const tileSize = scene.world.tileSize;

  let created = false;

  runCommand("Adicionar Parede", () => {
    const wall = {
      id: `wall_${state.wallCounter}`,
      name: `Parede ${state.wallCounter}`,
      type: "wall",
      x: snap(x - tileSize, tileSize),
      y: snap(y - tileSize, tileSize),
      z: 0,
      w: tileSize * 2,
      h: tileSize * 2,
      color: "#7d8895"
    };

    clampWorld(wall, scene.world);

    if (!validTransform(scene, { kind: "wall", id: wall.id }, wall, state.tileMaps)) {
      setStatus("Nao foi possivel criar uma parede aqui.", "danger");
      return;
    }

    scene.walls.push(wall);
    state.wallCounter += 1;
    created = true;
    selectRef({ kind: "wall", id: wall.id });
  });

  if (created) {
    exportJson(false);
    setStatus("Parede criada.", "ok");
  }
}

function addGameplayObject(type) {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para criar objetos de jogo.", "danger");
    return;
  }

  const scene = model.scene;
  const state = model.state;
  const tileSize = scene.world.tileSize;
  const centerX = state.cam.x + state.cam.w / 2;
  const centerY = state.cam.y + state.cam.h / 2;
  let created = false;

  runCommand(`Adicionar ${getObjectDisplayLabel(type)}`, () => {
    const item = createGameplayObject(scene, state.gameplayCounter, type, {
      x: snap(centerX, tileSize),
      y: snap(centerY, tileSize)
    });

    clampWorld(item, scene.world);

    if (!validTransform(scene, { kind: "gameplayObject", id: item.id }, item, state.tileMaps)) {
      setStatus(`Nao foi possivel criar ${getObjectDisplayLabel(type).toLowerCase()} aqui.`, "danger");
      return;
    }

    scene.gameObjects.push(item);
    state.gameplayCounter += 1;
    created = true;
    selectRef({ kind: "gameplayObject", id: item.id });
  });

  if (created) {
    exportJson(false);
    setStatus(`Objeto ${getObjectDisplayLabel(type)} criado.`, "ok");
  }
}

function duplicateSelection() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para duplicar objetos.", "danger");
    return;
  }

  if (history.hasOpenTransaction()) {
    commitCommandGroup();
  }

  const selectedRefs = getSelectedRefs();
  const mutableRefs = collectMutableSceneRefs(model.scene, selectedRefs);
  if (mutableRefs.length === 0) {
    setStatus("Selecione paredes ou objetos de jogo para duplicar.", "danger");
    return;
  }

  let createdRefs = [];
  let skippedCount = Math.max(0, selectedRefs.length - mutableRefs.length);

  runCommand(mutableRefs.length > 1 ? "Duplicar Selecao" : "Duplicar Objeto", () => {
    const result = duplicateMutableSceneObjects(
      model.scene,
      mutableRefs,
      model.state.tileMaps,
      {
        wallCounter: model.state.wallCounter,
        gameplayCounter: model.state.gameplayCounter
      },
      {
        tileSize: model.scene.world.tileSize
      }
    );

    createdRefs = result.createdRefs;
    model.state.wallCounter = result.wallCounter;
    model.state.gameplayCounter = result.gameplayCounter;

    if (createdRefs.length > 0) {
      setSelectedRefs(createdRefs, createdRefs[createdRefs.length - 1]);
    }
  });

  if (createdRefs.length === 0) {
    setStatus("Nao encontrei espaco valido para duplicar a selecao.", "danger");
    return;
  }

  exportJson(false);
  const skippedSuffix = skippedCount > 0 ? ` ${skippedCount} item(ns) fixos foram ignorados.` : "";
  setStatus(`${createdRefs.length} objeto(s) duplicado(s).${skippedSuffix}`, "ok");
}

function deleteSelection() {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para remover objetos.", "danger");
    return;
  }

  if (history.hasOpenTransaction()) {
    commitCommandGroup();
  }

  const selectedRefs = getSelectedRefs();
  const mutableRefs = collectMutableSceneRefs(model.scene, selectedRefs);
  if (mutableRefs.length === 0) {
    setStatus("Selecione paredes ou objetos de jogo para remover.", "danger");
    return;
  }

  const skippedCount = Math.max(0, selectedRefs.length - mutableRefs.length);
  let removedCount = 0;

  runCommand(mutableRefs.length > 1 ? "Excluir Selecao" : "Excluir Objeto", () => {
    const result = deleteMutableSceneObjects(model.scene, mutableRefs);
    removedCount = result.removedCount;

    const remainingRefs = selectedRefs.filter((ref) => !mutableRefs.some((entry) => sameRef(entry, ref)));
    if (remainingRefs.length > 0) {
      setSelectedRefs(remainingRefs, remainingRefs[remainingRefs.length - 1]);
    } else {
      syncSelectionState();
      refreshList();
      refreshInspector();
    }

    refreshSelectionActionButtons();
  });

  if (removedCount === 0) {
    setStatus("Nenhum objeto foi removido.", "danger");
    return;
  }

  exportJson(false);
  const skippedSuffix = skippedCount > 0 ? ` ${skippedCount} item(ns) fixos foram preservados.` : "";
  setStatus(`${removedCount} objeto(s) removido(s).${skippedSuffix}`, "ok");
}

function alignSelection(mode) {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para alinhar objetos.", "danger");
    return;
  }

  const selectedRefs = getSelectedRefs();
  const selectedObjects = selectedRefs.map((ref) => getObjectByRef(model.scene, ref)).filter(Boolean);
  if (selectedObjects.length < 2) {
    setStatus("Selecione ao menos 2 objetos para alinhar.", "danger");
    return;
  }

  const nextObjects = alignSelectionEntries(selectedObjects, mode);
  const applied = applySelectionLayoutChanges(selectedRefs, selectedObjects, nextObjects, `Alinhar ${getAlignmentModeLabel(mode)}`);
  if (!applied) {
    setStatus("Nao foi possivel alinhar a selecao sem colisao.", "danger");
    return;
  }

  setStatus(`Selecao alinhada (${getAlignmentModeLabel(mode)}).`, "ok");
}

function distributeSelection(axis) {
  if (model.state.mode !== "edit") {
    setStatus("Volte para EDITAR para distribuir objetos.", "danger");
    return;
  }

  const selectedRefs = getSelectedRefs();
  const selectedObjects = selectedRefs.map((ref) => getObjectByRef(model.scene, ref)).filter(Boolean);
  if (selectedObjects.length < 3) {
    setStatus("Selecione ao menos 3 objetos para distribuir.", "danger");
    return;
  }

  const nextObjects = distributeSelectionEntries(selectedObjects, axis);
  const applied = applySelectionLayoutChanges(selectedRefs, selectedObjects, nextObjects, axis === "x" ? "Distribuir H" : "Distribuir V");
  if (!applied) {
    setStatus("Nao foi possivel distribuir a selecao sem colisao.", "danger");
    return;
  }

  setStatus(`Selecao distribuida no eixo ${axis.toUpperCase()}.`, "ok");
}

function hitGroupHandle(viewPoint, worldPoint) {
  const selectedObjects = getSelectedObjects();
  if (selectedObjects.length < 2) {
    return null;
  }

  if (model.state.viewportRenderer === "native-3d" || normalizeSceneSpaceMode(model.scene?.space?.mode) === "3d-preview") {
    const projectedBounds = getProjectedSelectionBounds(selectedObjects);
    return getGroupHandleAtPoint(projectedBounds, viewPoint, { pad: 6, radius: 10 });
  }

  const bounds = getSelectionBounds(selectedObjects);
  return getGroupHandleAtPoint(bounds, worldPoint || viewPoint, { pad: 6, radius: 10 });
}

function applySelectionLayoutChanges(selectedRefs, selectedObjects, nextObjects, label) {
  let changed = false;
  let blocked = false;

  runCommand(label, () => {
    const candidates = buildSelectionCandidates(selectedRefs, selectedObjects, nextObjects);
    if (!validateSelectionCandidates(candidates, selectedRefs)) {
      blocked = true;
      return;
    }

    applySelectionCandidates(candidates);
    changed = true;
  });

  if (changed) {
    const finalBounds = getSelectionBounds(nextObjects);
    if (finalBounds) {
      const exactGuides = snapMoveBounds(finalBounds, collectSnapLines(getSnapTargetObjects(selectedRefs), model.scene.world), { threshold: 0 });
      setSnapGuides(exactGuides.guides, 0.65);
    }
    refreshInspector();
    refreshList();
    exportJson(false);
  }

  return changed && !blocked;
}

function buildSelectionCandidates(selectedRefs, selectedObjects, nextObjects) {
  return selectedRefs
    .map((ref, index) => {
      const object = selectedObjects[index];
      const nextObject = nextObjects[index];
      if (!object || !nextObject) {
        return null;
      }

      const candidate = {
        ...object,
        x: Math.round(nextObject.x),
        y: Math.round(nextObject.y),
        w: Math.max(8, Math.round(nextObject.w)),
        h: Math.max(8, Math.round(nextObject.h))
      };

      if (ref.kind === "wall" || ref.kind === "gameplayObject") {
        candidate.x = snap(candidate.x, model.scene.world.tileSize);
        candidate.y = snap(candidate.y, model.scene.world.tileSize);
        candidate.w = Math.max(model.scene.world.tileSize, snap(candidate.w, model.scene.world.tileSize) || model.scene.world.tileSize);
        candidate.h = Math.max(model.scene.world.tileSize, snap(candidate.h, model.scene.world.tileSize) || model.scene.world.tileSize);
      }

      clampWorld(candidate, model.scene.world);
      return { ref, object, candidate };
    })
    .filter(Boolean);
}

function snapSelectionMoveCandidates(candidates, selectedRefs) {
  const bounds = getSelectionBounds(candidates.map((entry) => entry.candidate));
  if (!bounds) {
    clearSnapGuides();
    return null;
  }

  const snapLines = collectSnapLines(getSnapTargetObjects(selectedRefs), model.scene.world);
  const snapped = snapMoveBounds(bounds, snapLines, { threshold: Math.max(8, Math.round(model.scene.world.tileSize / 4)) });
  setSnapGuides(snapped.guides);

  if (!snapped.deltaX && !snapped.deltaY) {
    return candidates;
  }

  return candidates.map((entry) => ({
    ...entry,
    candidate: {
      ...entry.candidate,
      x: Math.round(entry.candidate.x + snapped.deltaX),
      y: Math.round(entry.candidate.y + snapped.deltaY)
    }
  }));
}

function snapResizedEntries(entries, handle, selectedRefs) {
  const bounds = getSelectionBounds(entries);
  if (!bounds) {
    clearSnapGuides();
    return entries;
  }

  const snapLines = collectSnapLines(getSnapTargetObjects(selectedRefs), model.scene.world);
  const snapped = snapResizeBounds(bounds, handle, snapLines, { threshold: Math.max(8, Math.round(model.scene.world.tileSize / 4)) });
  setSnapGuides(snapped.guides);

  if (snapped.bounds.x === bounds.x && snapped.bounds.y === bounds.y && snapped.bounds.w === bounds.w && snapped.bounds.h === bounds.h) {
    return entries;
  }

  const scaleX = bounds.w === 0 ? 1 : snapped.bounds.w / bounds.w;
  const scaleY = bounds.h === 0 ? 1 : snapped.bounds.h / bounds.h;

  return entries.map((entry) => {
    const relLeft = (entry.x - bounds.x) / Math.max(1, bounds.w);
    const relTop = (entry.y - bounds.y) / Math.max(1, bounds.h);
    const relRight = (entry.x + entry.w - bounds.x) / Math.max(1, bounds.w);
    const relBottom = (entry.y + entry.h - bounds.y) / Math.max(1, bounds.h);

    const nextX = snapped.bounds.x + relLeft * snapped.bounds.w;
    const nextY = snapped.bounds.y + relTop * snapped.bounds.h;
    const nextRight = snapped.bounds.x + relRight * snapped.bounds.w;
    const nextBottom = snapped.bounds.y + relBottom * snapped.bounds.h;

    return {
      ...entry,
      x: Math.round(nextX),
      y: Math.round(nextY),
      w: Math.max(8, Math.round(nextRight - nextX)),
      h: Math.max(8, Math.round(nextBottom - nextY)),
      scaleX,
      scaleY
    };
  });
}

function validateSelectionCandidates(candidates, ignoreRefs) {
  const scene = model.scene;
  const valid = candidates.every((entry) => validTransform(scene, entry.ref, entry.candidate, model.state.tileMaps, { ignoreRefs }));
  if (!valid) {
    return false;
  }

  for (let index = 0; index < candidates.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      const left = candidates[index];
      const right = candidates[otherIndex];

      if (!sameRef(left.ref, right.ref) && overlap(left.candidate, right.candidate) && isSolidPairBlocked(left, right)) {
        return false;
      }
    }
  }

  return true;
}

function isSolidPairBlocked(left, right) {
  const leftSolid = left.ref.kind === "wall" || (left.ref.kind === "gameplayObject" && left.candidate.colliderEnabled !== false && left.candidate.colliderIsTrigger !== true);
  const rightSolid = right.ref.kind === "wall" || (right.ref.kind === "gameplayObject" && right.candidate.colliderEnabled !== false && right.candidate.colliderIsTrigger !== true);
  const wallAgainstEntity = (left.ref.kind === "wall" && right.ref.kind === "entity") || (left.ref.kind === "entity" && right.ref.kind === "wall");
  const wallAgainstGameplay = (left.ref.kind === "wall" && rightSolid) || (right.ref.kind === "wall" && leftSolid);
  return wallAgainstEntity || wallAgainstGameplay || (left.ref.kind === "wall" && right.ref.kind === "wall");
}

function resolveObjectByParentRef(parentRef) {
  const clean = String(parentRef || "").trim();
  if (!clean.includes(":")) {
    return null;
  }

  const [kind, id] = clean.split(":");
  if (!kind || !id) {
    return null;
  }

  return getObjectByRef(model.scene, { kind, id });
}

function getSceneHierarchyEntries() {
  return [
    { ref: { kind: "entity", id: "player" }, object: model.scene.player },
    { ref: { kind: "entity", id: "enemy" }, object: model.scene.enemy },
    ...model.scene.walls.map((wall) => ({ ref: { kind: "wall", id: wall.id }, object: wall })),
    ...model.scene.gameObjects.map((item) => ({ ref: { kind: "gameplayObject", id: item.id }, object: item }))
  ];
}

function refreshParentOffsetForObject(object) {
  if (!object || typeof object !== "object") {
    return;
  }

  const parent = resolveObjectByParentRef(object.parentRef);
  if (!parent || parent === object) {
    object.parentRef = "";
    object.parentOffsetX = 0;
    object.parentOffsetY = 0;
    object.parentOffsetZ = 0;
    return;
  }

  object.parentOffsetX = Number(object.x || 0) - Number(parent.x || 0);
  object.parentOffsetY = Number(object.y || 0) - Number(parent.y || 0);
  object.parentOffsetZ = Number(object.z || 0) - Number(parent.z || 0);
}

function applyParentDelta(changes) {
  const sourceChanges = Array.isArray(changes) ? changes : [];
  const normalized = sourceChanges
    .map((entry) => ({
      key: `${entry?.ref?.kind}:${entry?.ref?.id}`,
      dx: Number(entry?.dx || 0),
      dy: Number(entry?.dy || 0),
      dz: Number(entry?.dz || 0)
    }))
    .filter((entry) => entry.key.includes(":") && (entry.dx !== 0 || entry.dy !== 0 || entry.dz !== 0));

  if (normalized.length === 0) {
    return;
  }

  const entries = getSceneHierarchyEntries();
  const childrenByParent = new Map();
  entries.forEach((entry) => {
    const parentRef = String(entry.object?.parentRef || "").trim();
    if (!parentRef) {
      return;
    }
    if (!childrenByParent.has(parentRef)) {
      childrenByParent.set(parentRef, []);
    }
    childrenByParent.get(parentRef).push(entry);
  });

  const selectedKeys = new Set(normalized.map((entry) => entry.key));
  const queue = normalized.map((entry) => ({ ...entry, depth: 0 }));
  const applied = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const children = childrenByParent.get(current.key) || [];
    children.forEach((child) => {
      const childKey = `${child.ref.kind}:${child.ref.id}`;
      if (selectedKeys.has(childKey)) {
        return;
      }

      const applyKey = `${current.key}->${childKey}`;
      if (applied.has(applyKey) || current.depth > 24) {
        return;
      }
      applied.add(applyKey);

      child.object.x = Math.round(Number(child.object.x || 0) + current.dx);
      child.object.y = Math.round(Number(child.object.y || 0) + current.dy);
      child.object.z = Number(child.object.z || 0) + current.dz;
      if (child.ref.kind === "wall" || child.ref.kind === "gameplayObject") {
        child.object.x = snap(child.object.x, model.scene.world.tileSize);
        child.object.y = snap(child.object.y, model.scene.world.tileSize);
      }
      clampWorld(child.object, model.scene.world);

      queue.push({
        key: childKey,
        dx: current.dx,
        dy: current.dy,
        dz: current.dz,
        depth: current.depth + 1
      });
    });
  }
}

function applySelectionCandidates(candidates) {
  const changes = [];
  candidates.forEach((entry) => {
    const beforeX = entry.object.x;
    const beforeY = entry.object.y;
    const beforeZ = Number(entry.object.z || 0);
    entry.object.x = entry.candidate.x;
    entry.object.y = entry.candidate.y;
    entry.object.w = entry.candidate.w;
    entry.object.h = entry.candidate.h;
    const dx = Number(entry.object.x || 0) - Number(beforeX || 0);
    const dy = Number(entry.object.y || 0) - Number(beforeY || 0);
    const dz = Number(entry.object.z || 0) - beforeZ;
    if (dx !== 0 || dy !== 0 || dz !== 0) {
      changes.push({ ref: entry.ref, dx, dy, dz });
    }
    refreshParentOffsetForObject(entry.object);
  });

  applyParentDelta(changes);
}

function handleDragMove({ mode, handle, ref, refs, point, viewportPoint, offset }) {
  if (mode === "resizeGroup") {
    handleResizeSelection({ refs, handle, point, viewportPoint });
    return;
  }

  const scene = model.scene;
  const leadObject = getObjectByRef(scene, ref);
  const dragRefs = Array.isArray(refs) && refs.length > 0 ? refs : [ref];

  if (!leadObject) {
    return;
  }

  if (!model.state.drag.startPositions) {
    model.state.drag.startPositions = dragRefs
      .map((entry) => {
        const object = getObjectByRef(scene, entry);
        return object ? { ref: { ...entry }, x: object.x, y: object.y, z: object.z || 0, w: object.w, h: object.h } : null;
      })
      .filter(Boolean);
  }

  const leadStart = model.state.drag.startPositions.find((entry) => sameRef(entry.ref, ref));
  if (!leadStart) {
    return;
  }

  let nextLeadX = Math.round(point.x - offset.x);
  let nextLeadY = Math.round(point.y - offset.y);

  if (ref.kind === "wall" || ref.kind === "gameplayObject") {
    nextLeadX = snap(nextLeadX, scene.world.tileSize);
    nextLeadY = snap(nextLeadY, scene.world.tileSize);
  }

  const deltaX = nextLeadX - leadStart.x;
  const deltaY = nextLeadY - leadStart.y;
  const candidates = model.state.drag.startPositions.map((entry) => {
    const object = getObjectByRef(scene, entry.ref);
    if (!object) {
      return null;
    }

    const candidate = {
      ...object,
      x: Math.round(entry.x + deltaX),
      y: Math.round(entry.y + deltaY)
    };

    if (entry.ref.kind === "wall" || entry.ref.kind === "gameplayObject") {
      candidate.x = snap(candidate.x, scene.world.tileSize);
      candidate.y = snap(candidate.y, scene.world.tileSize);
    }

    clampWorld(candidate, scene.world);
    return { ref: entry.ref, object, candidate };
  }).filter(Boolean);

  const snappedCandidates = snapSelectionMoveCandidates(candidates, dragRefs);
  const effectiveCandidates = snappedCandidates || candidates;

  const valid = effectiveCandidates.every((entry) => validTransform(scene, entry.ref, entry.candidate, model.state.tileMaps, { ignoreRefs: dragRefs }));
  if (!valid) {
    clearSnapGuides();
    return;
  }

  applySelectionCandidates(effectiveCandidates);

  refreshInspector();
  refreshList();
}

function handleResizeSelection({ refs, handle, point, viewportPoint }) {
  const scene = model.scene;
  const selectedRefs = Array.isArray(refs) && refs.length > 0 ? refs : getSelectedRefs();
  const selectedObjects = selectedRefs.map((ref) => getObjectByRef(scene, ref)).filter(Boolean);
  if (selectedObjects.length < 2 || !handle) {
    return;
  }

  if (!model.state.drag.startPositions) {
    model.state.drag.startPositions = selectedRefs
      .map((ref, index) => {
        const object = selectedObjects[index];
        return object ? { ref: { ...ref }, x: object.x, y: object.y, z: object.z || 0, w: object.w, h: object.h } : null;
      })
      .filter(Boolean);
  }

  const useProjectedResize = !!viewportPoint && (model.state.viewportRenderer === "native-3d" || normalizeSceneSpaceMode(scene?.space?.mode) === "3d-preview");
  const startEntries = model.state.drag.startPositions.map((entry) => ({ ...entry, __selectionLayoutId: `${entry.ref.kind}:${entry.ref.id}` }));
  const resizedBase = useProjectedResize
    ? (() => {
        const projectedEntries = getProjectedResizeEntries(startEntries);
        const projectedBounds = getSelectionBounds(projectedEntries);
        const resizedProjectedEntries = resizeSelectionEntries(projectedEntries, handle, viewportPoint, { minSize: 8 });
        const resizedProjectedBounds = getSelectionBounds(resizedProjectedEntries);
        const worldBounds = getSelectionBounds(startEntries);
        if (!projectedBounds || !resizedProjectedBounds || !worldBounds) {
          return startEntries;
        }

        const scaleX = projectedBounds.w === 0 ? 1 : resizedProjectedBounds.w / projectedBounds.w;
        const scaleY = projectedBounds.h === 0 ? 1 : resizedProjectedBounds.h / projectedBounds.h;
        const nextWorldBounds = scaleBoundsByHandle(worldBounds, scaleX, scaleY, handle, 8);
        return scaleEntriesToBounds(startEntries, nextWorldBounds, 8);
      })()
    : resizeSelectionEntries(startEntries, handle, point, { minSize: 8 });
  const resized = snapResizedEntries(
    resizedBase.map(({ __selectionLayoutId, scaleX, scaleY, ...entry }) => entry),
    handle,
    selectedRefs
  );
  const sourceObjects = model.state.drag.startPositions.map((entry) => ({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }));
  const candidates = buildSelectionCandidates(selectedRefs, selectedObjects, resized.length === sourceObjects.length ? resized : sourceObjects);
  if (!validateSelectionCandidates(candidates, selectedRefs)) {
    clearSnapGuides();
    return;
  }

  applySelectionCandidates(candidates);
  refreshInspector();
  refreshList();
}

function commitInspector() {
  const scene = model.scene;
  const state = model.state;

  if (state.mode !== "edit") {
    return;
  }

  const selectedRefs = getSelectedRefs();
  const selectedObjects = selectedRefs.map((ref) => getObjectByRef(scene, ref)).filter(Boolean);
  if (selectedObjects.length === 0) {
    return;
  }

  let blocked = false;

  runCommand("Transform do Inspector", () => {
    const next = readInspectorValues(ui.f, selectedObjects);

    if (next.isMulti) {
      const bounds = getSelectionBounds(selectedObjects);
      const deltaX = next.x - bounds.x;
      const deltaY = next.y - bounds.y;
      const snapshots = selectedRefs.map((ref, index) => ({
        ref,
        object: selectedObjects[index],
        old: { x: selectedObjects[index].x, y: selectedObjects[index].y }
      }));

      const candidates = snapshots.map((entry) => {
        const candidate = {
          ...entry.object,
          x: Math.round(entry.old.x + deltaX),
          y: Math.round(entry.old.y + deltaY)
        };
        if (entry.ref.kind === "wall" || entry.ref.kind === "gameplayObject") {
          candidate.x = snap(candidate.x, scene.world.tileSize);
          candidate.y = snap(candidate.y, scene.world.tileSize);
        }
        clampWorld(candidate, scene.world);
        return { ...entry, candidate };
      });

      const valid = candidates.every((entry) => validTransform(scene, entry.ref, entry.candidate, state.tileMaps, { ignoreRefs: selectedRefs }));
      if (!valid) {
        blocked = true;
        return;
      }

      applySelectionCandidates(candidates);
      return;
    }

    const selectedObject = selectedObjects[0];
    const old = {
      x: selectedObject.x,
      y: selectedObject.y,
      z: selectedObject.z,
      w: selectedObject.w,
      h: selectedObject.h,
      spawnTag: selectedObject.spawnTag,
      teamId: selectedObject.teamId,
      priority: selectedObject.priority,
      triggerTag: selectedObject.triggerTag,
      conditionType: selectedObject.conditionType,
      conditionTargetTag: selectedObject.conditionTargetTag,
      conditionValue: selectedObject.conditionValue,
      actionType: selectedObject.actionType,
      actionValue: selectedObject.actionValue,
      actionSceneId: selectedObject.actionSceneId,
      actionSpawnTag: selectedObject.actionSpawnTag,
      actionTargetTag: selectedObject.actionTargetTag,
      actionTimelineId: selectedObject.actionTimelineId,
      actions: clone(selectedObject.actions || []),
      once: selectedObject.once,
      enabled: selectedObject.enabled,
      doorTag: selectedObject.doorTag,
      startsOpen: selectedObject.startsOpen,
      isOpen: selectedObject.isOpen,
      targetSceneId: selectedObject.targetSceneId,
      targetSpawnTag: selectedObject.targetSpawnTag,
      targetTeamId: selectedObject.targetTeamId,
      fallbackMode: selectedObject.fallbackMode,
      checkpointId: selectedObject.checkpointId,
      sortingLayer: selectedObject.sortingLayer,
      orderInLayer: selectedObject.orderInLayer,
      spriteId: selectedObject.spriteId,
      flipX: selectedObject.flipX,
      flipY: selectedObject.flipY,
      pivotX: selectedObject.pivotX,
      pivotY: selectedObject.pivotY,
      animationId: selectedObject.animationId,
      animationFps: selectedObject.animationFps,
      animationLoop: selectedObject.animationLoop,
      animationMode: selectedObject.animationMode,
      animationPlaying: selectedObject.animationPlaying,
      animationOffset: selectedObject.animationOffset,
      spriteOpacity: selectedObject.spriteOpacity,
      rigidbodyType: selectedObject.rigidbodyType,
      gravityScale: selectedObject.gravityScale,
      linearDamping: selectedObject.linearDamping,
      restitution: selectedObject.restitution,
      colliderEnabled: selectedObject.colliderEnabled,
      colliderIsTrigger: selectedObject.colliderIsTrigger,
      colliderOffsetX: selectedObject.colliderOffsetX,
      colliderOffsetY: selectedObject.colliderOffsetY,
      colliderW: selectedObject.colliderW,
      colliderH: selectedObject.colliderH,
      prefabRef: selectedObject.prefabRef,
      parentRef: selectedObject.parentRef,
      parentOffsetX: selectedObject.parentOffsetX,
      parentOffsetY: selectedObject.parentOffsetY,
      parentOffsetZ: selectedObject.parentOffsetZ,
      bones2D: selectedObject.bones2D,
      bonesAnimate: selectedObject.bonesAnimate,
      shapePoints: selectedObject.shapePoints,
      shapeClosed: selectedObject.shapeClosed,
      shapeSmooth: selectedObject.shapeSmooth,
      shapeSegments: selectedObject.shapeSegments,
      shapeFill: selectedObject.shapeFill,
      shapeStroke: selectedObject.shapeStroke,
      shapeThickness: selectedObject.shapeThickness,
      cameraZonePriority: selectedObject.cameraZonePriority,
      cameraZoneZoom: selectedObject.cameraZoneZoom,
      cameraZoneOffsetX: selectedObject.cameraZoneOffsetX,
      cameraZoneOffsetY: selectedObject.cameraZoneOffsetY,
      shakeOnEnter: selectedObject.shakeOnEnter,
      shakeIntensity: selectedObject.shakeIntensity,
      shakeDuration: selectedObject.shakeDuration,
      shakeFrequency: selectedObject.shakeFrequency,
      lightRadius: selectedObject.lightRadius,
      lightIntensity: selectedObject.lightIntensity,
      lightColor: selectedObject.lightColor,
      lightFlicker: selectedObject.lightFlicker,
      castShadows: selectedObject.castShadows
    };

    selectedObject.x = next.x;
    selectedObject.y = next.y;
    selectedObject.z = clampSceneDepth(next.z, scene.world);
    selectedObject.w = next.w;
    selectedObject.h = next.h;

    const meta = mapMetaEntries(next.metaEntries);

    if (selectedObject.type === "trigger") {
      selectedObject.triggerTag = String(meta.triggerTag || "");
      selectedObject.conditionType = String(meta.conditionType || "always");
      selectedObject.conditionTargetTag = String(meta.conditionTargetTag || "");
      selectedObject.conditionValue = String(meta.conditionValue || "");
      selectedObject.interactionOnly = meta.interactionOnly === true;
      selectedObject.once = meta.once === true;
      selectedObject.enabled = meta.enabled !== false;
      selectedObject.actions = buildTriggerActionsFromMeta(meta);
      syncLegacyTriggerFields(selectedObject);
    } else {
      next.metaEntries.forEach((entry) => {
        selectedObject[entry.key] = entry.value;
      });
      selectedObject.orderInLayer = Number.isFinite(Number(selectedObject.orderInLayer)) ? Math.round(Number(selectedObject.orderInLayer)) : 0;
      selectedObject.pivotX = clamp01(selectedObject.pivotX, 0);
      selectedObject.pivotY = clamp01(selectedObject.pivotY, 0);
      selectedObject.animationId = String(selectedObject.animationId || "");
      selectedObject.animationFps = Math.max(1, Number.isFinite(Number(selectedObject.animationFps)) ? Number(selectedObject.animationFps) : 8);
      selectedObject.animationLoop = selectedObject.animationLoop !== false;
      selectedObject.animationMode = ["loop", "once", "pingpong"].includes(String(selectedObject.animationMode || "").toLowerCase())
        ? String(selectedObject.animationMode).toLowerCase()
        : "loop";
      selectedObject.animationPlaying = selectedObject.animationPlaying !== false;
      selectedObject.animationOffset = Number.isFinite(Number(selectedObject.animationOffset)) ? Number(selectedObject.animationOffset) : 0;
      selectedObject.spriteOpacity = clamp01(selectedObject.spriteOpacity, 1);
      selectedObject.rigidbodyType = RIGIDBODY_TYPES.includes(String(selectedObject.rigidbodyType || "").toLowerCase()) ? String(selectedObject.rigidbodyType).toLowerCase() : "static";
      selectedObject.gravityScale = Number.isFinite(Number(selectedObject.gravityScale)) ? Number(selectedObject.gravityScale) : 0;
      selectedObject.linearDamping = Math.max(0, Number.isFinite(Number(selectedObject.linearDamping)) ? Number(selectedObject.linearDamping) : 0);
      selectedObject.restitution = clamp01(selectedObject.restitution, 0);
      selectedObject.colliderEnabled = selectedObject.colliderEnabled !== false;
      selectedObject.colliderIsTrigger = selectedObject.colliderEnabled && selectedObject.colliderIsTrigger === true;
      selectedObject.colliderOffsetX = Number.isFinite(Number(selectedObject.colliderOffsetX)) ? Number(selectedObject.colliderOffsetX) : 0;
      selectedObject.colliderOffsetY = Number.isFinite(Number(selectedObject.colliderOffsetY)) ? Number(selectedObject.colliderOffsetY) : 0;
      selectedObject.colliderW = Math.max(4, Number.isFinite(Number(selectedObject.colliderW)) ? Number(selectedObject.colliderW) : selectedObject.w);
      selectedObject.colliderH = Math.max(4, Number.isFinite(Number(selectedObject.colliderH)) ? Number(selectedObject.colliderH) : selectedObject.h);
      selectedObject.prefabRef = String(selectedObject.prefabRef || "");
      selectedObject.parentRef = String(selectedObject.parentRef || "");
      selectedObject.parentOffsetX = Number.isFinite(Number(selectedObject.parentOffsetX)) ? Number(selectedObject.parentOffsetX) : 0;
      selectedObject.parentOffsetY = Number.isFinite(Number(selectedObject.parentOffsetY)) ? Number(selectedObject.parentOffsetY) : 0;
      selectedObject.parentOffsetZ = Number.isFinite(Number(selectedObject.parentOffsetZ)) ? Number(selectedObject.parentOffsetZ) : 0;
      selectedObject.bones2D = String(selectedObject.bones2D || "");
      selectedObject.bonesAnimate = selectedObject.bonesAnimate === true;
      selectedObject.shapeSmooth = selectedObject.shapeSmooth !== false;
      selectedObject.shapeSegments = Math.max(2, Number.isFinite(Number(selectedObject.shapeSegments)) ? Math.round(Number(selectedObject.shapeSegments)) : 12);
      selectedObject.shapeThickness = Math.max(1, Number.isFinite(Number(selectedObject.shapeThickness)) ? Number(selectedObject.shapeThickness) : 3);
      selectedObject.cameraZonePriority = Number.isFinite(Number(selectedObject.cameraZonePriority)) ? Math.round(Number(selectedObject.cameraZonePriority)) : 0;
      selectedObject.cameraZoneZoom = Math.max(0, Math.min(3, Number.isFinite(Number(selectedObject.cameraZoneZoom)) ? Number(selectedObject.cameraZoneZoom) : 0));
      selectedObject.cameraZoneOffsetX = Number.isFinite(Number(selectedObject.cameraZoneOffsetX)) ? Number(selectedObject.cameraZoneOffsetX) : 0;
      selectedObject.cameraZoneOffsetY = Number.isFinite(Number(selectedObject.cameraZoneOffsetY)) ? Number(selectedObject.cameraZoneOffsetY) : 0;
      selectedObject.shakeOnEnter = selectedObject.shakeOnEnter === true;
      selectedObject.shakeIntensity = Math.max(0, Number.isFinite(Number(selectedObject.shakeIntensity)) ? Number(selectedObject.shakeIntensity) : 14);
      selectedObject.shakeDuration = Math.max(0.01, Number.isFinite(Number(selectedObject.shakeDuration)) ? Number(selectedObject.shakeDuration) : 0.28);
      selectedObject.shakeFrequency = Math.max(1, Number.isFinite(Number(selectedObject.shakeFrequency)) ? Number(selectedObject.shakeFrequency) : 32);
      selectedObject.lightRadius = Math.max(16, Number.isFinite(Number(selectedObject.lightRadius)) ? Number(selectedObject.lightRadius) : 180);
      selectedObject.lightIntensity = clamp01(selectedObject.lightIntensity, 0.92);
      selectedObject.lightColor = String(selectedObject.lightColor || selectedObject.color || "#ffe3a6");
      selectedObject.lightFlicker = clamp01(selectedObject.lightFlicker, 0);
      selectedObject.castShadows = selectedObject.castShadows !== false;
      if (selectedObject.type === "cameraZone") {
        selectedObject.colliderEnabled = selectedObject.colliderEnabled !== false;
        selectedObject.colliderIsTrigger = true;
      }
      if (selectedObject.type === "door") {
        selectedObject.startsOpen = selectedObject.startsOpen === true;
        selectedObject.isOpen = selectedObject.startsOpen;
      }
    }

    refreshParentOffsetForObject(selectedObject);
    clampWorld(selectedObject, scene.world);

    if (!validTransform(scene, state.selected, selectedObject, state.tileMaps)) {
      Object.assign(selectedObject, old);
      blocked = true;
      return;
    }

    const deltaX = Number(selectedObject.x || 0) - Number(old.x || 0);
    const deltaY = Number(selectedObject.y || 0) - Number(old.y || 0);
    const deltaZ = Number(selectedObject.z || 0) - Number(old.z || 0);
    if ((deltaX !== 0 || deltaY !== 0 || deltaZ !== 0) && state.selected) {
      applyParentDelta([{ ref: state.selected, dx: deltaX, dy: deltaY, dz: deltaZ }]);
    }
  });

  if (blocked) {
    setStatus("Transform bloqueado por colisao.", "danger");
  }

  refreshInspector();
  refreshList();
  exportJson(false);
}

function exportJson(notify) {
  ui.json.value = JSON.stringify(model.project, null, 2);
  if (notify) {
    setStatus("JSON do projeto exportado.", "ok");
  }
}

function importJson() {
  let data;
  try {
    data = JSON.parse(ui.json.value);
  } catch {
    setStatus("JSON invalido.", "danger");
    return;
  }

  const checkedProject = validateProject(data);
  if (!checkedProject.ok) {
    setStatus(`Erro no JSON: ${checkedProject.message}`, "danger");
    return;
  }

  runCommand("Importar JSON", () => {
    model.project = checkedProject.project;
    resetActiveSceneView();
    applySavedPreferences();
  });

  refreshAll();
  const scenes3dCount = Array.isArray(model.project?.scenes3d) ? model.project.scenes3d.length : 0;
  setStatus(`Projeto carregado com ${model.project.scenes.length} cena(s) 2D e ${scenes3dCount} cena(s) 3D.`, "ok");
}

function createEditorSnapshot() {
  return {
    project: clone(model.project),
    selected: model.state.selected ? { ...model.state.selected } : null,
    selectedRefs: getSelectedRefs(),
    selectedPrefabId: String(model.state.selectedPrefabId || ""),
    wallCounter: model.state.wallCounter,
    gameplayCounter: model.state.gameplayCounter
  };
}

function restoreEditorSnapshot(snapshot) {
  model.project = clone(snapshot.project);
  syncActiveScene();
  model.state.selected = snapshot.selected ? { ...snapshot.selected } : { kind: "entity", id: "player" };
  model.state.selectedRefs = Array.isArray(snapshot.selectedRefs) ? snapshot.selectedRefs.map((ref) => ({ ...ref })) : model.state.selected ? [{ ...model.state.selected }] : [];
  model.state.selectedPrefabId = String(snapshot.selectedPrefabId || "");
  model.state.wallCounter = snapshot.wallCounter;
  model.state.gameplayCounter = snapshot.gameplayCounter;
  rebuildTileMap(model.scene, model.state.tileMaps);
  syncSelectionState({ allowEmpty: !snapshot.selected && (!snapshot.selectedRefs || snapshot.selectedRefs.length === 0) });
  clearPaintShapePreview();
  clearSelectionBox();
  clearSnapGuides();
  refreshAll();
}

function isEditorSnapshotEqual(a, b) {
  if (a.wallCounter !== b.wallCounter || a.gameplayCounter !== b.gameplayCounter) {
    return false;
  }

  if (String(a.selectedPrefabId || "") !== String(b.selectedPrefabId || "")) {
    return false;
  }

  if (!sameRef(a.selected, b.selected)) {
    return false;
  }

  if (JSON.stringify(a.selectedRefs || []) !== JSON.stringify(b.selectedRefs || [])) {
    return false;
  }

  return JSON.stringify(a.project) === JSON.stringify(b.project);
}

function runCommand(label, mutator) {
  const before = createEditorSnapshot();
  mutator();
  const after = createEditorSnapshot();
  return history.record(label, before, after);
}

function beginCommandGroup(label) {
  history.begin(label, createEditorSnapshot());
}

function commitCommandGroup() {
  clearPaintShapePreview();
  clearSelectionBox();
  clearSnapGuides();
  return history.commit(createEditorSnapshot());
}

function undoCommand() {
  if (model.state.mode !== "edit") {
    setStatus("Saia do JOGAR para usar Desfazer/Refazer.", "danger");
    return;
  }

  if (history.hasOpenTransaction()) {
    commitCommandGroup();
  }

  const entry = history.undo((snapshot) => {
    restoreEditorSnapshot(snapshot);
  });

  if (!entry) {
    setStatus("Nada para desfazer.");
    return;
  }

  setStatus(`Undo: ${entry.label}`, "ok");
}

function redoCommand() {
  if (model.state.mode !== "edit") {
    setStatus("Saia do JOGAR para usar Desfazer/Refazer.", "danger");
    return;
  }

  if (history.hasOpenTransaction()) {
    commitCommandGroup();
  }

  const entry = history.redo((snapshot) => {
    restoreEditorSnapshot(snapshot);
  });

  if (!entry) {
    setStatus("Nada para refazer.");
    return;
  }

  setStatus(`Redo: ${entry.label}`, "ok");
}

function applyHistoryUi() {
  const isEditMode = model.state.mode === "edit";

  ui.btnUndo.disabled = !isEditMode || !historyMeta.canUndo;
  ui.btnRedo.disabled = !isEditMode || !historyMeta.canRedo;

  ui.btnUndo.title = historyMeta.undoLabel ? `Desfazer: ${historyMeta.undoLabel}` : "Nada para desfazer";
  ui.btnRedo.title = historyMeta.redoLabel ? `Refazer: ${historyMeta.redoLabel}` : "Nada para refazer";
}

function setStatus(message, tone = "normal") {
  ui.status.textContent = message;
  ui.status.style.color = tone === "danger" ? "#f7766e" : tone === "ok" ? "#6ddfa3" : "#9fb5c7";
}
