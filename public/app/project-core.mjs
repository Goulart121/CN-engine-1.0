import { PROJECT_VERSION, TRIGGER_ACTION_TYPES } from "./constants.mjs";
import { createDefaultScene, createGameplayObject, sanitizeVariableMeta, sanitizeVariables, validateScene } from "./core-scene.mjs";
import { createDefaultScene3D, nextScene3DId, nextScene3DName, sanitizeScenes3D } from "./scene3d-core.mjs";
import { clone } from "./utils.mjs";

export const BUILD_PROFILE_IDS = ["dev", "test", "release"];

export const PROJECT_TEMPLATE_DEFS = [
  { id: "top-down", label: "Top-Down", description: "Mapa aberto para exploracao com foco em movimentacao livre." },
  { id: "plataforma", label: "Plataforma", description: "Cena com plataformas lineares e fluxo horizontal." },
  { id: "arena", label: "Arena", description: "Combate concentrado em espaco fechado." },
  { id: "puzzle", label: "Puzzle", description: "Cena guiada por gatilho, porta e checkpoints." }
];

const DEMO_SPRITE_ATLAS = {
  id: "demo",
  name: "Atlas Demo",
  imageSrc: "assets/sprite-atlas-demo.svg",
  sprites: [
    { id: "player", name: "Player", x: 0, y: 0, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "enemy", name: "Enemy", x: 32, y: 0, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "wall", name: "Wall", x: 64, y: 0, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "spawn", name: "Spawn", x: 96, y: 0, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "trigger", name: "Trigger", x: 0, y: 32, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "portal", name: "Portal", x: 32, y: 32, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "checkpoint", name: "Checkpoint", x: 64, y: 32, w: 32, h: 32, pivotX: 0, pivotY: 0 },
    { id: "door", name: "Door", x: 96, y: 32, w: 32, h: 32, pivotX: 0, pivotY: 0 }
  ]
};

const DEMO_SPRITE_ANIMATIONS = [
  {
    id: "demo_blink",
    name: "Demo Blink",
    fps: 6,
    loop: true,
    frames: ["demo:player", "demo:enemy", "demo:player", "demo:enemy"]
  }
];

const AUDIO_CLIP_KINDS = ["ui", "trigger", "checkpoint", "portal", "pauseon", "pauseoff", "respawn", "music", "custom"];
const AUDIO_ROUTE_KINDS = ["ui", "trigger", "checkpoint", "portal", "pauseon", "pauseoff", "respawn", "music"];

const DEMO_AUDIO_CLIPS = [
  { id: "demo_ui", name: "UI Demo", src: "assets/audio/ui-click.wav", kind: "ui", volume: 0.8, loop: false },
  { id: "demo_trigger", name: "Trigger Demo", src: "assets/audio/trigger.wav", kind: "trigger", volume: 0.9, loop: false },
  { id: "demo_checkpoint", name: "Checkpoint Demo", src: "assets/audio/checkpoint.wav", kind: "checkpoint", volume: 0.9, loop: false },
  { id: "demo_portal", name: "Portal Demo", src: "assets/audio/portal.wav", kind: "portal", volume: 0.85, loop: false },
  { id: "demo_pause_on", name: "Pause On Demo", src: "assets/audio/pause-on.wav", kind: "pauseon", volume: 0.8, loop: false },
  { id: "demo_pause_off", name: "Pause Off Demo", src: "assets/audio/pause-off.wav", kind: "pauseoff", volume: 0.8, loop: false },
  { id: "demo_respawn", name: "Respawn Demo", src: "assets/audio/respawn.wav", kind: "respawn", volume: 0.9, loop: false },
  { id: "demo_music", name: "Music Demo", src: "assets/audio/music-loop.wav", kind: "music", volume: 0.6, loop: true }
];

const DEMO_TIMELINES = [
  {
    id: "timeline_demo_intro",
    name: "Intro Demo",
    actions: [
      {
        type: "start-dialogue",
        value: "",
        sceneId: "",
        spawnTag: "",
        targetTag: "",
        speaker: "Diretora",
        lines: ["Bem-vindo ao editor CN.", "Camera entrando em cena.", "Vamos abrir a porta inicial."]
      },
      {
        type: "move-camera",
        value: "",
        sceneId: "",
        spawnTag: "",
        targetTag: "",
        x: 520,
        y: 180,
        duration: 0.9
      },
      {
        type: "open-door",
        value: "",
        sceneId: "",
        spawnTag: "",
        targetTag: "porta_demo"
      }
    ]
  }
];

export function createDefaultProject() {
  const scene = createDefaultScene({ id: "scene_1", name: "Cena 1", includeDemoKit: true });
  const scene3D = createDefaultScene3D({ id: "scene3d_1", name: "Cena 3D 1" });
  const buildProfiles = createDefaultBuildProfiles(scene.id);
  const audioClips = createDemoAudioClips();
  return {
    projectVersion: PROJECT_VERSION,
    name: "Projeto CN",
    templateId: "top-down",
    spriteAtlases: sanitizeSpriteAtlases([DEMO_SPRITE_ATLAS]),
    spriteAnimations: sanitizeSpriteAnimations(DEMO_SPRITE_ANIMATIONS),
    audioClips,
    audioRouting: sanitizeAudioRouting(null, audioClips),
    timelines: sanitizeTimelines(DEMO_TIMELINES),
    prefabs: sanitizePrefabs([]),
    variables: {},
    variableMeta: {},
    activeBuildProfile: "dev",
    buildProfiles,
    buildConfig: clone(buildProfiles.dev),
    activeSceneId: scene.id,
    scenes: [scene],
    activeScene3DId: scene3D.id,
    scenes3d: [scene3D]
  };
}

export function createDemoAudioClips() {
  return sanitizeAudioClips(DEMO_AUDIO_CLIPS);
}

export function getSceneById(project, sceneId) {
  if (!project || !Array.isArray(project.scenes)) {
    return null;
  }

  return project.scenes.find((scene) => scene.id === sceneId) || null;
}

export function getActiveScene(project) {
  if (!project || !Array.isArray(project.scenes) || project.scenes.length === 0) {
    return null;
  }

  return getSceneById(project, project.activeSceneId) || project.scenes[0];
}

export function getScene3DById(project, sceneId) {
  if (!project || !Array.isArray(project.scenes3d)) {
    return null;
  }

  return project.scenes3d.find((scene) => scene.id === sceneId) || null;
}

export function getActiveScene3D(project) {
  if (!project || !Array.isArray(project.scenes3d) || project.scenes3d.length === 0) {
    return null;
  }

  return getScene3DById(project, project.activeScene3DId) || project.scenes3d[0];
}

export function createSceneFromProject(project) {
  const sceneId = nextSceneId(project);
  const sceneName = nextSceneName(project, "Cena");
  return createDefaultScene({ id: sceneId, name: sceneName });
}

export function createScene3DFromProject(project) {
  const sceneId = nextScene3DId(project);
  const sceneName = nextScene3DName(project, "Cena 3D");
  return createDefaultScene3D({ id: sceneId, name: sceneName });
}

export function createSceneFromTemplate(project, templateId) {
  const sceneId = nextSceneId(project);
  const template = resolveTemplate(templateId);
  const baseName = template.label;
  const sceneName = nextSceneName(project, baseName);
  return createTemplateScene(template.id, sceneId, sceneName);
}

export function duplicateSceneForProject(project, sourceScene) {
  const duplicate = clone(sourceScene);
  duplicate.id = nextSceneId(project);
  duplicate.name = nextSceneName(project, sourceScene?.name || "Cena Copia");
  return duplicate;
}

export function duplicateScene3DForProject(project, sourceScene) {
  const duplicate = clone(sourceScene);
  duplicate.id = nextScene3DId(project);
  duplicate.name = nextScene3DName(project, sourceScene?.name || "Cena 3D Copia");
  return duplicate;
}

export function validateProject(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, message: "estrutura principal ausente" };
  }

  if (!Array.isArray(data.scenes)) {
    const singleScene = validateScene(data);
    if (!singleScene.ok) {
      return singleScene;
    }

    const project = createDefaultProject();
    project.name = String(data.name || "Projeto CN");
    project.templateId = resolveTemplate(data.templateId).id;
    project.spriteAtlases = sanitizeSpriteAtlases(data.spriteAtlases);
    project.spriteAnimations = sanitizeSpriteAnimations(data.spriteAnimations);
    project.audioClips = sanitizeAudioClips(data.audioClips);
    project.audioRouting = sanitizeAudioRouting(data.audioRouting, project.audioClips);
    project.timelines = sanitizeTimelines(data.timelines);
    project.prefabs = sanitizePrefabs(data.prefabs);
    project.variables = sanitizeVariables(data.variables);
    project.variableMeta = sanitizeVariableMeta(data.variableMeta, project.variables);
    project.scenes = [assignSceneMetadata(singleScene.scene, 0, new Set())];
    project.activeSceneId = project.scenes[0].id;
    project.scenes3d = sanitizeScenes3D(data.scenes3d);
    project.activeScene3DId = project.scenes3d.some((scene3D) => scene3D.id === data.activeScene3DId) ? data.activeScene3DId : project.scenes3d[0].id;
    project.buildProfiles = sanitizeBuildProfiles(data.buildProfiles, project.scenes, project.activeSceneId);
    project.activeBuildProfile = normalizeBuildProfileId(data.activeBuildProfile);
    project.buildConfig = sanitizeBuildConfig(data.buildConfig, project.scenes, project.activeSceneId, {
      fallback: project.buildProfiles[project.activeBuildProfile]
    });
    return { ok: true, project };
  }

  if (data.scenes.length === 0) {
    return { ok: false, message: "projeto sem cenas" };
  }

  const seenIds = new Set();
  const scenes = [];

  for (let index = 0; index < data.scenes.length; index += 1) {
    const checkedScene = validateScene(data.scenes[index]);
    if (!checkedScene.ok) {
        return { ok: false, message: `cena ${index + 1}: ${checkedScene.message}` };
    }

    scenes.push(assignSceneMetadata(checkedScene.scene, index, seenIds, data.scenes[index]));
  }

  const activeSceneId = scenes.some((scene) => scene.id === data.activeSceneId) ? data.activeSceneId : scenes[0].id;
  const scenes3d = sanitizeScenes3D(data.scenes3d);
  const activeScene3DId = scenes3d.some((scene3D) => scene3D.id === data.activeScene3DId) ? data.activeScene3DId : scenes3d[0].id;
  const buildProfiles = sanitizeBuildProfiles(data.buildProfiles, scenes, activeSceneId);
  const activeBuildProfile = normalizeBuildProfileId(data.activeBuildProfile);
  const audioClips = sanitizeAudioClips(data.audioClips);
  const audioRouting = sanitizeAudioRouting(data.audioRouting, audioClips);
  const buildConfig = sanitizeBuildConfig(data.buildConfig, scenes, activeSceneId, {
    fallback: buildProfiles[activeBuildProfile]
  });

  return {
    ok: true,
    project: {
      projectVersion: PROJECT_VERSION,
      name: String(data.name || "Projeto CN"),
      templateId: resolveTemplate(data.templateId).id,
      spriteAtlases: sanitizeSpriteAtlases(data.spriteAtlases),
      spriteAnimations: sanitizeSpriteAnimations(data.spriteAnimations),
      audioClips,
      audioRouting,
      timelines: sanitizeTimelines(data.timelines),
      prefabs: sanitizePrefabs(data.prefabs),
      variables: sanitizeVariables(data.variables),
      variableMeta: sanitizeVariableMeta(data.variableMeta, data.variables),
      activeBuildProfile,
      buildProfiles,
      buildConfig,
      activeSceneId,
      scenes,
      activeScene3DId,
      scenes3d
    }
  };
}

export function sanitizeSpriteAtlases(source) {
  const fallback = [DEMO_SPRITE_ATLAS];
  const atlases = Array.isArray(source) ? source : source && typeof source === "object" ? [source] : fallback;
  const expandedAtlases = atlases.flatMap((atlas) => expandAtlasSource(atlas));
  const usedIds = new Set();
  const normalized = [];

  expandedAtlases.forEach((atlas, index) => {
    if (!atlas || typeof atlas !== "object") {
      return;
    }

    let atlasId = String(atlas.id || `atlas_${index + 1}`).trim().toLowerCase();
    if (!atlasId) {
      atlasId = `atlas_${index + 1}`;
    }

    while (usedIds.has(atlasId)) {
      atlasId = `${atlasId}_copy`;
    }
    usedIds.add(atlasId);

    const sprites = sanitizeAtlasSprites(atlas.sprites);
    normalized.push({
      id: atlasId,
      name: String(atlas.name || atlasId),
      imageSrc: String(atlas.imageSrc || "").trim(),
      sprites
    });
  });

  if (normalized.length === 0) {
    return sanitizeSpriteAtlases(fallback);
  }

  return normalized;
}

export function sanitizeSpriteAnimations(source) {
  const animations = Array.isArray(source) ? source : [];
  const normalized = [];
  const usedIds = new Set();

  animations.forEach((animation, index) => {
    if (!animation || typeof animation !== "object") {
      return;
    }

    let animationId = String(animation.id || `anim_${index + 1}`).trim().toLowerCase();
    if (!animationId) {
      animationId = `anim_${index + 1}`;
    }
    while (usedIds.has(animationId)) {
      animationId = `${animationId}_copy`;
    }
    usedIds.add(animationId);

    const frames = Array.isArray(animation.frames)
      ? animation.frames
          .map((frame) => String(frame || "").trim())
          .filter(Boolean)
      : [];

    if (frames.length === 0) {
      return;
    }

    normalized.push({
      id: animationId,
      name: String(animation.name || animationId),
      fps: Math.max(1, Number.isFinite(Number(animation.fps)) ? Number(animation.fps) : 8),
      loop: animation.loop !== false,
      frames
    });
  });

  return normalized;
}

export function sanitizeAudioClips(source) {
  const clips = Array.isArray(source) ? source : source && typeof source === "object" ? [source] : [];
  const normalized = [];
  const usedIds = new Set();

  clips.forEach((clip, index) => {
    if (!clip || typeof clip !== "object") {
      return;
    }

    let clipId = String(clip.id || clip.name || `clip_${index + 1}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!clipId) {
      clipId = `clip_${index + 1}`;
    }
    while (usedIds.has(clipId)) {
      clipId = `${clipId}_copy`;
    }
    usedIds.add(clipId);

    const src = String(clip.src ?? clip.url ?? clip.path ?? "").trim();
    if (!src) {
      return;
    }

    const kindCandidate = String(clip.kind || clip.type || "ui").trim().toLowerCase();
    const kind = AUDIO_CLIP_KINDS.includes(kindCandidate) ? kindCandidate : "custom";
    const volume = Number.isFinite(Number(clip.volume)) ? Math.max(0, Math.min(1, Number(clip.volume))) : 1;
    const loop = clip.loop === true || (kind === "music" && clip.loop !== false);

    normalized.push({
      id: clipId,
      name: String(clip.name || clipId),
      src,
      kind,
      volume,
      loop
    });
  });

  return normalized;
}

export function sanitizeAudioRouting(source, audioClips = []) {
  const safeSource = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const safeClips = Array.isArray(audioClips) ? audioClips : [];
  const clipIds = new Set(
    safeClips
      .map((clip) => String(clip?.id || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const defaults = AUDIO_ROUTE_KINDS.reduce((acc, routeKind) => {
    const clip = safeClips.find((entry) => String(entry?.kind || "").trim().toLowerCase() === routeKind);
    acc[routeKind] = clip ? String(clip.id || "").trim().toLowerCase() : "";
    return acc;
  }, {});

  return AUDIO_ROUTE_KINDS.reduce((acc, routeKind) => {
    const candidate = String(safeSource[routeKind] || "").trim().toLowerCase();
    if (candidate && clipIds.has(candidate)) {
      acc[routeKind] = candidate;
      return acc;
    }

    acc[routeKind] = clipIds.has(defaults[routeKind]) ? defaults[routeKind] : "";
    return acc;
  }, {});
}

export function sanitizeTimelines(source) {
  const timelines = Array.isArray(source) ? source : [];
  const normalized = [];
  const usedIds = new Set();

  timelines.forEach((timeline, index) => {
    if (!timeline || typeof timeline !== "object") {
      return;
    }

    let timelineId = String(timeline.id || `timeline_${index + 1}`).trim().toLowerCase();
    if (!timelineId) {
      timelineId = `timeline_${index + 1}`;
    }
    while (usedIds.has(timelineId)) {
      timelineId = `${timelineId}_copy`;
    }
    usedIds.add(timelineId);

    const actions = Array.isArray(timeline.actions) ? timeline.actions.map((action) => sanitizeTimelineAction(action)).filter(Boolean).slice(0, 16) : [];
    if (actions.length === 0) {
      return;
    }

    normalized.push({
      id: timelineId,
      name: String(timeline.name || timelineId),
      actions
    });
  });

  return normalized;
}

export function sanitizePrefabs(source) {
  const prefabs = Array.isArray(source) ? source : [];
  const normalized = [];
  const usedIds = new Set();

  prefabs.forEach((prefab, index) => {
    if (!prefab || typeof prefab !== "object") {
      return;
    }

    let prefabId = String(prefab.id || `prefab_${index + 1}`).trim().toLowerCase();
    if (!prefabId) {
      prefabId = `prefab_${index + 1}`;
    }
    while (usedIds.has(prefabId)) {
      prefabId = `${prefabId}_copy`;
    }
    usedIds.add(prefabId);

    const sourceKind = prefab.sourceKind === "wall" ? "wall" : "gameplayObject";
    const data = prefab.data && typeof prefab.data === "object" ? clone(prefab.data) : null;
    if (!data) {
      return;
    }

    const w = Math.max(8, Number.isFinite(Number(data.w)) ? Number(data.w) : 32);
    const h = Math.max(8, Number.isFinite(Number(data.h)) ? Number(data.h) : 32);

    normalized.push({
      id: prefabId,
      name: String(prefab.name || `Prefab ${index + 1}`),
      sourceKind,
      data: {
        ...data,
        w,
        h,
        x: Number.isFinite(Number(data.x)) ? Number(data.x) : 0,
        y: Number.isFinite(Number(data.y)) ? Number(data.y) : 0,
        z: Number.isFinite(Number(data.z)) ? Number(data.z) : 0
      }
    });
  });

  return normalized;
}

function assignSceneMetadata(scene, index, seenIds, rawScene = {}) {
  const nextScene = clone(scene);
  const fallbackId = `scene_${index + 1}`;
  let sceneId = String(rawScene.id || nextScene.id || fallbackId).trim();
  if (!sceneId) {
    sceneId = fallbackId;
  }

  while (seenIds.has(sceneId)) {
    sceneId = `${sceneId}_copy`;
  }

  seenIds.add(sceneId);
  nextScene.id = sceneId;
  nextScene.name = String(rawScene.name || nextScene.name || `Cena ${index + 1}`);
  return nextScene;
}

function nextSceneId(project) {
  const ids = new Set((project?.scenes || []).map((scene) => scene.id));
  let index = 1;
  while (ids.has(`scene_${index}`)) {
    index += 1;
  }
  return `scene_${index}`;
}

function nextSceneName(project, baseName) {
  const names = new Set((project?.scenes || []).map((scene) => scene.name));
  if (!names.has(baseName)) {
    return baseName;
  }

  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (names.has(candidate)) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }
  return candidate;
}

function createDefaultBuildProfiles(startSceneId) {
  const safeSceneId = String(startSceneId || "scene_1");
  return {
    dev: {
      buildName: "cn-dev",
      mode: "dev",
      startScene: safeSceneId,
      includeEditorUI: true,
      includeDebugPanel: true,
      compressAssets: false
    },
    test: {
      buildName: "cn-test",
      mode: "test",
      startScene: safeSceneId,
      includeEditorUI: false,
      includeDebugPanel: true,
      compressAssets: false
    },
    release: {
      buildName: "cn-release",
      mode: "release",
      startScene: safeSceneId,
      includeEditorUI: false,
      includeDebugPanel: false,
      compressAssets: true
    }
  };
}

function sanitizeBuildProfiles(source, scenes, fallbackSceneId) {
  const defaults = createDefaultBuildProfiles(fallbackSceneId);
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const sceneIds = new Set(safeScenes.map((scene) => scene.id));
  const safeSceneId = sceneIds.has(fallbackSceneId) ? fallbackSceneId : (safeScenes[0]?.id || "scene_1");
  const profiles = {};

  BUILD_PROFILE_IDS.forEach((profileId) => {
    profiles[profileId] = sanitizeBuildConfig(
      source && typeof source === "object" ? source[profileId] : null,
      safeScenes,
      safeSceneId,
      {
        fallback: defaults[profileId],
        forcedMode: profileId
      }
    );
  });

  return profiles;
}

function sanitizeBuildConfig(source, scenes, fallbackSceneId, options = {}) {
  const fallback = options.fallback && typeof options.fallback === "object" ? options.fallback : {};
  const merged = source && typeof source === "object" ? { ...fallback, ...source } : { ...fallback };
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const sceneIds = new Set(safeScenes.map((scene) => scene.id));
  const safeFallbackSceneId = sceneIds.has(fallbackSceneId) ? fallbackSceneId : (safeScenes[0]?.id || "scene_1");
  const forcedMode = options.forcedMode ? String(options.forcedMode) : "";
  const mode = forcedMode || normalizeBuildMode(merged.mode);

  return {
    buildName: sanitizeBuildName(merged.buildName, mode),
    mode,
    startScene: sceneIds.has(merged.startScene) ? String(merged.startScene) : safeFallbackSceneId,
    includeEditorUI: merged.includeEditorUI === true,
    includeDebugPanel: merged.includeDebugPanel === true,
    compressAssets: merged.compressAssets === true
  };
}

function sanitizeBuildName(value, mode) {
  const text = String(value || "").trim();
  if (!text) {
    return `cn-${mode}`;
  }

  return text.slice(0, 64);
}

function normalizeBuildMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  return ["dev", "test", "release", "custom"].includes(value) ? value : "dev";
}

function normalizeBuildProfileId(profileId) {
  const value = String(profileId || "").trim().toLowerCase();
  return BUILD_PROFILE_IDS.includes(value) ? value : "dev";
}

function resolveTemplate(templateId) {
  const normalized = String(templateId || "").trim().toLowerCase();
  return PROJECT_TEMPLATE_DEFS.find((entry) => entry.id === normalized) || PROJECT_TEMPLATE_DEFS[0];
}

function createTemplateScene(templateId, sceneId, sceneName) {
  if (templateId === "plataforma") {
    return createPlatformTemplateScene(sceneId, sceneName);
  }

  if (templateId === "arena") {
    return createArenaTemplateScene(sceneId, sceneName);
  }

  if (templateId === "puzzle") {
    return createPuzzleTemplateScene(sceneId, sceneName);
  }

  return createDefaultScene({ id: sceneId, name: sceneName, includeDemoKit: true });
}

function createPlatformTemplateScene(sceneId, sceneName) {
  const scene = createDefaultScene({ id: sceneId, name: sceneName });
  scene.player.x = 96;
  scene.player.y = 1020;
  scene.enemy.x = 1080;
  scene.enemy.y = 700;
  scene.walls = [
    { id: "wall_1", name: "Solo", type: "wall", x: 0, y: 1120, z: 0, w: scene.world.width, h: 40, color: "#7d8895" },
    { id: "wall_2", name: "Plataforma 1", type: "wall", x: 260, y: 920, z: 0, w: 220, h: 24, color: "#7d8895" },
    { id: "wall_3", name: "Plataforma 2", type: "wall", x: 620, y: 780, z: 0, w: 240, h: 24, color: "#7d8895" },
    { id: "wall_4", name: "Plataforma 3", type: "wall", x: 980, y: 640, z: 0, w: 220, h: 24, color: "#7d8895" }
  ];
  scene.gameObjects = [];
  const spawn = createGameplayObject(scene, 1, "spawn", { x: 80, y: 1060 });
  spawn.spawnTag = "entrada_plataforma";
  spawn.name = "Ponto Inicial Plataforma";
  scene.gameObjects.push(spawn);
  return scene;
}

function createArenaTemplateScene(sceneId, sceneName) {
  const scene = createDefaultScene({ id: sceneId, name: sceneName });
  scene.player.x = 320;
  scene.player.y = 280;
  scene.enemy.x = 860;
  scene.enemy.y = 480;
  scene.walls = [
    { id: "wall_1", name: "Borda Norte", type: "wall", x: 120, y: 120, z: 0, w: 1360, h: 32, color: "#7d8895" },
    { id: "wall_2", name: "Borda Sul", type: "wall", x: 120, y: 900, z: 0, w: 1360, h: 32, color: "#7d8895" },
    { id: "wall_3", name: "Borda Oeste", type: "wall", x: 120, y: 120, z: 0, w: 32, h: 812, color: "#7d8895" },
    { id: "wall_4", name: "Borda Leste", type: "wall", x: 1448, y: 120, z: 0, w: 32, h: 812, color: "#7d8895" }
  ];
  scene.gameObjects = [];
  const spawn = createGameplayObject(scene, 1, "spawn", { x: 288, y: 256 });
  spawn.spawnTag = "entrada_arena";
  spawn.name = "Ponto Inicial Arena";
  const checkpoint = createGameplayObject(scene, 2, "checkpoint", { x: 760, y: 520 });
  checkpoint.checkpointId = "checkpoint_arena";
  checkpoint.name = "Checkpoint Arena";
  scene.gameObjects.push(spawn, checkpoint);
  return scene;
}

function createPuzzleTemplateScene(sceneId, sceneName) {
  const scene = createDefaultScene({ id: sceneId, name: sceneName });
  scene.gameObjects = [];

  const spawn = createGameplayObject(scene, 1, "spawn", { x: 160, y: 160 });
  spawn.spawnTag = "entrada_puzzle";
  spawn.name = "Ponto Inicial Puzzle";

  const trigger = createGameplayObject(scene, 2, "trigger", { x: 320, y: 160 });
  trigger.triggerTag = "gatilho_puzzle";
  trigger.name = "Gatilho Puzzle";
  trigger.interactionOnly = true;
  trigger.actions = [
    {
      type: "start-dialogue",
      value: "",
      sceneId: "",
      spawnTag: "",
      targetTag: "",
      speaker: "Sistema",
      lines: ["Acionei a sequencia do puzzle.", "A porta sera liberada agora.", "Siga para a saida."]
    },
    {
      type: "open-door",
      value: "",
      sceneId: "",
      spawnTag: "",
      targetTag: "porta_puzzle"
    },
    {
      type: "set-variable",
      value: "1",
      sceneId: "",
      spawnTag: "",
      targetTag: "puzzle_solved"
    }
  ];

  const door = createGameplayObject(scene, 3, "door", { x: 640, y: 128 });
  door.name = "Porta Puzzle";
  door.doorTag = "porta_puzzle";

  const checkpoint = createGameplayObject(scene, 4, "checkpoint", { x: 780, y: 176 });
  checkpoint.checkpointId = "checkpoint_puzzle";
  checkpoint.name = "Checkpoint Puzzle";

  scene.variables = { puzzle_solved: "0" };
  scene.variableMeta = { puzzle_solved: { type: "boolean", preset: "none" } };
  scene.gameObjects.push(spawn, trigger, door, checkpoint);
  return scene;
}

function expandAtlasSource(atlas) {
  if (!atlas || typeof atlas !== "object") {
    return [];
  }

  if (Array.isArray(atlas.atlases)) {
    return atlas.atlases.flatMap((entry) => expandAtlasSource(entry));
  }

  if (atlas.frames && typeof atlas.frames === "object" && !Array.isArray(atlas.frames)) {
    return [normalizeFrameAtlasSource(atlas)];
  }

  if (Array.isArray(atlas.psdLayers)) {
    return [normalizePsdAtlasSource(atlas)];
  }

  if (isGridAtlasSource(atlas)) {
    return [normalizeGridAtlasSource(atlas)];
  }

  return [atlas];
}

function isGridAtlasSource(atlas) {
  return Number.isFinite(Number(atlas?.frameWidth)) && Number.isFinite(Number(atlas?.frameHeight));
}

function normalizeGridAtlasSource(atlas) {
  const frameWidth = Math.max(1, Math.round(Number(atlas.frameWidth)));
  const frameHeight = Math.max(1, Math.round(Number(atlas.frameHeight)));
  const startX = Number.isFinite(Number(atlas.startX)) ? Math.round(Number(atlas.startX)) : 0;
  const startY = Number.isFinite(Number(atlas.startY)) ? Math.round(Number(atlas.startY)) : 0;
  const spacingX = Number.isFinite(Number(atlas.spacingX)) ? Math.round(Number(atlas.spacingX)) : 0;
  const spacingY = Number.isFinite(Number(atlas.spacingY)) ? Math.round(Number(atlas.spacingY)) : 0;
  const columns = Math.max(1, Number.isFinite(Number(atlas.columns)) ? Math.round(Number(atlas.columns)) : 1);
  const rows = Math.max(1, Number.isFinite(Number(atlas.rows)) ? Math.round(Number(atlas.rows)) : 1);
  const count = Math.max(1, Number.isFinite(Number(atlas.count)) ? Math.round(Number(atlas.count)) : columns * rows);
  const idPrefix = String(atlas.idPrefix || atlas.prefix || "slice").trim().toLowerCase() || "slice";

  const sprites = [];
  for (let index = 0; index < count; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    if (row >= rows) {
      break;
    }

    sprites.push({
      id: `${idPrefix}_${String(index + 1).padStart(3, "0")}`,
      name: `${idPrefix}_${index + 1}`,
      x: startX + col * (frameWidth + spacingX),
      y: startY + row * (frameHeight + spacingY),
      w: frameWidth,
      h: frameHeight,
      pivotX: clamp01(atlas.pivotX, 0),
      pivotY: clamp01(atlas.pivotY, 0)
    });
  }

  return {
    ...atlas,
    sprites
  };
}

function normalizeFrameAtlasSource(atlas) {
  const frames = Object.entries(atlas.frames || {});
  const sprites = frames
    .map(([key, frameEntry], index) => {
      const frame = frameEntry?.frame && typeof frameEntry.frame === "object" ? frameEntry.frame : frameEntry;
      if (!frame || typeof frame !== "object") {
        return null;
      }

      const x = Number.isFinite(Number(frame.x)) ? Math.round(Number(frame.x)) : Number.NaN;
      const y = Number.isFinite(Number(frame.y)) ? Math.round(Number(frame.y)) : Number.NaN;
      const w = Number.isFinite(Number(frame.w)) ? Math.round(Number(frame.w)) : Number.NaN;
      const h = Number.isFinite(Number(frame.h)) ? Math.round(Number(frame.h)) : Number.NaN;
      if (![x, y, w, h].every(Number.isFinite)) {
        return null;
      }

      const rawName = String(frameEntry?.filename || key || `sprite_${index + 1}`).trim();
      const cleanId = rawName
        .toLowerCase()
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "") || `sprite_${index + 1}`;

      return {
        id: cleanId,
        name: rawName,
        x,
        y,
        w: Math.max(1, w),
        h: Math.max(1, h),
        pivotX: clamp01(frameEntry?.pivotX ?? atlas?.pivotX, 0),
        pivotY: clamp01(frameEntry?.pivotY ?? atlas?.pivotY, 0)
      };
    })
    .filter(Boolean);

  return {
    id: atlas.id,
    name: atlas.name || atlas.meta?.app || atlas.id || "atlas",
    imageSrc: String(atlas.imageSrc || atlas.meta?.image || "").trim(),
    sprites
  };
}

function normalizePsdAtlasSource(atlas) {
  const sprites = Array.isArray(atlas.psdLayers)
    ? atlas.psdLayers
        .map((layer, index) => {
          if (!layer || typeof layer !== "object" || layer.visible === false) {
            return null;
          }

          const x = Number.isFinite(Number(layer.x)) ? Math.round(Number(layer.x)) : Number.NaN;
          const y = Number.isFinite(Number(layer.y)) ? Math.round(Number(layer.y)) : Number.NaN;
          const w = Number.isFinite(Number(layer.w)) ? Math.round(Number(layer.w)) : Number.NaN;
          const h = Number.isFinite(Number(layer.h)) ? Math.round(Number(layer.h)) : Number.NaN;
          if (![x, y, w, h].every(Number.isFinite)) {
            return null;
          }

          const layerName = String(layer.name || `layer_${index + 1}`).trim();
          const layerId = layerName
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, "_")
            .replace(/^_+|_+$/g, "") || `layer_${index + 1}`;

          return {
            id: layerId,
            name: layerName,
            x,
            y,
            w: Math.max(1, w),
            h: Math.max(1, h),
            pivotX: clamp01(layer.pivotX ?? atlas.pivotX, 0),
            pivotY: clamp01(layer.pivotY ?? atlas.pivotY, 0)
          };
        })
        .filter(Boolean)
    : [];

  return {
    id: atlas.id,
    name: atlas.name || atlas.id || "atlas",
    imageSrc: String(atlas.imageSrc || "").trim(),
    sprites
  };
}

function sanitizeTimelineAction(action) {
  if (!action || typeof action !== "object") {
    return null;
  }

  const rawType = String(action.type || action.actionType || "message");
  const type = TRIGGER_ACTION_TYPES.includes(rawType) ? rawType : "message";
  if (type === "none") {
    return null;
  }

  const normalized = {
    type,
    value: String(action.value ?? action.actionValue ?? ""),
    sceneId: String(action.sceneId ?? action.actionSceneId ?? ""),
    spawnTag: String(action.spawnTag ?? action.actionSpawnTag ?? ""),
    targetTag: String(action.targetTag ?? action.actionTargetTag ?? "")
  };

  if (type === "start-dialogue") {
    normalized.speaker = String(action.speaker ?? action.actionSpeaker ?? "");
    const lines = Array.isArray(action.lines) ? action.lines : typeof action.lines === "string" ? action.lines.split("\n") : Array.isArray(action.actionLines) ? action.actionLines : [];
    normalized.lines = lines.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 3);
    while (normalized.lines.length < 3) {
      normalized.lines.push("");
    }
  }

  if (type === "move-player" || type === "move-camera") {
    normalized.x = Number.isFinite(Number(action.x ?? action.actionX)) ? Math.round(Number(action.x ?? action.actionX)) : 0;
    normalized.y = Number.isFinite(Number(action.y ?? action.actionY)) ? Math.round(Number(action.y ?? action.actionY)) : 0;
    normalized.duration = Math.max(0.05, Number.isFinite(Number(action.duration ?? action.actionDuration)) ? Number(action.duration ?? action.actionDuration) : 0.6);
  }

  if (type === "play-timeline") {
    normalized.timelineId = String(action.timelineId ?? action.actionTimelineId ?? normalized.value ?? "");
    if (!normalized.value) {
      normalized.value = normalized.timelineId;
    }
  }

  return normalized;
}

function sanitizeAtlasSprites(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  const usedIds = new Set();
  return source
    .map((sprite, index) => {
      if (!sprite || typeof sprite !== "object") {
        return null;
      }

      let spriteId = String(sprite.id || `sprite_${index + 1}`).trim().toLowerCase();
      if (!spriteId) {
        spriteId = `sprite_${index + 1}`;
      }
      while (usedIds.has(spriteId)) {
        spriteId = `${spriteId}_copy`;
      }
      usedIds.add(spriteId);

      const x = Number.isFinite(Number(sprite.x)) ? Math.round(Number(sprite.x)) : 0;
      const y = Number.isFinite(Number(sprite.y)) ? Math.round(Number(sprite.y)) : 0;
      const w = Math.max(1, Number.isFinite(Number(sprite.w)) ? Math.round(Number(sprite.w)) : 32);
      const h = Math.max(1, Number.isFinite(Number(sprite.h)) ? Math.round(Number(sprite.h)) : 32);
      const pivotX = clamp01(sprite.pivotX, 0);
      const pivotY = clamp01(sprite.pivotY, 0);

      return {
        id: spriteId,
        name: String(sprite.name || spriteId),
        x,
        y,
        w,
        h,
        pivotX,
        pivotY
      };
    })
    .filter(Boolean);
}

function clamp01(value, fallback) {
  if (!Number.isFinite(Number(value))) {
    return fallback;
  }
  return Math.max(0, Math.min(1, Number(value)));
}
