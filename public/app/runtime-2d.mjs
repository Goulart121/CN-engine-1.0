import { SORTING_LAYERS, TILE_LAYERS } from "./constants.mjs";
import { createNativeCameraState, createNativePreviewConfig, createNativePrism, projectNativeGuideSegment, projectNativePoint, projectNativeRect, resolveNativeCameraState } from "./native-3d.mjs";
import { getSceneDepthOffset, projectScenePoint, projectSceneRect } from "./scene-space.mjs";
import { clamp, clampWorld, overlap } from "./utils.mjs";
import {
  evaluateTriggerCondition,
  findCheckpointById,
  findSpawnPoint,
  getClosedDoors,
  getColliderRect,
  getCollisionRectsForBody,
  getGameplayObjectsByType,
  getTriggerActions,
  getObjectByRef,
  getOverlappingGameplayObjects,
  placeBodyAtMarker,
  resolveAnimatedTileId,
  syncParentHierarchy,
  traceLineBrushCells
} from "./core-scene.mjs";

export function createRuntime({ canvas, ctx, ui, model, TILE_BY_ID, getSelectedRef, getSelectedRefs, setStatus, onPlaySceneChange }) {
  const nativeCanvas = ui.native3dPreview || null;
  const nativeCtx = nativeCanvas ? nativeCanvas.getContext("2d") : null;
  const spriteImageCache = new Map();
  const audioRuntime = createAudioRuntime();

  function start() {
    requestAnimationFrame(loop);
  }

  function resize() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(bounds.width));
    canvas.height = Math.max(1, Math.floor(bounds.height));

    if (nativeCanvas) {
      const nativeBounds = nativeCanvas.getBoundingClientRect();
      nativeCanvas.width = Math.max(1, Math.floor(nativeBounds.width));
      nativeCanvas.height = Math.max(1, Math.floor(nativeBounds.height));
    }
  }

  function beginPlaySession(options = {}) {
    model.state.playRuntime = createPlayRuntimeState();
    seedRuntimeVariables(model.scene, model.state.playRuntime);
    applyPlaySaveData(options.playSaveData || null);
    if (options.skipSpawn !== true) {
      movePlayerToSceneSpawn(model.scene, { silent: true });
    }
    syncAudioRuntimeForScene(model.scene);
  }

  function endPlaySession() {
    model.state.playRuntime = createPlayRuntimeState();
    audioRuntime.stopMusic();
  }

  function ensurePlayRuntimeState() {
    if (!model.state.playRuntime || typeof model.state.playRuntime !== "object") {
      model.state.playRuntime = createPlayRuntimeState();
    }

    return model.state.playRuntime;
  }

  function resolveSceneAudio2D(scene) {
    const audio = scene?.audio2D || {};
    return {
      enabled: audio.enabled !== false,
      masterVolume: clamp(Number.isFinite(Number(audio.masterVolume)) ? Number(audio.masterVolume) : 0.85, 0, 1),
      sfxVolume: clamp(Number.isFinite(Number(audio.sfxVolume)) ? Number(audio.sfxVolume) : 0.9, 0, 1),
      musicVolume: clamp(Number.isFinite(Number(audio.musicVolume)) ? Number(audio.musicVolume) : 0, 0, 1),
      musicClipId: String(audio.musicClipId || "").trim()
    };
  }

  function resolveSceneUi2D(scene) {
    const ui2D = scene?.ui2D || {};
    return {
      showHud: ui2D.showHud !== false,
      showHints: ui2D.showHints !== false,
      showPauseOverlay: ui2D.showPauseOverlay !== false
    };
  }

  function syncAudioRuntimeForScene(scene) {
    audioRuntime.setClips(model.project?.audioClips);
    audioRuntime.setRouting(model.project?.audioRouting);
    const audioConfig = resolveSceneAudio2D(scene);
    audioRuntime.setPreferredMusicClipId(audioConfig.musicClipId);
    audioRuntime.enabled = audioConfig.enabled;
    audioRuntime.masterVolume = audioConfig.masterVolume;
    audioRuntime.sfxVolume = audioConfig.sfxVolume;
    audioRuntime.musicVolume = audioConfig.musicVolume;
    audioRuntime.ensureMusic();
  }

  function playSfx(kind) {
    audioRuntime.playSfx(kind);
  }

  function createPlaySaveData() {
    const playRuntime = ensurePlayRuntimeState();
    return {
      checkpoint: playRuntime.checkpoint ? { ...playRuntime.checkpoint } : null,
      playerTeamId: String(playRuntime.playerTeamId || ""),
      variables: { ...(playRuntime.variables || {}) },
      consumedTriggerKeys: { ...(playRuntime.consumedTriggerKeys || {}) }
    };
  }

  function applyPlaySaveData(playSaveData) {
    if (!playSaveData || typeof playSaveData !== "object") {
      return false;
    }

    const playRuntime = ensurePlayRuntimeState();
    playRuntime.checkpoint = playSaveData.checkpoint && typeof playSaveData.checkpoint === "object"
      ? { ...playSaveData.checkpoint }
      : null;
    playRuntime.playerTeamId = String(playSaveData.playerTeamId || "");
    if (playSaveData.variables && typeof playSaveData.variables === "object" && !Array.isArray(playSaveData.variables)) {
      playRuntime.variables = Object.entries(playSaveData.variables).reduce((acc, [key, value]) => {
        const cleanKey = String(key || "").trim();
        if (!cleanKey) {
          return acc;
        }
        acc[cleanKey] = String(value ?? "");
        return acc;
      }, { ...(playRuntime.variables || {}) });
    }
    playRuntime.consumedTriggerKeys = playSaveData.consumedTriggerKeys && typeof playSaveData.consumedTriggerKeys === "object"
      ? { ...playSaveData.consumedTriggerKeys }
      : {};
    return true;
  }

  function seedRuntimeVariables(scene, playRuntime, options = {}) {
    const nextVariables = options.mergeOnly ? { ...(playRuntime.variables || {}) } : {};
    [model.project?.variables, scene?.variables].forEach((source) => {
      if (!source || typeof source !== "object") {
        return;
      }

      Object.entries(source).forEach(([key, value]) => {
        const cleanKey = String(key || "").trim();
        if (!cleanKey) {
          return;
        }

        if (options.mergeOnly && Object.prototype.hasOwnProperty.call(nextVariables, cleanKey)) {
          return;
        }

        nextVariables[cleanKey] = String(value ?? "");
      });
    });

    playRuntime.variables = nextVariables;
  }

  function loop(now) {
    const state = model.state;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;

    state.fpsTick += dt;
    state.fpsFrames += 1;
    if (state.snapGuides?.ttl > 0) {
      state.snapGuides.ttl = Math.max(0, state.snapGuides.ttl - dt);
    }
    if (state.fpsTick >= 0.35) {
      state.fpsValue = state.fpsFrames / state.fpsTick;
      state.fpsTick = 0;
      state.fpsFrames = 0;
      ui.fps.textContent = `FPS: ${Math.round(state.fpsValue)}`;
    }

    if (state.mode === "play") {
      const playRuntime = ensurePlayRuntimeState();
      syncAudioRuntimeForScene(model.scene);
      if (state.input.pauseQueued) {
        playRuntime.paused = !playRuntime.paused;
        state.input.pauseQueued = false;
        setStatus?.(playRuntime.paused ? "Jogo pausado." : "Jogo retomado.", "ok");
        playSfx(playRuntime.paused ? "pauseOn" : "pauseOff");
      }
      playRuntime.portalCooldown = Math.max(0, playRuntime.portalCooldown - dt);
      playRuntime.respawnInvuln = Math.max(0, playRuntime.respawnInvuln - dt);
      updateRuntimeEffects(dt, playRuntime);
      if (!playRuntime.paused) {
        updateDialogueAndCutscene(dt, playRuntime);
        updatePlayer(dt);
        updateEnemy(dt);
        syncParentHierarchy(model.scene, { includeEntities: true });
        updateGameplayObjects();
      }
      state.input.interactQueued = false;
    } else if (state.input.interactQueued) {
      state.input.interactQueued = false;
      state.input.pauseQueued = false;
    }

    updateCamera(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function updatePlayer(dt) {
    const state = model.state;
    const scene = model.scene;
    const player = scene.player;
    const playRuntime = ensurePlayRuntimeState();

    if (isRuntimeLocked(playRuntime)) {
      return;
    }

    let x = 0;
    let y = 0;
    if (state.input.left) x -= 1;
    if (state.input.right) x += 1;
    if (state.input.up) y -= 1;
    if (state.input.down) y += 1;
    const length = Math.hypot(x, y) || 1;
    const surfaceFriction = resolveBodySurfaceFriction(scene, state.tileMaps, player);
    const speed = player.speed * (state.input.run ? player.runMultiplier : 1) * resolveSurfaceSpeedFactor(surfaceFriction);
    const bodyType = normalizeRigidbodyType(player.rigidbodyType, "kinematic");

    if (bodyType === "dynamic") {
      const velocity = getBodyVelocity(playRuntime, makeRuntimeTargetKey(scene.id, "entity", "player"), player);
      if (x || y) {
        velocity.x = (x / length) * speed;
        if (Number(player.gravityScale || 0) === 0) {
          velocity.y = (y / length) * speed;
        }
      } else {
        velocity.x *= 0.84;
        if (Number(player.gravityScale || 0) === 0) {
          velocity.y *= 0.84;
        }
      }

      stepRigidbody(player, velocity, dt, scene, state.tileMaps);
      return;
    }

    if (!x && !y) return;
    moveWithCollisions(player, (x / length) * speed * dt, (y / length) * speed * dt, scene, state.tileMaps);
  }

  function updateEnemy(dt) {
    const playRuntime = ensurePlayRuntimeState();
    if (isRuntimeLocked(playRuntime)) {
      return;
    }

    const scene = model.scene;
    const enemy = scene.enemy;
    if (!Array.isArray(enemy.patrol) || enemy.patrol.length === 0) {
      return;
    }

    const target = enemy.patrol[enemy.patrolIndex % enemy.patrol.length];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const surfaceFriction = resolveBodySurfaceFriction(scene, model.state.tileMaps, enemy);
    const speed = enemy.speed * resolveSurfaceSpeedFactor(surfaceFriction);

    if (distance < 4) {
      enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
      return;
    }

    const bodyType = normalizeRigidbodyType(enemy.rigidbodyType, "kinematic");
    if (bodyType === "dynamic") {
      const velocity = getBodyVelocity(playRuntime, makeRuntimeTargetKey(scene.id, "entity", "enemy"), enemy);
      velocity.x = (dx / distance) * speed;
      if (Number(enemy.gravityScale || 0) === 0) {
        velocity.y = (dy / distance) * speed;
      }
      stepRigidbody(enemy, velocity, dt, scene, model.state.tileMaps);
      return;
    }

    moveWithCollisions(enemy, (dx / distance) * speed * dt, (dy / distance) * speed * dt, scene, model.state.tileMaps);
  }

  function updateGameplayObjects() {
    const scene = model.scene;
    const player = scene.player;
    const playRuntime = ensurePlayRuntimeState();

    playRuntime.interactionHint = null;

    if (isRuntimeLocked(playRuntime)) {
      return;
    }

    syncTriggerContacts(scene, player, playRuntime);
    if (model.scene !== scene) {
      return;
    }

    syncCheckpoint(scene, player, playRuntime);
    if (model.scene !== scene) {
      return;
    }

    syncPortal(scene, player, playRuntime);
    if (model.scene !== scene) {
      return;
    }

    if (playRuntime.respawnInvuln <= 0 && overlapsBody(player, scene.enemy)) {
      respawnPlayer("enemy");
    }
  }

  function syncTriggerContacts(scene, player, playRuntime) {
    const triggerContacts = getOverlappingGameplayObjects(scene, player, "trigger");
    const nextKeys = new Set();
    const interactQueued = model.state.input.interactQueued === true;

    triggerContacts.forEach((trigger) => {
      const key = makeGameplayKey(scene.id, trigger.id);
      nextKeys.add(key);

      if (playRuntime.activeTriggerKeys[key] || playRuntime.consumedTriggerKeys[key] || trigger.enabled === false) {
        return;
      }

      if (!evaluateTriggerCondition(trigger, { playerTeamId: playRuntime.playerTeamId, sceneId: scene.id, hasCheckpoint: !!playRuntime.checkpoint, variables: playRuntime.variables })) {
        return;
      }

      if (trigger.interactionOnly === true) {
        if (!playRuntime.interactionHint) {
          playRuntime.interactionHint = {
            key,
            label: trigger.triggerTag || trigger.name || "Gatilho"
          };
        }

        if (!interactQueued) {
          return;
        }
      }

      playRuntime.activeTriggerKeys[key] = true;
      executeTriggerActions(trigger, scene, playRuntime);
      if (trigger.once) {
        playRuntime.consumedTriggerKeys[key] = true;
      }
    });

    Object.keys(playRuntime.activeTriggerKeys).forEach((key) => {
      if (key.startsWith(`${scene.id}:`) && !nextKeys.has(key)) {
        delete playRuntime.activeTriggerKeys[key];
      }
    });
  }

  function syncCheckpoint(scene, player, playRuntime) {
    const checkpoint = getOverlappingGameplayObjects(scene, player, "checkpoint")[0];
    if (!checkpoint) {
      return;
    }

    const key = makeGameplayKey(scene.id, checkpoint.id);
    if (playRuntime.checkpoint?.key === key) {
      return;
    }

    playRuntime.checkpoint = {
      key,
      sceneId: scene.id,
      objectId: checkpoint.id,
      label: checkpoint.checkpointId || checkpoint.name
    };

    setStatus?.(`Ponto de controle salvo: ${playRuntime.checkpoint.label}.`, "ok");
    playSfx("checkpoint");
  }

  function updateRuntimeEffects(dt, playRuntime) {
    Object.keys(playRuntime.animationFx).forEach((key) => {
      playRuntime.animationFx[key].ttl = Math.max(0, playRuntime.animationFx[key].ttl - dt);
      if (playRuntime.animationFx[key].ttl <= 0) {
        delete playRuntime.animationFx[key];
      }
    });

    Object.keys(playRuntime.doorFx).forEach((key) => {
      const fx = playRuntime.doorFx[key];
      fx.progress = clamp((fx.progress || 0) + dt / Math.max(0.01, fx.duration || 0.28), 0, 1);
      if (fx.progress >= 1) {
        delete playRuntime.doorFx[key];
      }
    });

    if (playRuntime.cameraShake) {
      playRuntime.cameraShake.timeLeft = Math.max(0, Number(playRuntime.cameraShake.timeLeft || 0) - dt);
      if (playRuntime.cameraShake.timeLeft <= 0) {
        playRuntime.cameraShake = null;
      }
    }
  }

  function isRuntimeLocked(playRuntime) {
    return !!(playRuntime?.paused || playRuntime?.dialogue || playRuntime?.activeAction || (Array.isArray(playRuntime?.actionQueue) && playRuntime.actionQueue.length > 0));
  }

  function updateDialogueAndCutscene(dt, playRuntime) {
    const interactQueued = model.state.input.interactQueued === true;

    if (playRuntime.dialogue) {
      if (!interactQueued) {
        return;
      }

      if (playRuntime.dialogue.index < playRuntime.dialogue.lines.length - 1) {
        playRuntime.dialogue.index += 1;
        return;
      }

      playRuntime.dialogue = null;
      advanceActionQueue(model.scene, playRuntime);
      return;
    }

    if (!playRuntime.activeAction) {
      if (Array.isArray(playRuntime.actionQueue) && playRuntime.actionQueue.length > 0) {
        advanceActionQueue(model.scene, playRuntime);
      }
      return;
    }

    const action = playRuntime.activeAction;
    action.elapsed = Math.min(action.duration, action.elapsed + dt);
    const t = action.duration <= 0 ? 1 : clamp(action.elapsed / action.duration, 0, 1);

    if (action.type === "move-player") {
      const player = model.scene.player;
      player.x = Math.round(action.fromX + (action.toX - action.fromX) * t);
      player.y = Math.round(action.fromY + (action.toY - action.fromY) * t);
      clampWorld(player, model.scene.world);
    }

    if (action.type === "move-camera") {
      playRuntime.cameraOverride = {
        x: action.fromX + (action.toX - action.fromX) * t,
        y: action.fromY + (action.toY - action.fromY) * t
      };
    }

    if (t < 1) {
      return;
    }

    playRuntime.activeAction = null;
    advanceActionQueue(model.scene, playRuntime);
  }

  function executeTriggerActions(trigger, scene, playRuntime) {
    const actions = getTriggerActions(trigger, { maxActions: 3 }).map((action) => ({ ...action }));
    playRuntime.actionQueue = actions;
    playRuntime.timelineGuard = {};
    playRuntime.sequenceLabel = trigger.triggerTag || trigger.name || "Gatilho";
    playSfx("trigger");
    advanceActionQueue(scene, playRuntime);
  }

  function advanceActionQueue(scene, playRuntime) {
    while (!playRuntime.dialogue && !playRuntime.activeAction && Array.isArray(playRuntime.actionQueue) && playRuntime.actionQueue.length > 0) {
      const action = playRuntime.actionQueue.shift();
      const blocked = executeTriggerAction(action, playRuntime.sequenceLabel || "Gatilho", scene, playRuntime);
      if (blocked) {
        return;
      }
    }

    if (!playRuntime.dialogue && !playRuntime.activeAction && (!Array.isArray(playRuntime.actionQueue) || playRuntime.actionQueue.length === 0)) {
      playRuntime.sequenceLabel = "";
      playRuntime.cameraOverride = null;
      playRuntime.timelineGuard = {};
    }
  }

  function executeTriggerAction(action, triggerLabel, scene, playRuntime) {
    const actionType = String(action?.type || "message");

    if (actionType === "set-team") {
      playRuntime.playerTeamId = String(action?.value || "").trim();
      const teamLabel = playRuntime.playerTeamId || "nenhuma";
      setStatus?.(`Gatilho ${triggerLabel}: equipe -> ${teamLabel}.`, "ok");
      return false;
    }

    if (actionType === "teleport-spawn" || actionType === "switch-scene") {
      const targetSceneId = String(action?.sceneId || "").trim() || scene.id;
      const changed = onPlaySceneChange?.(targetSceneId);
      if (!changed) {
        setStatus?.(`Gatilho sem cena valida: ${targetSceneId}.`, "danger");
        return false;
      }

      playRuntime.activeTriggerKeys = {};
      seedRuntimeVariables(model.scene, playRuntime, { mergeOnly: true });
      const targetSpawn = movePlayerToSceneSpawn(model.scene, {
        silent: true,
        preferredTag: action?.spawnTag,
        preferredTeamId: playRuntime.playerTeamId,
        fallbackMode: "priority"
      });
      const spawnSuffix = targetSpawn ? ` (ponto inicial: ${targetSpawn.spawnTag || targetSpawn.name})` : "";
      const actionLabel = actionType === "switch-scene" ? "troca de cena" : "teleporte";
      setStatus?.(`Gatilho ${triggerLabel}: ${actionLabel}${spawnSuffix}.`, "ok");
      return false;
    }

    if (actionType === "respawn") {
      respawnPlayer("trigger");
      return false;
    }

    if (actionType === "clear-checkpoint") {
      playRuntime.checkpoint = null;
      setStatus?.(`Gatilho ${triggerLabel}: ponto de controle limpo.`, "ok");
      return false;
    }

    if (actionType === "enable-trigger" || actionType === "disable-trigger") {
      const targetSceneId = String(action?.sceneId || "").trim() || scene.id;
      const targetScene = targetSceneId === scene.id ? scene : model.project.scenes.find((entry) => entry.id === targetSceneId);
      if (!targetScene) {
        setStatus?.(`Gatilho sem cena valida: ${targetSceneId}.`, "danger");
        return false;
      }

      const triggerTag = String(action?.value || "").trim();
      const targets = getGameplayObjectsByType(targetScene, "trigger").filter((item) => item.id === triggerTag || item.triggerTag === triggerTag);
      targets.forEach((item) => {
        item.enabled = actionType === "enable-trigger";
      });
      setStatus?.(
        `Gatilho ${triggerLabel}: ${targets.length} gatilho(s) ${actionType === "enable-trigger" ? "ativado(s)" : "desativado(s)"}.`,
        targets.length > 0 ? "ok" : "danger"
      );
      return false;
    }

    if (actionType === "open-door" || actionType === "close-door") {
      const targetScene = resolveActionScene(scene, action?.sceneId);
      if (!targetScene) {
        setStatus?.(`Gatilho sem cena valida para porta.`, "danger");
        return false;
      }

      const doorTargets = getGameplayObjectsByType(targetScene, "door").filter((door) => matchesTargetTag(door, action?.targetTag));
      const willOpen = actionType === "open-door";
      doorTargets.forEach((door) => {
        if (door.isOpen === willOpen) {
          return;
        }
        door.isOpen = willOpen;
        startDoorMotion(targetScene, door, willOpen ? "opening" : "closing", playRuntime);
      });
      setStatus?.(
        `Gatilho ${triggerLabel}: ${doorTargets.length} porta(s) ${willOpen ? "aberta(s)" : "fechada(s)"}.`,
        doorTargets.length > 0 ? "ok" : "danger"
      );
      return false;
    }

    if (actionType === "play-animation") {
      const targetScene = resolveActionScene(scene, action?.sceneId);
      if (!targetScene) {
        setStatus?.(`Gatilho sem cena valida para animacao.`, "danger");
        return false;
      }

      const animationName = String(action?.value || "pulse").trim();
      const targets = resolveAnimationTargets(targetScene, action?.targetTag);
      targets.forEach((target) => {
        playRuntime.animationFx[makeRuntimeTargetKey(targetScene.id, target.kind, target.object.id)] = {
          name: animationName,
          ttl: 1.2
        };
      });
      setStatus?.(`Gatilho ${triggerLabel}: animacao ${animationName} em ${targets.length} alvo(s).`, targets.length > 0 ? "ok" : "danger");
      return false;
    }

    if (actionType === "set-variable") {
      const variableKey = String(action?.targetTag || "").trim();
      if (!variableKey) {
        setStatus?.(`Gatilho ${triggerLabel}: chave de variavel ausente.`, "danger");
        return false;
      }

      playRuntime.variables[variableKey] = String(action?.value || "");
      setStatus?.(`Gatilho ${triggerLabel}: variavel ${variableKey} = ${playRuntime.variables[variableKey]}.`, "ok");
      return false;
    }

    if (actionType === "play-timeline") {
      const timelineId = String(action?.timelineId || action?.value || "").trim();
      if (!timelineId) {
        setStatus?.(`Gatilho ${triggerLabel}: timeline ausente.`, "danger");
        return false;
      }

      const timeline = resolveTimeline(model.project, timelineId);
      if (!timeline) {
        setStatus?.(`Gatilho ${triggerLabel}: timeline nao encontrada (${timelineId}).`, "danger");
        return false;
      }

      if (!playRuntime.timelineGuard || typeof playRuntime.timelineGuard !== "object") {
        playRuntime.timelineGuard = {};
      }

      const visitCount = Number(playRuntime.timelineGuard[timeline.id] || 0) + 1;
      if (visitCount > 4) {
        setStatus?.(`Timeline ${timeline.name || timeline.id} bloqueada por loop.`, "danger");
        return false;
      }
      playRuntime.timelineGuard[timeline.id] = visitCount;

      const timelineActions = Array.isArray(timeline.actions) ? timeline.actions.map((entry) => ({ ...entry })) : [];
      if (timelineActions.length === 0) {
        setStatus?.(`Timeline ${timeline.name || timeline.id} vazia.`, "danger");
        return false;
      }

      const tailQueue = Array.isArray(playRuntime.actionQueue) ? playRuntime.actionQueue : [];
      playRuntime.actionQueue = timelineActions.concat(tailQueue).slice(0, 96);
      setStatus?.(`Timeline ${timeline.name || timeline.id} iniciada.`, "ok");
      return false;
    }

    if (actionType === "start-dialogue") {
      const lines = (Array.isArray(action?.lines) ? action.lines : []).map((line) => String(line || "").trim()).filter(Boolean);
      if (lines.length === 0 && String(action?.value || "").trim()) {
        lines.push(String(action.value || "").trim());
      }
      if (lines.length === 0) {
        return false;
      }

      playRuntime.dialogue = {
        speaker: String(action?.speaker || triggerLabel || "Narrador"),
        lines,
        index: 0
      };
      return true;
    }

    if (actionType === "move-player" || actionType === "move-camera") {
      const currentScene = model.scene || scene;
      const duration = Math.max(0.05, Number.isFinite(Number(action?.duration)) ? Number(action.duration) : 0.6);
      const fromPoint =
        actionType === "move-camera"
          ? {
              x: playRuntime.cameraOverride?.x ?? currentScene.player.x + currentScene.player.w / 2,
              y: playRuntime.cameraOverride?.y ?? currentScene.player.y + currentScene.player.h / 2
            }
          : {
              x: currentScene.player.x,
              y: currentScene.player.y
            };

      playRuntime.activeAction = {
        type: actionType,
        elapsed: 0,
        duration,
        fromX: fromPoint.x,
        fromY: fromPoint.y,
        toX: Math.round(Number.isFinite(Number(action?.x)) ? Number(action.x) : fromPoint.x),
        toY: Math.round(Number.isFinite(Number(action?.y)) ? Number(action.y) : fromPoint.y)
      };

      if (actionType === "move-camera" && !playRuntime.cameraOverride) {
        playRuntime.cameraOverride = { x: fromPoint.x, y: fromPoint.y };
      }

      return true;
    }

    const message = String(action?.value || triggerLabel || "Gatilho ativado.").trim();
    setStatus?.(message, "ok");
    return false;
  }

  function resolveActionScene(currentScene, targetSceneId) {
    const cleanSceneId = String(targetSceneId || "").trim();
    if (!cleanSceneId || cleanSceneId === currentScene.id) {
      return currentScene;
    }
    return model.project.scenes.find((entry) => entry.id === cleanSceneId) || null;
  }

  function matchesTargetTag(object, targetTag) {
    const cleanTarget = String(targetTag || "").trim();
    if (!cleanTarget) {
      return false;
    }

    return [
      object.id,
      object.name,
      object.doorTag,
      object.triggerTag,
      object.spawnTag,
      object.checkpointId
    ]
      .filter(Boolean)
      .some((value) => String(value).trim() === cleanTarget);
  }

  function resolveAnimationTargets(scene, targetTag) {
    const cleanTarget = String(targetTag || "").trim();
    if (!cleanTarget) {
      return [];
    }

    const targets = [];
    if (["player", "Player", "jogador", "Jogador"].includes(cleanTarget)) {
      targets.push({ kind: "entity", object: scene.player });
    }
    if (["enemy", "Enemy", "inimigo", "Inimigo"].includes(cleanTarget)) {
      targets.push({ kind: "entity", object: scene.enemy });
    }

    scene.walls.forEach((wall) => {
      if ([wall.id, wall.name].filter(Boolean).some((value) => String(value).trim() === cleanTarget)) {
        targets.push({ kind: "wall", object: wall });
      }
    });

    scene.gameObjects.forEach((item) => {
      if (matchesTargetTag(item, cleanTarget)) {
        targets.push({ kind: "gameplayObject", object: item });
      }
    });

    return targets;
  }

  function resolveTimeline(project, timelineId) {
    const cleanId = String(timelineId || "").trim();
    if (!cleanId) {
      return null;
    }

    const timelines = Array.isArray(project?.timelines) ? project.timelines : [];
    const byId = timelines.find((timeline) => String(timeline?.id || "").trim() === cleanId);
    if (byId) {
      return byId;
    }

    const lowerId = cleanId.toLowerCase();
    return timelines.find((timeline) => String(timeline?.name || "").trim().toLowerCase() === lowerId) || null;
  }

  function startDoorMotion(scene, door, mode, playRuntime) {
    playRuntime.doorFx[makeRuntimeTargetKey(scene.id, "gameplayObject", door.id)] = {
      mode,
      progress: 0,
      duration: 0.28
    };
  }

  function getDoorOpenAmount(sceneId, door, playRuntime) {
    const fx = playRuntime.doorFx?.[makeRuntimeTargetKey(sceneId, "gameplayObject", door.id)];
    if (!fx) {
      return door.isOpen === true ? 1 : 0;
    }

    const progress = clamp(fx.progress || 0, 0, 1);
    return fx.mode === "closing" ? 1 - progress : progress;
  }

  function syncPortal(scene, player, playRuntime) {
    const portals = getOverlappingGameplayObjects(scene, player, "portal");
    if (playRuntime.portalLockKey && !portals.some((portal) => makeGameplayKey(scene.id, portal.id) === playRuntime.portalLockKey)) {
      playRuntime.portalLockKey = null;
    }

    if (playRuntime.portalCooldown > 0 || portals.length === 0) {
      return;
    }

    const portal = portals[0];
    const portalKey = makeGameplayKey(scene.id, portal.id);
    if (playRuntime.portalLockKey === portalKey) {
      return;
    }

    playRuntime.portalLockKey = portalKey;
    playRuntime.portalCooldown = 0.35;

    const sourceSceneName = scene.name;
    const targetSceneId = String(portal.targetSceneId || "").trim() || scene.id;
    const changed = onPlaySceneChange?.(targetSceneId);
    if (!changed) {
      setStatus?.(`Portal sem cena valida: ${targetSceneId}.`, "danger");
      return;
    }

    playRuntime.activeTriggerKeys = {};
    seedRuntimeVariables(model.scene, playRuntime, { mergeOnly: true });
    const preferredTag = String(portal.targetSpawnTag || "").trim();
    const preferredTeamId = String(portal.targetTeamId || "").trim() || playRuntime.playerTeamId;
    const targetSpawn = movePlayerToSceneSpawn(model.scene, {
      silent: true,
      preferredTag,
      preferredTeamId,
      fallbackMode: portal.fallbackMode
    });
    const spawnSuffix = targetSpawn ? ` (ponto inicial: ${targetSpawn.spawnTag || targetSpawn.name})` : "";
    playSfx("portal");
    setStatus?.(`Portal: ${sourceSceneName} -> ${model.scene.name}${spawnSuffix}.`, "ok");
  }

  function respawnPlayer(reason) {
    const playRuntime = ensurePlayRuntimeState();

    if (playRuntime.checkpoint?.sceneId) {
      const switched = onPlaySceneChange?.(playRuntime.checkpoint.sceneId);
      if (switched) {
        seedRuntimeVariables(model.scene, playRuntime, { mergeOnly: true });
        const checkpoint = findCheckpointById(model.scene, playRuntime.checkpoint.objectId);
        if (checkpoint && placeBodyAtMarker(model.scene.player, checkpoint, model.scene.world)) {
          playRuntime.activeTriggerKeys = {};
          playRuntime.respawnInvuln = 0.75;
          playRuntime.portalCooldown = Math.max(playRuntime.portalCooldown, 0.35);
          setStatus?.(`Retorno no ponto de controle ${playRuntime.checkpoint.label}.`, "ok");
          return true;
        }
      }

      playRuntime.checkpoint = null;
    }

    const moved = movePlayerToSceneSpawn(model.scene, { silent: true });
    playRuntime.respawnInvuln = 0.75;
    playRuntime.portalCooldown = Math.max(playRuntime.portalCooldown, 0.35);

    if (reason === "enemy") {
      setStatus?.(moved ? `Jogador atingido pelo inimigo. Retorno em ${model.scene.name}.` : "Jogador atingido pelo inimigo.", moved ? "ok" : "danger");
      playSfx("respawn");
    }

    return moved;
  }

  function movePlayerToSceneSpawn(scene, options = {}) {
    const preferredTag = String(options.preferredTag || "").trim() || "player_start";
    const preferredTeamId = String(options.preferredTeamId || "").trim();
    const spawn = findSpawnPoint(scene, preferredTag, {
      teamId: preferredTeamId,
      fallbackMode: options.fallbackMode
    });
    const moved = spawn ? placeBodyAtMarker(scene.player, spawn, scene.world) : false;
    const playRuntime = ensurePlayRuntimeState();
    playRuntime.respawnInvuln = 0.75;
    playRuntime.portalCooldown = Math.max(playRuntime.portalCooldown, 0.2);

    if (!options.silent && moved) {
      const teamSuffix = spawn.teamId ? ` [${spawn.teamId}]` : "";
      setStatus?.(`Ponto inicial ativo: ${spawn.spawnTag || spawn.name}${teamSuffix}.`, "ok");
    }

    return moved ? spawn : null;
  }

  function moveWithCollisions(body, dx, dy, scene, tileMaps) {
    const world = scene.world;
    if (body.colliderEnabled === false || body.colliderIsTrigger === true) {
      body.x += dx;
      body.y += dy;
      clampWorld(body, world);
      return { collidedX: false, collidedY: false };
    }

    let collidedX = false;
    let collidedY = false;

    body.x += dx;
    clampWorld(body, world);
    let collider = getColliderRect(body, { includeDisabled: true }) || body;
    getBlockingRects(body, scene, tileMaps, collider).forEach((obstacle) => {
      if (!overlap(collider, obstacle)) return;
      if (dx > 0) {
        const nextColliderX = obstacle.x - collider.w;
        body.x += nextColliderX - collider.x;
        collidedX = true;
      }
      if (dx < 0) {
        const nextColliderX = obstacle.x + obstacle.w;
        body.x += nextColliderX - collider.x;
        collidedX = true;
      }
      collider = getColliderRect(body, { includeDisabled: true }) || body;
    });

    body.y += dy;
    clampWorld(body, world);
    collider = getColliderRect(body, { includeDisabled: true }) || body;
    getBlockingRects(body, scene, tileMaps, collider).forEach((obstacle) => {
      if (!overlap(collider, obstacle)) return;
      if (dy > 0) {
        const nextColliderY = obstacle.y - collider.h;
        body.y += nextColliderY - collider.y;
        collidedY = true;
      }
      if (dy < 0) {
        const nextColliderY = obstacle.y + obstacle.h;
        body.y += nextColliderY - collider.y;
        collidedY = true;
      }
      collider = getColliderRect(body, { includeDisabled: true }) || body;
    });

    clampWorld(body, world);
    return { collidedX, collidedY };
  }

  function getBlockingRects(body, scene, tileMaps, colliderRect = null) {
    const wallRects = scene.walls.map((wall) => getColliderRect(wall)).filter(Boolean);
    const doorRects = getClosedDoors(scene).map((door) => getColliderRect(door)).filter(Boolean);
    const collisionBody = colliderRect || getColliderRect(body, { includeDisabled: true }) || body;
    return wallRects.concat(doorRects, getCollisionRectsForBody(scene, tileMaps, collisionBody));
  }

  function getBodyVelocity(playRuntime, bodyKey, body) {
    if (!playRuntime.bodyVelocity || typeof playRuntime.bodyVelocity !== "object") {
      playRuntime.bodyVelocity = {};
    }

    if (!playRuntime.bodyVelocity[bodyKey]) {
      playRuntime.bodyVelocity[bodyKey] = {
        x: Number.isFinite(Number(body?.velocityX)) ? Number(body.velocityX) : 0,
        y: Number.isFinite(Number(body?.velocityY)) ? Number(body.velocityY) : 0
      };
    }

    return playRuntime.bodyVelocity[bodyKey];
  }

  function stepRigidbody(body, velocity, dt, scene, tileMaps) {
    const type = normalizeRigidbodyType(body.rigidbodyType, "kinematic");
    if (type === "static") {
      velocity.x = 0;
      velocity.y = 0;
      return;
    }

    if (type === "dynamic") {
      const gravityScale = Number.isFinite(Number(body.gravityScale)) ? Number(body.gravityScale) : 0;
      const linearDamping = Math.max(0, Number.isFinite(Number(body.linearDamping)) ? Number(body.linearDamping) : 0);
      const surfaceFriction = resolveBodySurfaceFriction(scene, tileMaps, body);
      velocity.y += 980 * gravityScale * dt;
      const dampingFactor = Math.max(0, 1 - linearDamping * dt);
      velocity.x *= dampingFactor;
      velocity.y *= dampingFactor;
      const frictionFactor = Math.max(0, 1 - surfaceFriction * dt * 1.35);
      velocity.x *= frictionFactor;
      if (gravityScale === 0) {
        velocity.y *= frictionFactor;
      }
    }

    const result = moveWithCollisions(body, velocity.x * dt, velocity.y * dt, scene, tileMaps);
    const restitution = clamp(Number.isFinite(Number(body.restitution)) ? Number(body.restitution) : 0, 0, 1);
    if (result.collidedX) {
      velocity.x = Math.abs(velocity.x) < 8 ? 0 : -velocity.x * restitution;
    }
    if (result.collidedY) {
      velocity.y = Math.abs(velocity.y) < 8 ? 0 : -velocity.y * restitution;
    }
  }

  function resolveBodySurfaceFriction(scene, tileMaps, body) {
    const surfaceFriction = scene?.physics?.surfaceFriction && typeof scene.physics.surfaceFriction === "object"
      ? scene.physics.surfaceFriction
      : {};
    const fallback = Number.isFinite(Number(surfaceFriction.default)) ? Number(surfaceFriction.default) : 0.22;
    if (!body || !scene?.world || !tileMaps) {
      return clamp(fallback, 0, 2);
    }

    const collider = getColliderRect(body, { includeDisabled: true }) || body;
    const centerX = Number(collider.x || 0) + Number(collider.w || 0) * 0.5;
    const centerY = Number(collider.y || 0) + Number(collider.h || 0) * 0.5;
    if (centerX < 0 || centerY < 0 || centerX >= scene.world.width || centerY >= scene.world.height) {
      return clamp(fallback, 0, 2);
    }

    const tileSize = Math.max(1, Number(scene.world.tileSize || 32));
    const tx = Math.floor(centerX / tileSize);
    const ty = Math.floor(centerY / tileSize);
    const key = `${tx},${ty}`;
    const collisionMap = tileMaps?.collision instanceof Map ? tileMaps.collision : null;
    const gameplayMap = tileMaps?.gameplay instanceof Map ? tileMaps.gameplay : null;
    const tileId = collisionMap?.get(key) ?? gameplayMap?.get(key) ?? 0;
    if (!tileId) {
      return clamp(fallback, 0, 2);
    }

    const tile = TILE_BY_ID.get(Number(tileId));
    const materialId = String(tile?.surfaceMaterial || "default").trim().toLowerCase();
    const frictionValue = Number.isFinite(Number(surfaceFriction[materialId])) ? Number(surfaceFriction[materialId]) : fallback;
    return clamp(frictionValue, 0, 2);
  }

  function resolveSurfaceSpeedFactor(surfaceFriction) {
    const friction = clamp(Number.isFinite(Number(surfaceFriction)) ? Number(surfaceFriction) : 0.22, 0, 2);
    return clamp(1 - friction * 0.55, 0.2, 1.12);
  }

  function normalizeRigidbodyType(type, fallback = "static") {
    const cleanType = String(type || fallback).trim().toLowerCase();
    if (cleanType === "dynamic" || cleanType === "kinematic" || cleanType === "static") {
      return cleanType;
    }
    return fallback;
  }

  function overlapsBody(left, right) {
    const leftRect = getColliderRect(left, { includeDisabled: true }) || left;
    const rightRect = getColliderRect(right);
    if (!rightRect) {
      return false;
    }
    return overlap(leftRect, rightRect);
  }

  function updateCamera(dt) {
    const scene = model.scene;
    const state = model.state;
    const playRuntime = state.playRuntime || {};
    const selected = getObjectByRef(scene, getSelectedRef());
    const target = state.mode === "edit" ? selected || scene.player : scene.player;
    const baseCameraConfig = resolveSceneCameraConfig(scene);
    const activeCameraZone = state.mode === "play" ? resolveActiveCameraZone(scene, scene.player) : null;
    const zoneKey = activeCameraZone ? makeGameplayKey(scene.id, activeCameraZone.id) : null;
    if (state.mode === "play") {
      if (zoneKey !== playRuntime.activeCameraZoneKey) {
        if (activeCameraZone?.shakeOnEnter === true) {
          triggerCameraShake(playRuntime, {
            intensity: activeCameraZone.shakeIntensity,
            duration: activeCameraZone.shakeDuration,
            frequency: activeCameraZone.shakeFrequency
          }, baseCameraConfig);
        }
        playRuntime.activeCameraZoneKey = zoneKey;
      }
    } else {
      playRuntime.activeCameraZoneKey = null;
    }

    const zoneBlend = state.mode === "play" ? resolveCameraZoneBlend(playRuntime, scene, activeCameraZone, baseCameraConfig, dt) : null;
    if (state.mode !== "play") {
      playRuntime.cameraZoneBlend = null;
    }

    const cameraConfig = baseCameraConfig;
    const cameraFocus =
      state.mode === "play" && playRuntime.cameraOverride
        ? {
            x: playRuntime.cameraOverride.x,
            y: playRuntime.cameraOverride.y,
            w: 0,
            h: 0
          }
        : target;
    const targetCenter = {
      x: Number(cameraFocus.x || 0) + Number(cameraFocus.w || 0) * 0.5 + Number(zoneBlend?.offsetX || 0),
      y: Number(cameraFocus.y || 0) + Number(cameraFocus.h || 0) * 0.5 + Number(zoneBlend?.offsetY || 0)
    };
    const followInput = state.mode === "play" ? state.input : { left: false, right: false, up: false, down: false };
    const lookAhead = {
      x: (followInput.right ? 1 : 0) - (followInput.left ? 1 : 0),
      y: (followInput.down ? 1 : 0) - (followInput.up ? 1 : 0)
    };
    const hasEditorZoomOverride = state.mode === "edit" && Number.isFinite(Number(state.editorZoomOverride));
    const editZoom = hasEditorZoomOverride ? clamp(Number(state.editorZoomOverride), 0.35, 3) : null;
    const zoneZoom = state.mode === "play" && Number.isFinite(Number(zoneBlend?.zoom)) ? Number(zoneBlend.zoom) : cameraConfig.zoom;
    const zoom = state.viewportRenderer === "native-3d" ? 1 : editZoom ?? zoneZoom;
    const manualCenter =
      state.mode === "edit" && state.editorCameraManual && Number.isFinite(Number(state.editorCameraManual.x)) && Number.isFinite(Number(state.editorCameraManual.y))
        ? { x: Number(state.editorCameraManual.x), y: Number(state.editorCameraManual.y) }
        : null;

    state.cam.w = Math.max(1, canvas.width / zoom);
    state.cam.h = Math.max(1, canvas.height / zoom);

    const followCenter = manualCenter || updateCameraRig(state, playRuntime, targetCenter, lookAhead, cameraConfig, dt);
    const confine = cameraConfig.confineToWorld !== false;
    state.cam.x = followCenter.x - state.cam.w * 0.5;
    state.cam.y = followCenter.y - state.cam.h * 0.5;

    if (confine) {
      state.cam.x = clamp(state.cam.x, 0, Math.max(0, scene.world.width - state.cam.w));
      state.cam.y = clamp(state.cam.y, 0, Math.max(0, scene.world.height - state.cam.h));
    }

    if (state.mode === "play") {
      const shakeOffset = resolveCameraShakeOffset(playRuntime, cameraConfig);
      if (shakeOffset.x || shakeOffset.y) {
        state.cam.x += shakeOffset.x;
        state.cam.y += shakeOffset.y;
        if (confine) {
          state.cam.x = clamp(state.cam.x, 0, Math.max(0, scene.world.width - state.cam.w));
          state.cam.y = clamp(state.cam.y, 0, Math.max(0, scene.world.height - state.cam.h));
        }
      }
    }

    if (scene?.physics?.pixelPerfect === true) {
      const pixelStep = resolvePixelSnapStep(scene);
      state.cam.x = snapToStep(state.cam.x, pixelStep);
      state.cam.y = snapToStep(state.cam.y, pixelStep);
    }

    if (state.viewportRenderer === "native-3d") {
      state.nativeCamera = createNativeCameraState(state.nativeCamera);
      const effectiveNativeCamera = getActiveNativeCameraState(scene, state);
      const config = createNativePreviewConfig(scene, state.cam, { width: canvas.width || 1, height: canvas.height || 1 }, effectiveNativeCamera);
      const followSuffix = state.mode === "play" ? " seguindo" : "";
      ui.camera.textContent = `Camera: N3D${followSuffix} ${Math.round(config.focusX)},${Math.round(config.focusY)} / z${config.zoom.toFixed(2)}`;
      return;
    }

    const manualSuffix = manualCenter ? " manual" : "";
    const zoomSuffix = hasEditorZoomOverride ? " editor" : "";
    const zoneSuffix = state.mode === "play" && activeCameraZone ? ` / zona ${activeCameraZone.name || activeCameraZone.id}` : "";
    ui.camera.textContent = `Camera: ${Math.round(state.cam.x)},${Math.round(state.cam.y)} / zoom ${zoom.toFixed(2)}${zoomSuffix}${manualSuffix}${zoneSuffix}`;
  }

  function resolveSceneCameraConfig(scene) {
    const camera = scene?.camera2D || {};
    return {
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
  }

  function resolveCameraZoneBlend(playRuntime, scene, activeZone, cameraConfig, dt) {
    const targetZoneKey = activeZone ? makeGameplayKey(scene.id, activeZone.id) : null;
    const targetZoom = Number.isFinite(Number(activeZone?.cameraZoneZoom)) && Number(activeZone.cameraZoneZoom) > 0
      ? clamp(Number(activeZone.cameraZoneZoom), 0.35, 3)
      : Number(cameraConfig.zoom || 1);
    const targetOffsetX = Number.isFinite(Number(activeZone?.cameraZoneOffsetX)) ? Number(activeZone.cameraZoneOffsetX) : 0;
    const targetOffsetY = Number.isFinite(Number(activeZone?.cameraZoneOffsetY)) ? Number(activeZone.cameraZoneOffsetY) : 0;

    if (!playRuntime.cameraZoneBlend) {
      playRuntime.cameraZoneBlend = {
        zoneKey: targetZoneKey,
        zoom: targetZoom,
        offsetX: targetOffsetX,
        offsetY: targetOffsetY
      };
      return playRuntime.cameraZoneBlend;
    }

    const blend = playRuntime.cameraZoneBlend;
    const blendTime = Math.max(0.06, Math.min(1.2, Number(cameraConfig.damping || 0.16) * 1.4));
    const alpha = clamp(dt / blendTime, 0.04, 1);

    blend.zoom += (targetZoom - blend.zoom) * alpha;
    blend.offsetX += (targetOffsetX - blend.offsetX) * alpha;
    blend.offsetY += (targetOffsetY - blend.offsetY) * alpha;
    blend.zoneKey = targetZoneKey;

    if (Math.abs(blend.zoom - targetZoom) < 0.001) {
      blend.zoom = targetZoom;
    }
    if (Math.abs(blend.offsetX - targetOffsetX) < 0.01) {
      blend.offsetX = targetOffsetX;
    }
    if (Math.abs(blend.offsetY - targetOffsetY) < 0.01) {
      blend.offsetY = targetOffsetY;
    }

    return blend;
  }

  function resolveActiveCameraZone(scene, body) {
    const zones = getGameplayObjectsByType(scene, "cameraZone")
      .filter((item) => item?.enabled !== false)
      .map((zone) => {
        const rect = getColliderRect(zone, { includeDisabled: true }) || zone;
        return {
          zone,
          rect,
          priority: Number.isFinite(Number(zone.cameraZonePriority)) ? Math.round(Number(zone.cameraZonePriority)) : 0,
          area: Math.max(1, Number(rect?.w || 1) * Number(rect?.h || 1))
        };
      })
      .filter((entry) => entry.rect && overlapsBody(body, entry.rect));

    if (zones.length === 0) {
      return null;
    }

    zones.sort((left, right) => right.priority - left.priority || left.area - right.area || Number(left.zone.y || 0) - Number(right.zone.y || 0));
    return zones[0].zone;
  }

  function triggerCameraShake(playRuntime, options = {}, cameraConfig = null) {
    const baseIntensity = Number.isFinite(Number(cameraConfig?.shakeIntensity)) ? Number(cameraConfig.shakeIntensity) : 12;
    const baseDuration = Number.isFinite(Number(cameraConfig?.shakeDuration)) ? Number(cameraConfig.shakeDuration) : 0.28;
    const baseFrequency = Number.isFinite(Number(cameraConfig?.shakeFrequency)) ? Number(cameraConfig.shakeFrequency) : 32;
    const intensity = Math.max(0, Number.isFinite(Number(options.intensity)) ? Number(options.intensity) : baseIntensity);
    const duration = Math.max(0.01, Number.isFinite(Number(options.duration)) ? Number(options.duration) : baseDuration);
    const frequency = Math.max(1, Number.isFinite(Number(options.frequency)) ? Number(options.frequency) : baseFrequency);

    if (intensity <= 0) {
      return;
    }

    playRuntime.cameraShake = {
      intensity,
      duration,
      timeLeft: duration,
      frequency,
      seedX: Math.random() * 100,
      seedY: Math.random() * 100
    };
  }

  function resolveCameraShakeOffset(playRuntime, cameraConfig) {
    if (!playRuntime?.cameraShake || cameraConfig?.shakeEnabled === false) {
      return { x: 0, y: 0 };
    }

    const shake = playRuntime.cameraShake;
    const life = shake.duration > 0 ? clamp(shake.timeLeft / shake.duration, 0, 1) : 0;
    if (life <= 0) {
      return { x: 0, y: 0 };
    }

    const envelope = life * life;
    const amplitude = Number(shake.intensity || 0) * envelope;
    const frequency = Math.max(1, Number(shake.frequency || cameraConfig?.shakeFrequency || 32));
    const now = performance.now() / 1000;
    return {
      x: Math.sin((now + Number(shake.seedX || 0)) * frequency) * amplitude * 0.65,
      y: Math.cos((now + Number(shake.seedY || 0)) * frequency * 1.07) * amplitude
    };
  }

  function updateCameraRig(state, playRuntime, targetCenter, lookAhead, cameraConfig, dt) {
    const usePlayRig = state.mode === "play";
    const keepRigInEdit = cameraConfig.followDuringEdit === true;
    if (!usePlayRig && !keepRigInEdit) {
      return targetCenter;
    }

    const rigState = usePlayRig
      ? (playRuntime.cameraRig = playRuntime.cameraRig || { x: targetCenter.x, y: targetCenter.y })
      : (state.editorCameraRig = state.editorCameraRig || { x: targetCenter.x, y: targetCenter.y });

    const desiredCenter = {
      x: targetCenter.x + lookAhead.x * cameraConfig.lookAheadX,
      y: targetCenter.y + lookAhead.y * cameraConfig.lookAheadY
    };

    const halfDeadZoneW = cameraConfig.deadZoneW * 0.5;
    const halfDeadZoneH = cameraConfig.deadZoneH * 0.5;
    const deadZoneLeft = rigState.x - halfDeadZoneW;
    const deadZoneRight = rigState.x + halfDeadZoneW;
    const deadZoneTop = rigState.y - halfDeadZoneH;
    const deadZoneBottom = rigState.y + halfDeadZoneH;

    let nextX = rigState.x;
    let nextY = rigState.y;

    if (desiredCenter.x < deadZoneLeft) {
      nextX = desiredCenter.x + halfDeadZoneW;
    } else if (desiredCenter.x > deadZoneRight) {
      nextX = desiredCenter.x - halfDeadZoneW;
    }

    if (desiredCenter.y < deadZoneTop) {
      nextY = desiredCenter.y + halfDeadZoneH;
    } else if (desiredCenter.y > deadZoneBottom) {
      nextY = desiredCenter.y - halfDeadZoneH;
    }

    const blend = cameraConfig.mode === "snap" ? 1 : clamp(dt / cameraConfig.damping, 0.02, 1);
    rigState.x += (nextX - rigState.x) * blend;
    rigState.y += (nextY - rigState.y) * blend;
    return { x: rigState.x, y: rigState.y };
  }

  function draw() {
    const scene = model.scene;
    const state = model.state;
    const pixelPerfect = scene?.physics?.pixelPerfect === true;
    ctx.imageSmoothingEnabled = !pixelPerfect;
    ctx.imageSmoothingQuality = pixelPerfect ? "low" : "high";

    if (state.viewportRenderer === "native-3d") {
      const config = drawNativeScene(ctx, scene, state, { width: canvas.width || 1, height: canvas.height || 1 }, "VIEWPORT 3D NATIVO");
      drawNativePaintPreview(scene, state, config);
      drawSelectionBox(state);
      drawNativeSnapGuides(ctx, state, config);
      drawNativeSelection(ctx, scene, state, config);
      drawNative3DPreview(scene, state);
      drawRuntimeOverlay(state);
      return;
    }

    const zoom = clamp((canvas.width || 1) / Math.max(1, state.cam.w || 1), 0.35, 3);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (zoom !== 1) {
      ctx.scale(zoom, zoom);
    }
    if (state.showGrid !== false) {
      drawGrid(scene, state);
    }
    drawLayerTiles(scene, state, "background");
    drawLayerTiles(scene, state, "gameplay");

    drawPatrol(scene, state);
    drawWorldObjects(scene, state);

    drawLayerTiles(scene, state, "collision");
    drawLayerTiles(scene, state, "foreground");
    drawPaintPreview(scene, state);
    drawLightingOverlay(scene, state);
    drawSelectionBox(state);
    drawSnapGuides(state);
    drawSelection(scene, state);
    ctx.restore();
    drawNative3DPreview(scene, state);
    drawRuntimeOverlay(state);
  }

  function drawRuntimeOverlay(state) {
    if (state.mode !== "play") {
      return;
    }

    const scene = model.scene;
    const ui2D = resolveSceneUi2D(scene);
    const playRuntime = state.playRuntime || {};
    if (ui2D.showHud) {
      drawHudOverlay(scene, playRuntime);
    }

    if (playRuntime.dialogue) {
      drawDialogueOverlay(playRuntime.dialogue);
      return;
    }

    if (playRuntime.paused && ui2D.showPauseOverlay) {
      drawPauseOverlay();
    }

    if (!ui2D.showHints) {
      return;
    }

    if (!playRuntime.interactionHint) {
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(11, 16, 23, 0.88)";
    ctx.strokeStyle = "rgba(160, 206, 255, 0.6)";
    ctx.lineWidth = 1.5;
    const width = Math.min(canvas.width - 32, 320);
    const x = Math.max(16, Math.round((canvas.width - width) / 2));
    const y = Math.max(16, canvas.height - 92);
    const h = 46;
    roundRectPath(ctx, x, y, width, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4fbff";
    ctx.font = "600 14px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Pressione E para interagir com ${playRuntime.interactionHint.label}.`, x + width / 2, y + 28);
    ctx.restore();
  }

  function drawHudOverlay(scene, playRuntime) {
    const x = 12;
    const y = 12;
    const width = Math.min(360, canvas.width - 24);
    const lineHeight = 18;
    const checkpointLabel = playRuntime.checkpoint?.label ? String(playRuntime.checkpoint.label) : "-";
    const teamLabel = playRuntime.playerTeamId ? String(playRuntime.playerTeamId) : "sem equipe";
    const varsCount = Object.keys(playRuntime.variables || {}).length;
    const pauseLabel = playRuntime.paused ? "PAUSADO" : "ATIVO";
    const lines = [
      `${scene.name} | ${pauseLabel}`,
      `Equipe: ${teamLabel}`,
      `Checkpoint: ${checkpointLabel}`,
      `Variaveis runtime: ${varsCount}`,
      "ESC pausa | E interage"
    ];
    const height = lines.length * lineHeight + 16;

    ctx.save();
    ctx.fillStyle = "rgba(9, 14, 21, 0.74)";
    ctx.strokeStyle = "rgba(140, 195, 255, 0.48)";
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, x, y, width, height, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    lines.forEach((line, index) => {
      ctx.fillText(line, x + 12, y + 20 + index * lineHeight);
    });
    ctx.restore();
  }

  function drawPauseOverlay() {
    const width = Math.min(canvas.width - 48, 460);
    const height = 130;
    const x = Math.round((canvas.width - width) / 2);
    const y = Math.round((canvas.height - height) / 2);

    ctx.save();
    ctx.fillStyle = "rgba(6, 10, 16, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
    ctx.strokeStyle = "rgba(133, 194, 255, 0.8)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, width, height, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f2f8ff";
    ctx.font = "700 24px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Jogo Pausado", x + width / 2, y + 50);
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(228, 240, 255, 0.88)";
    ctx.fillText("Pressione ESC para continuar", x + width / 2, y + 84);
    ctx.restore();
  }

  function drawDialogueOverlay(dialogue) {
    const width = Math.min(canvas.width - 48, 680);
    const height = 150;
    const x = Math.max(24, Math.round((canvas.width - width) / 2));
    const y = Math.max(20, canvas.height - height - 24);
    const line = dialogue.lines[dialogue.index] || "";

    ctx.save();
    ctx.fillStyle = "rgba(8, 12, 18, 0.92)";
    ctx.strokeStyle = "rgba(114, 193, 255, 0.82)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, width, height, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#72c1ff";
    ctx.font = "700 18px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(dialogue.speaker || "Narrador", x + 22, y + 34);

    ctx.fillStyle = "#f4fbff";
    ctx.font = "500 17px 'Space Grotesk', sans-serif";
    wrapCanvasText(ctx, line, x + 22, y + 64, width - 44, 24);

    ctx.fillStyle = "rgba(227, 240, 255, 0.82)";
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("E / Enter / Espaco para continuar", x + width - 20, y + height - 16);
    ctx.restore();
  }

  function getSpriteRegistry(project) {
    const registry = new Map();
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

        const key = `${atlasId}:${spriteId}`;
        registry.set(key, {
          key,
          atlasId,
          spriteId,
          imageSrc: String(atlas?.imageSrc || "").trim(),
          x: Number.isFinite(Number(sprite?.x)) ? Math.round(Number(sprite.x)) : 0,
          y: Number.isFinite(Number(sprite?.y)) ? Math.round(Number(sprite.y)) : 0,
          w: Math.max(1, Number.isFinite(Number(sprite?.w)) ? Math.round(Number(sprite.w)) : 32),
          h: Math.max(1, Number.isFinite(Number(sprite?.h)) ? Math.round(Number(sprite.h)) : 32),
          pivotX: clamp(Number.isFinite(Number(sprite?.pivotX)) ? Number(sprite.pivotX) : 0, 0, 1),
          pivotY: clamp(Number.isFinite(Number(sprite?.pivotY)) ? Number(sprite.pivotY) : 0, 0, 1)
        });
      });
    });

    return registry;
  }

  function getAnimationRegistry(project) {
    const registry = new Map();
    const animations = Array.isArray(project?.spriteAnimations) ? project.spriteAnimations : [];

    animations.forEach((animation) => {
      const animationId = String(animation?.id || "").trim();
      if (!animationId) {
        return;
      }

      const frames = Array.isArray(animation.frames)
        ? animation.frames.map((frame) => String(frame || "").trim()).filter(Boolean)
        : [];
      if (frames.length === 0) {
        return;
      }

      registry.set(animationId, {
        id: animationId,
        fps: Math.max(1, Number.isFinite(Number(animation?.fps)) ? Number(animation.fps) : 8),
        loop: animation?.loop !== false,
        frames
      });
    });

    return registry;
  }

  function getSpriteImage(imageSrc) {
    if (!imageSrc) {
      return null;
    }

    const cached = spriteImageCache.get(imageSrc);
    if (cached) {
      return cached.ready ? cached.image : null;
    }

    const image = new Image();
    const entry = {
      image,
      ready: false
    };
    image.onload = () => {
      entry.ready = true;
    };
    image.onerror = () => {
      entry.ready = false;
    };
    image.src = imageSrc;
    spriteImageCache.set(imageSrc, entry);
    return null;
  }

  function drawSpriteRect(renderCtx, object, rect, spriteRegistry, animationRegistry, timeSeconds) {
    const spriteId = resolveObjectSpriteId(object, animationRegistry, timeSeconds);
    if (!spriteId) {
      return false;
    }

    const sprite = spriteRegistry.get(spriteId);
    if (!sprite) {
      return false;
    }

    const image = getSpriteImage(sprite.imageSrc);
    if (!image) {
      return false;
    }

    const pivotX = clamp(Number.isFinite(Number(object?.pivotX)) ? Number(object.pivotX) : sprite.pivotX, 0, 1);
    const pivotY = clamp(Number.isFinite(Number(object?.pivotY)) ? Number(object.pivotY) : sprite.pivotY, 0, 1);
    const spriteOpacity = clamp(Number.isFinite(Number(object?.spriteOpacity)) ? Number(object.spriteOpacity) : 1, 0, 1);
    if (spriteOpacity <= 0) {
      return true;
    }
    const drawX = rect.x - rect.w * pivotX;
    const drawY = rect.y - rect.h * pivotY;
    const flipX = object?.flipX === true;
    const flipY = object?.flipY === true;

    renderCtx.save();
    renderCtx.globalAlpha = spriteOpacity;
    if (flipX || flipY) {
      const centerX = drawX + rect.w * 0.5;
      const centerY = drawY + rect.h * 0.5;
      renderCtx.translate(centerX, centerY);
      renderCtx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      renderCtx.drawImage(image, sprite.x, sprite.y, sprite.w, sprite.h, -rect.w * 0.5, -rect.h * 0.5, rect.w, rect.h);
    } else {
      renderCtx.drawImage(image, sprite.x, sprite.y, sprite.w, sprite.h, drawX, drawY, rect.w, rect.h);
    }
    renderCtx.restore();
    return true;
  }

  function resolveObjectSpriteId(object, animationRegistry, timeSeconds) {
    const fallbackSpriteId = String(object?.spriteId || "").trim();
    const animationId = String(object?.animationId || "").trim();
    if (!animationId) {
      return fallbackSpriteId;
    }

    const animation = animationRegistry.get(animationId);
    if (!animation || !Array.isArray(animation.frames) || animation.frames.length === 0) {
      return fallbackSpriteId;
    }

    const fps = Math.max(1, Number.isFinite(Number(object?.animationFps)) ? Number(object.animationFps) : Number(animation.fps || 8));
    const playing = object?.animationPlaying !== false;
    const fallbackMode = object?.animationLoop !== false && animation.loop !== false ? "loop" : "once";
    const rawMode = String(object?.animationMode || fallbackMode).trim().toLowerCase();
    const mode = rawMode === "pingpong" || rawMode === "once" ? rawMode : "loop";
    const offset = Number.isFinite(Number(object?.animationOffset)) ? Number(object.animationOffset) : 0;
    if (!playing) {
      return animation.frames[0] || fallbackSpriteId;
    }

    const rawIndex = Math.floor(Math.max(0, Number(timeSeconds || 0) + offset) * fps);
    let frameIndex = 0;
    if (mode === "once") {
      frameIndex = Math.min(animation.frames.length - 1, rawIndex);
    } else if (mode === "pingpong" && animation.frames.length > 1) {
      const cycle = animation.frames.length * 2 - 2;
      const pingpongIndex = cycle > 0 ? rawIndex % cycle : 0;
      frameIndex = pingpongIndex < animation.frames.length ? pingpongIndex : cycle - pingpongIndex;
    } else {
      frameIndex = rawIndex % animation.frames.length;
    }
    return animation.frames[frameIndex] || fallbackSpriteId;
  }

  function drawSpriteShape(item, scene, state) {
    const points = parseShapePoints(item);
    if (points.length < 2) {
      return;
    }

    const projected = points.map((point) => projectScenePoint(point, state.cam, scene));
    ctx.save();
    ctx.fillStyle = String(item.shapeFill || item.color || "#4cab6b");
    ctx.strokeStyle = String(item.shapeStroke || "#2f6f45");
    ctx.lineWidth = Math.max(1, Number.isFinite(Number(item.shapeThickness)) ? Number(item.shapeThickness) : 3);
    ctx.beginPath();
    const closed = item.shapeClosed !== false;
    const smooth = item.shapeSmooth !== false && projected.length > 2;
    if (!smooth) {
      ctx.moveTo(projected[0].x, projected[0].y);
      projected.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      if (closed) {
        ctx.closePath();
      }
    } else if (closed) {
      const firstMid = {
        x: (projected[projected.length - 1].x + projected[0].x) * 0.5,
        y: (projected[projected.length - 1].y + projected[0].y) * 0.5
      };
      ctx.moveTo(firstMid.x, firstMid.y);
      for (let i = 0; i < projected.length; i += 1) {
        const current = projected[i];
        const next = projected[(i + 1) % projected.length];
        const mid = { x: (current.x + next.x) * 0.5, y: (current.y + next.y) * 0.5 };
        ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(projected[0].x, projected[0].y);
      for (let i = 1; i < projected.length - 1; i += 1) {
        const current = projected[i];
        const next = projected[i + 1];
        const mid = { x: (current.x + next.x) * 0.5, y: (current.y + next.y) * 0.5 };
        ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
      }
      const last = projected[projected.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    if (closed) {
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.stroke();
    ctx.restore();

    if (state.showLabels !== false) {
      const rect = projectSceneRect(item, state.cam, scene);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(rect.x, rect.y - 16, Math.max(58, item.name.length * 7), 14);
      ctx.fillStyle = "#f5fbff";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillText(item.name, rect.x + 4, rect.y - 5);
    }
  }

  function drawLight2DGizmo(item, scene, state, timeSeconds) {
    const rect = projectSceneRect(item, state.cam, scene);
    const centerX = rect.x + rect.w * 0.5;
    const centerY = rect.y + rect.h * 0.5;
    const radius = Math.max(12, Number.isFinite(Number(item.lightRadius)) ? Number(item.lightRadius) : 180);
    const intensity = clamp(Number.isFinite(Number(item.lightIntensity)) ? Number(item.lightIntensity) : 0.92, 0, 1);
    const flicker = clamp(Number.isFinite(Number(item.lightFlicker)) ? Number(item.lightFlicker) : 0, 0, 1);
    const pulse = 1 + Math.sin(timeSeconds * 8) * flicker * 0.2;
    const color = String(item.lightColor || item.color || "#ffe3a6");

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * pulse);
    gradient.addColorStop(0, colorWithAlpha(color, Math.max(0.08, intensity * 0.28)));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(color, 0.82);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colorWithAlpha(color, 0.95);
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(3, rect.w * 0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (state.showLabels !== false) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(rect.x, rect.y - 16, Math.max(58, item.name.length * 7), 14);
      ctx.fillStyle = "#f5fbff";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillText(item.name, rect.x + 4, rect.y - 5);
    }
  }

  function drawWorldObjects(scene, state) {
    const spriteRegistry = getSpriteRegistry(model.project);
    const animationRegistry = getAnimationRegistry(model.project);
    const timeSeconds = performance.now() / 1000;
    const renderables = [
      ...scene.walls.map((wall) => ({ kind: "wall", object: wall, color: wall.color, label: null })),
      ...(scene.gameObjects || []).map((item) => ({ kind: "gameplayObject", object: item })),
      { kind: "entity", object: scene.enemy, color: scene.enemy.color, label: scene.enemy.name },
      { kind: "entity", object: scene.player, color: scene.player.color, label: scene.player.name }
    ].sort((left, right) => compareRenderObjects(left.object, right.object, scene));

    renderables.forEach((entry) => {
      if (entry.kind === "gameplayObject") {
        drawGameplayObject(entry.object, scene, state, spriteRegistry, animationRegistry, timeSeconds);
        return;
      }

      drawBox(entry.object, entry.color, state, entry.label, spriteRegistry, animationRegistry, timeSeconds);
    });
  }

  function drawGrid(scene, state) {
    const tileSize = scene.world.tileSize;
    const startX = Math.floor(state.cam.x / tileSize) * tileSize;
    const startY = Math.floor(state.cam.y / tileSize) * tileSize;

    ctx.strokeStyle = "rgba(198, 219, 236, 0.12)";
    ctx.beginPath();

    for (let x = startX; x <= state.cam.x + state.cam.w; x += tileSize) {
      const px = x - state.cam.x + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, state.cam.h);
    }

    for (let y = startY; y <= state.cam.y + state.cam.h; y += tileSize) {
      const py = y - state.cam.y + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(state.cam.w, py);
    }

    ctx.stroke();
  }

  function drawLayerTiles(scene, state, layer) {
    if (!TILE_LAYERS.includes(layer)) {
      return;
    }

    const layerSettings = state.layerSettings?.[layer];
    if (layerSettings && layerSettings.visible === false) {
      return;
    }

    const layerMap = state.tileMaps?.[layer];
    if (!(layerMap instanceof Map) || layerMap.size === 0) {
      return;
    }

    const alpha = layer === "background" ? 0.75 : layer === "collision" ? 0.4 : 1;
    const tileSize = scene.world.tileSize;
    const elapsed = performance.now() / 1000;

    layerMap.forEach((tileId, key) => {
      const renderTileId = resolveAnimatedTileId(tileId, elapsed);
      const tile = TILE_BY_ID.get(renderTileId);
      if (!tile) {
        return;
      }

      const [tx, ty] = key.split(",").map(Number);
      const x = tx * tileSize - state.cam.x;
      const y = ty * tileSize - state.cam.y;

      if (x > state.cam.w || y > state.cam.h || x + tileSize < 0 || y + tileSize < 0) {
        return;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = tile.color;
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      if (layer === "collision") {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
        ctx.strokeRect(x + 2.5, y + 2.5, tileSize - 5, tileSize - 5);
      }

      ctx.globalAlpha = 1;
    });
  }

  function drawLightingOverlay(scene, state) {
    const lighting = scene?.lighting2D;
    if (!lighting || lighting.enabled !== true) {
      return;
    }

    const lights = getGameplayObjectsByType(scene, "light2d").filter((item) => item.enabled !== false);
    if (lights.length === 0) {
      return;
    }

    const ambientAlpha = clamp(Number.isFinite(Number(lighting.ambientAlpha)) ? Number(lighting.ambientAlpha) : 0.58, 0, 1);
    const shadowAlpha = clamp(Number.isFinite(Number(lighting.shadowAlpha)) ? Number(lighting.shadowAlpha) : 0.36, 0, 1);
    const shadowLength = Math.max(20, Number.isFinite(Number(lighting.shadowLength)) ? Number(lighting.shadowLength) : 110);
    const timeSeconds = performance.now() / 1000;

    ctx.save();
    ctx.fillStyle = colorWithAlpha(lighting.ambientColor || "#0b1220", ambientAlpha);
    ctx.fillRect(0, 0, state.cam.w, state.cam.h);

    ctx.globalCompositeOperation = "destination-out";
    lights.forEach((light, index) => {
      const rect = projectSceneRect(light, state.cam, scene);
      const centerX = rect.x + rect.w * 0.5;
      const centerY = rect.y + rect.h * 0.5;
      const flicker = clamp(Number(light.lightFlicker || 0), 0, 1);
      const flickerPulse = 1 + Math.sin(timeSeconds * 7 + index * 1.3) * flicker * 0.22;
      const radius = Math.max(16, Number.isFinite(Number(light.lightRadius)) ? Number(light.lightRadius) : 180) * flickerPulse;
      const intensity = clamp(Number.isFinite(Number(light.lightIntensity)) ? Number(light.lightIntensity) : 0.92, 0, 1);
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${Math.max(0.02, intensity)})`);
      gradient.addColorStop(0.72, `rgba(0,0,0,${Math.max(0, intensity * 0.46)})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";
    lights.forEach((light) => {
      if (light.castShadows === false) {
        return;
      }

      const lightRect = projectSceneRect(light, state.cam, scene);
      const lightCenter = {
        x: lightRect.x + lightRect.w * 0.5,
        y: lightRect.y + lightRect.h * 0.5
      };
      const alpha = shadowAlpha * clamp(Number.isFinite(Number(light.lightIntensity)) ? Number(light.lightIntensity) : 0.92, 0, 1);
      drawLightShadows(scene, state, light, lightCenter, shadowLength, alpha, lighting.ambientColor || "#0b1220");
    });
    ctx.restore();
  }

  function drawLightShadows(scene, state, light, lightCenter, shadowLength, alpha, color) {
    const occluders = [
      ...scene.walls,
      ...getGameplayObjectsByType(scene).filter((item) => item.id !== light.id && item.type !== "light2d" && item.type !== "spriteShape" && item.colliderEnabled !== false && item.colliderIsTrigger !== true && !(item.type === "door" && item.isOpen === true))
    ];

    occluders.forEach((object) => {
      const rect = projectSceneRect(object, state.cam, scene);
      const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w, y: rect.y },
        { x: rect.x + rect.w, y: rect.y + rect.h },
        { x: rect.x, y: rect.y + rect.h }
      ];
      const centerX = rect.x + rect.w * 0.5;
      const centerY = rect.y + rect.h * 0.5;
      const dx = centerX - lightCenter.x;
      const dy = centerY - lightCenter.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const shifted = corners.map((corner) => ({ x: corner.x + ux * shadowLength, y: corner.y + uy * shadowLength }));

      ctx.fillStyle = colorWithAlpha(color, alpha);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach((corner) => ctx.lineTo(corner.x, corner.y));
      shifted.slice().reverse().forEach((corner) => ctx.lineTo(corner.x, corner.y));
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawGameplayObject(item, scene, state, spriteRegistry, animationRegistry, timeSeconds) {
    if (item.type === "spriteShape") {
      drawSpriteShape(item, scene, state);
      return;
    }

    if (item.type === "light2d") {
      drawLight2DGizmo(item, scene, state, timeSeconds);
      return;
    }

    const playRuntime = state.playRuntime || {};
    const rect = projectSceneRect(item, state.cam, scene);
    const x = rect.x;
    const y = rect.y;
    const itemKey = makeGameplayKey(scene.id, item.id);
    const animationFx = playRuntime.animationFx?.[makeRuntimeTargetKey(scene.id, "gameplayObject", item.id)];
    const isActiveTrigger = Boolean(playRuntime.activeTriggerKeys?.[itemKey]);
    const isSavedCheckpoint = playRuntime.checkpoint?.key === itemKey;
    const isPortalLocked = playRuntime.portalLockKey === itemKey;
    const isActiveCameraZone = item.type === "cameraZone" && playRuntime.activeCameraZoneKey === itemKey;
    const doorOpenAmount = item.type === "door" ? getDoorOpenAmount(scene.id, item, playRuntime) : 0;
    const isDoorOpen = item.type === "door" && doorOpenAmount >= 0.98;
    const fillAlpha = item.type === "trigger"
      ? (isActiveTrigger ? 0.55 : 0.3)
      : item.type === "cameraZone"
        ? (isActiveCameraZone ? 0.3 : 0.14)
        : isSavedCheckpoint
          ? 1
          : item.type === "door"
            ? 0.84 - doorOpenAmount * 0.42
            : 0.8;
    const strokeColor = isSavedCheckpoint
      ? "#f5fbff"
      : isPortalLocked
        ? "#d6f2ff"
        : isDoorOpen
          ? "#b6f6d2"
          : item.type === "cameraZone"
            ? (isActiveCameraZone ? "#e8f2ff" : "#8cb8ff")
            : item.color;
    const fillColor = item.type === "door" && doorOpenAmount > 0.1 ? "#79b898" : item.type === "cameraZone" ? "#6f9ceb" : item.color;

    drawGroundShadow(rect);

    const spriteDrawn = drawSpriteRect(ctx, item, rect, spriteRegistry, animationRegistry, timeSeconds);
    if (!spriteDrawn) {
      ctx.save();
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = fillColor;

      if (item.type === "door") {
        const doorHeight = Math.max(6, Math.round(rect.h * (1 - 0.82 * doorOpenAmount)));
        const doorY = y + (rect.h - doorHeight);
        ctx.fillRect(x, doorY, rect.w, doorHeight);
        if (state.showColliders !== false) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = isSavedCheckpoint ? 3 : 2;
          ctx.setLineDash(doorOpenAmount > 0.05 ? [6, 4] : []);
          ctx.strokeStyle = strokeColor;
          ctx.strokeRect(x + 1, doorY + 1, Math.max(0, rect.w - 2), Math.max(0, doorHeight - 2));
          ctx.strokeStyle = "rgba(245, 251, 255, 0.22)";
          ctx.setLineDash([]);
          ctx.strokeRect(x + 2, y + 2, Math.max(0, rect.w - 4), Math.max(0, rect.h - 4));
        }
      } else {
        ctx.fillRect(x, y, rect.w, rect.h);
        if (state.showColliders !== false) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = isSavedCheckpoint ? 3 : 2;
          ctx.setLineDash(item.type === "trigger" || item.type === "cameraZone" ? [6, 4] : []);
          ctx.strokeStyle = strokeColor;
          ctx.strokeRect(x + 1, y + 1, Math.max(0, rect.w - 2), Math.max(0, rect.h - 2));
        }
      }

      ctx.restore();
    } else {
      if (state.showColliders !== false) {
        ctx.save();
        ctx.lineWidth = isSavedCheckpoint ? 3 : 2;
        ctx.setLineDash(item.type === "trigger" || item.type === "cameraZone" ? [6, 4] : []);
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(x + 1, y + 1, Math.max(0, rect.w - 2), Math.max(0, rect.h - 2));
        ctx.restore();
      }
    }

    if (animationFx) {
      drawAnimationEffect(x, y, rect.w, rect.h, animationFx);
    }

    drawBonesGuide(item, rect, timeSeconds, ctx);

    if (state.showLabels !== false) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y - 16, Math.max(58, item.name.length * 7), 14);
      ctx.fillStyle = "#f5fbff";
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillText(item.name, x + 4, y - 5);
    }
  }

  function drawBox(object, color, state, label, spriteRegistry, animationRegistry, timeSeconds) {
    const rect = projectSceneRect(object, state.cam, model.scene);
    const x = rect.x;
    const y = rect.y;
    const playRuntime = state.playRuntime || {};
    const runtimeKey = makeRuntimeTargetKey(model.scene.id, object.type === "wall" ? "wall" : "entity", object.id);
    const animationFx = playRuntime.animationFx?.[runtimeKey];

    drawGroundShadow(rect);
    const spriteDrawn = drawSpriteRect(ctx, object, rect, spriteRegistry, animationRegistry, timeSeconds);
    if (!spriteDrawn) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, rect.w, rect.h);
    }

    if (state.showColliders !== false) {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.strokeRect(x + 0.5, y + 0.5, rect.w - 1, rect.h - 1);
    }

    if (animationFx) {
      drawAnimationEffect(x, y, rect.w, rect.h, animationFx);
    }

    drawBonesGuide(object, rect, timeSeconds, ctx);

    if (!label || state.showLabels === false) {
      return;
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y - 16, Math.max(46, label.length * 7), 14);
    ctx.fillStyle = "#f5fbff";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText(label, x + 4, y - 5);
  }

  function compareRenderObjects(left, right, scene) {
    const useSortingY = scene?.sortingY === true;
    const leftLayer = sortingLayerWeight(left?.sortingLayer);
    const rightLayer = sortingLayerWeight(right?.sortingLayer);
    if (leftLayer !== rightLayer) {
      return leftLayer - rightLayer;
    }

    const leftOrder = Number.isFinite(Number(left?.orderInLayer)) ? Math.round(Number(left.orderInLayer)) : 0;
    const rightOrder = Number.isFinite(Number(right?.orderInLayer)) ? Math.round(Number(right.orderInLayer)) : 0;
    if (!useSortingY && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftZ = Number(left?.z || 0);
    const rightZ = Number(right?.z || 0);
    if (leftZ !== rightZ) {
      return leftZ - rightZ;
    }

    const leftY = Number(left?.y || 0) + Number(left?.h || 0);
    const rightY = Number(right?.y || 0) + Number(right?.h || 0);
    if (leftY !== rightY) {
      return leftY - rightY;
    }

    return leftOrder - rightOrder;
  }

  function sortingLayerWeight(layer) {
    const clean = String(layer || "default").trim().toLowerCase();
    const index = SORTING_LAYERS.indexOf(clean);
    return index >= 0 ? index : SORTING_LAYERS.indexOf("default");
  }

  function drawGroundShadow(rect) {
    if (!rect.offsetX && !rect.offsetY) {
      return;
    }

    const groundX = rect.x - rect.offsetX;
    const groundY = rect.y + rect.offsetY;

    ctx.save();
    ctx.fillStyle = "rgba(7, 12, 17, 0.18)";
    ctx.fillRect(groundX + 2, groundY + 2, Math.max(0, rect.w - 4), Math.max(0, rect.h - 4));
    ctx.strokeStyle = "rgba(216, 242, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(groundX, groundY);
    ctx.lineTo(rect.x, rect.y);
    ctx.moveTo(groundX + rect.w, groundY);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawAnimationEffect(x, y, w, h, animationFx) {
    const pulse = 1 + Math.sin(animationFx.ttl * 14) * 0.25;
    ctx.save();
    ctx.strokeStyle = "#fff5b5";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - 3 * pulse, y - 3 * pulse, w + 6 * pulse, h + 6 * pulse);
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(x, y + h + 4, Math.max(60, animationFx.name.length * 7), 14);
    ctx.fillStyle = "#fff5b5";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText(animationFx.name, x + 4, y + h + 15);
    ctx.restore();
  }

  function drawPatrol(scene, state) {
    const enemy = scene.enemy;
    if (!Array.isArray(enemy.patrol) || enemy.patrol.length < 2) {
      return;
    }

    ctx.strokeStyle = "rgba(255,122,102,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    enemy.patrol.forEach((point, index) => {
      const projected = projectScenePoint({ x: point.x + enemy.w * 0.5, y: point.y + enemy.h * 0.5, z: point.z || enemy.z || 0 }, state.cam, scene);
      const x = projected.x;
      const y = projected.y;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.closePath();
    ctx.stroke();
  }

  function drawPaintPreview(scene, state) {
    if (state.mode !== "edit" || state.tool !== "paint" || !state.paintPreview?.active) {
      return;
    }

    const start = state.paintPreview.start;
    const end = state.paintPreview.end || start;
    if (!start || !end) {
      return;
    }

    const tileSize = scene.world.tileSize;
    const previewTile = TILE_BY_ID.get(state.tileId);
    const fill = state.paintPreview.erase ? "#f7766e" : previewTile?.color || "#ffb84d";
    const stroke = state.paintPreview.erase ? "#ff8f8f" : "#ffcb6b";
    const lineThickness = Math.max(1, Number.isFinite(Number(state.paintPreview.lineThickness)) ? Math.round(Number(state.paintPreview.lineThickness)) : 1);
    const brushShape = String(state.paintPreview.brushShape || "square").trim().toLowerCase() === "circle" ? "circle" : "square";
    const lineCells =
      state.paintPreview.shape === "line"
        ? traceLineBrushCells(
            scene,
            { x: start.tx * tileSize, y: start.ty * tileSize },
            { x: end.tx * tileSize, y: end.ty * tileSize },
            { thickness: lineThickness, brushShape }
          )
        : null;

    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = fill;

    if (lineCells) {
      lineCells.forEach((cell) => {
        ctx.fillRect(cell.tx * tileSize - state.cam.x, cell.ty * tileSize - state.cam.y, tileSize, tileSize);
      });
    } else {
      const minX = Math.min(start.tx, end.tx) * tileSize - state.cam.x;
      const minY = Math.min(start.ty, end.ty) * tileSize - state.cam.y;
      const width = (Math.abs(start.tx - end.tx) + 1) * tileSize;
      const height = (Math.abs(start.ty - end.ty) + 1) * tileSize;
      ctx.fillRect(minX, minY, width, height);
    }

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = stroke;
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;

    if (lineCells) {
      lineCells.forEach((cell) => {
        ctx.strokeRect(cell.tx * tileSize - state.cam.x + 1, cell.ty * tileSize - state.cam.y + 1, tileSize - 2, tileSize - 2);
      });
    } else {
      const minX = Math.min(start.tx, end.tx) * tileSize - state.cam.x;
      const minY = Math.min(start.ty, end.ty) * tileSize - state.cam.y;
      const width = (Math.abs(start.tx - end.tx) + 1) * tileSize;
      const height = (Math.abs(start.ty - end.ty) + 1) * tileSize;
      ctx.strokeRect(minX + 1, minY + 1, Math.max(0, width - 2), Math.max(0, height - 2));
    }

    ctx.restore();
  }

  function drawNativePaintPreview(scene, state, config) {
    if (state.mode !== "edit" || state.tool !== "paint" || !state.paintPreview?.active) {
      return;
    }

    const start = state.paintPreview.start;
    const end = state.paintPreview.end || start;
    if (!start || !end) {
      return;
    }

    const tileSize = scene.world.tileSize;
    const previewTile = TILE_BY_ID.get(state.tileId);
    const fill = state.paintPreview.erase ? "#f7766e" : previewTile?.color || "#ffb84d";
    const stroke = state.paintPreview.erase ? "#ff8f8f" : "#ffcb6b";
    const lineThickness = Math.max(1, Number.isFinite(Number(state.paintPreview.lineThickness)) ? Math.round(Number(state.paintPreview.lineThickness)) : 1);
    const brushShape = String(state.paintPreview.brushShape || "square").trim().toLowerCase() === "circle" ? "circle" : "square";
    const cells = state.paintPreview.shape === "line"
      ? traceLineBrushCells(
          scene,
          { x: start.tx * tileSize, y: start.ty * tileSize },
          { x: end.tx * tileSize, y: end.ty * tileSize },
          { thickness: lineThickness, brushShape }
        )
      : (() => {
          const results = [];
          const minTx = Math.min(start.tx, end.tx);
          const maxTx = Math.max(start.tx, end.tx);
          const minTy = Math.min(start.ty, end.ty);
          const maxTy = Math.max(start.ty, end.ty);
          for (let tx = minTx; tx <= maxTx; tx += 1) {
            for (let ty = minTy; ty <= maxTy; ty += 1) {
              results.push({ tx, ty });
            }
          }
          return results;
        })();

    ctx.save();
    cells.forEach((cell) => {
      const points = [
        projectNativePoint({ x: cell.tx * tileSize, y: cell.ty * tileSize, z: 0 }, config),
        projectNativePoint({ x: (cell.tx + 1) * tileSize, y: cell.ty * tileSize, z: 0 }, config),
        projectNativePoint({ x: (cell.tx + 1) * tileSize, y: (cell.ty + 1) * tileSize, z: 0 }, config),
        projectNativePoint({ x: cell.tx * tileSize, y: (cell.ty + 1) * tileSize, z: 0 }, config)
      ];

      ctx.globalAlpha = 0.18;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.88;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSelectionBox(state) {
    if (!state.selectionBox?.active || !state.selectionBox.start || !state.selectionBox.end) {
      return;
    }

    const start = state.selectionBox.start;
    const end = state.selectionBox.end;
    const projected = state.selectionBox.projected === true;
    const minX = Math.min(start.x, end.x) - (projected ? 0 : state.cam.x);
    const minY = Math.min(start.y, end.y) - (projected ? 0 : state.cam.y);
    const width = Math.abs(start.x - end.x);
    const height = Math.abs(start.y - end.y);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#9fd4ff";
    ctx.fillRect(minX, minY, width, height);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#9fd4ff";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(minX, minY, width, height);
    ctx.restore();
  }

  function drawSnapGuides(state) {
    if (!state.snapGuides || state.snapGuides.ttl <= 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = Math.min(1, state.snapGuides.ttl * 1.8);
    ctx.strokeStyle = "#dff6ff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);

    (state.snapGuides.vertical || []).forEach((guide) => {
      const x = guide.value - state.cam.x;
      ctx.beginPath();
      ctx.moveTo(x, guide.start - state.cam.y);
      ctx.lineTo(x, guide.end - state.cam.y);
      ctx.stroke();
    });

    (state.snapGuides.horizontal || []).forEach((guide) => {
      const y = guide.value - state.cam.y;
      ctx.beginPath();
      ctx.moveTo(guide.start - state.cam.x, y);
      ctx.lineTo(guide.end - state.cam.x, y);
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawSelection(scene, state) {
    if (state.mode !== "edit") {
      return;
    }

    const selectedRefs = Array.isArray(getSelectedRefs?.()) ? getSelectedRefs() : [];
    if (selectedRefs.length === 0) {
      return;
    }

    const selectedObjects = selectedRefs.map((ref) => ({ ref, object: getObjectByRef(scene, ref) })).filter((entry) => entry.object);

    selectedObjects.forEach(({ ref, object: selected }) => {
      if (!selected) {
        return;
      }

      const rect = projectSceneRect(selected, state.cam, scene);
      const isPrimary = ref.kind === getSelectedRef()?.kind && ref.id === getSelectedRef()?.id;
      ctx.strokeStyle = isPrimary ? "#ffcb6b" : "#8ad5ff";
      ctx.lineWidth = isPrimary ? 2.5 : 2;
      ctx.setLineDash(isPrimary ? [] : [6, 4]);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
    });

    if (selectedObjects.length > 1) {
      drawGroupGizmo(selectedObjects.map((entry) => entry.object), state);
    }

    ctx.setLineDash([]);
  }

  function drawGroupGizmo(objects, state) {
    const projectedRects = objects.map((object) => projectSceneRect(object, state.cam, model.scene));
    const minX = Math.min(...projectedRects.map((rect) => rect.x));
    const minY = Math.min(...projectedRects.map((rect) => rect.y));
    const maxX = Math.max(...projectedRects.map((rect) => rect.x + rect.w));
    const maxY = Math.max(...projectedRects.map((rect) => rect.y + rect.h));
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#8ad5ff";
    ctx.fillRect(minX, minY, width, height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#d8f2ff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(minX - 6, minY - 6, width + 12, height + 12);

    ctx.setLineDash([]);
    ctx.strokeStyle = "#8ad5ff";
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();

    drawGizmoHandle(minX - 6, minY - 6);
    drawGizmoHandle(maxX + 6, minY - 6);
    drawGizmoHandle(minX - 6, maxY + 6);
    drawGizmoHandle(maxX + 6, maxY + 6);

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(minX - 6, minY - 26, 90, 16);
    ctx.fillStyle = "#d8f2ff";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText(`GRUPO x${objects.length}`, minX, minY - 14);
    ctx.restore();
  }

  function drawGizmoHandle(x, y) {
    ctx.fillStyle = "#d8f2ff";
    ctx.strokeStyle = "#143446";
    ctx.lineWidth = 1;
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.strokeRect(x - 4, y - 4, 8, 8);
  }

  function drawNativeScene(renderCtx, scene, state, viewport, label) {
    const config = createNativePreviewConfig(scene, state.cam, viewport, getActiveNativeCameraState(scene, state));
    renderCtx.clearRect(0, 0, viewport.width || 1, viewport.height || 1);
    drawNativeBackground(renderCtx, config);
    drawNativeFloor(renderCtx, scene, state, config);
    drawNativeTiles(renderCtx, scene, state, config);
    getNativePrisms(scene, state, config).forEach((prism) => drawNativePrism(renderCtx, prism));
    drawNativeLabel(renderCtx, label);
    return config;
  }

  function getNativePrisms(scene, state, config) {
    const playRuntime = state.playRuntime || {};
    return [
      ...scene.walls.map((wall) => createNativePrism(wall, scene, config)),
      ...(scene.gameObjects || []).map((item) =>
        createNativePrism(item, scene, config, {
          doorOpenAmount: item.type === "door" ? getDoorOpenAmount(scene.id, item, playRuntime) : 0
        })
      ),
      createNativePrism(scene.enemy, scene, config),
      createNativePrism(scene.player, scene, config)
    ].sort((left, right) => left.depth - right.depth);
  }

  function drawNative3DPreview(scene, state) {
    if (!nativeCanvas || !nativeCtx) {
      return;
    }

    drawNativeScene(nativeCtx, scene, state, { width: nativeCanvas.width || 1, height: nativeCanvas.height || 1 }, "PREVIA 3D NATIVA");
  }

  function getActiveNativeCameraState(scene, state) {
    const baseCamera = createNativeCameraState(state.nativeCamera);
    if (state.mode !== "play") {
      return baseCamera;
    }

    const playRuntime = state.playRuntime || {};
    if (playRuntime.cameraOverride) {
      return resolveNativeCameraState(baseCamera, {
        followTarget: {
          x: playRuntime.cameraOverride.x,
          y: playRuntime.cameraOverride.y,
          w: 0,
          h: 0
        }
      });
    }

    return resolveNativeCameraState(baseCamera, {
      followTarget: scene.player
    });
  }

  function drawNativeBackground(renderCtx, config) {
    renderCtx.fillStyle = "#0b1418";
    renderCtx.fillRect(0, 0, config.width, config.height);
    renderCtx.fillStyle = "rgba(122, 174, 214, 0.12)";
    renderCtx.beginPath();
    renderCtx.ellipse(config.width * 0.5, config.height * 0.18, config.width * 0.36, config.height * 0.18, 0, 0, Math.PI * 2);
    renderCtx.fill();
  }

  function drawNativeFloor(renderCtx, scene, state, config) {
    const tileSize = Math.max(16, scene.world.tileSize);
    const halfWidth = Math.max(scene.world.tileSize * 5, state.cam.w * 0.55);
    const halfHeight = Math.max(scene.world.tileSize * 5, state.cam.h * 0.55);
    const startX = Math.floor((config.focusX - halfWidth) / tileSize) * tileSize;
    const endX = Math.ceil((config.focusX + halfWidth) / tileSize) * tileSize;
    const startY = Math.floor((config.focusY - halfHeight) / tileSize) * tileSize;
    const endY = Math.ceil((config.focusY + halfHeight) / tileSize) * tileSize;

    renderCtx.save();
    renderCtx.strokeStyle = "rgba(216, 242, 255, 0.16)";
    renderCtx.lineWidth = 1;

    for (let x = startX; x <= endX; x += tileSize) {
      const a = projectNativePoint({ x, y: startY, z: 0 }, config);
      const b = projectNativePoint({ x, y: endY, z: 0 }, config);
      renderCtx.beginPath();
      renderCtx.moveTo(a.x, a.y);
      renderCtx.lineTo(b.x, b.y);
      renderCtx.stroke();
    }

    for (let y = startY; y <= endY; y += tileSize) {
      const a = projectNativePoint({ x: startX, y, z: 0 }, config);
      const b = projectNativePoint({ x: endX, y, z: 0 }, config);
      renderCtx.beginPath();
      renderCtx.moveTo(a.x, a.y);
      renderCtx.lineTo(b.x, b.y);
      renderCtx.stroke();
    }

    renderCtx.restore();
  }

  function drawNativeTiles(renderCtx, scene, state, config) {
    const tileSize = scene.world.tileSize;
    TILE_LAYERS.forEach((layer) => {
      const layerSettings = state.layerSettings?.[layer];
      if (layerSettings && layerSettings.visible === false) {
        return;
      }

      const layerMap = state.tileMaps?.[layer];
      if (!(layerMap instanceof Map) || layerMap.size === 0) {
        return;
      }

      const alpha = layer === "background" ? 0.28 : layer === "collision" ? 0.18 : layer === "foreground" ? 0.24 : 0.32;
      const elapsed = performance.now() / 1000;
      layerMap.forEach((tileId, key) => {
        const renderTileId = resolveAnimatedTileId(tileId, elapsed);
        const tile = TILE_BY_ID.get(renderTileId);
        if (!tile) {
          return;
        }

        const [tx, ty] = key.split(",").map(Number);
        const corners = [
          projectNativePoint({ x: tx * tileSize, y: ty * tileSize, z: 0 }, config),
          projectNativePoint({ x: (tx + 1) * tileSize, y: ty * tileSize, z: 0 }, config),
          projectNativePoint({ x: (tx + 1) * tileSize, y: (ty + 1) * tileSize, z: 0 }, config),
          projectNativePoint({ x: tx * tileSize, y: (ty + 1) * tileSize, z: 0 }, config)
        ];

        renderCtx.save();
        renderCtx.globalAlpha = alpha;
        renderCtx.fillStyle = tile.color;
        renderCtx.beginPath();
        renderCtx.moveTo(corners[0].x, corners[0].y);
        corners.slice(1).forEach((point) => renderCtx.lineTo(point.x, point.y));
        renderCtx.closePath();
        renderCtx.fill();

        if (layer === "collision") {
          renderCtx.globalAlpha = 0.72;
          renderCtx.strokeStyle = "rgba(255, 96, 96, 0.92)";
          renderCtx.lineWidth = 1;
          renderCtx.stroke();
        }

        renderCtx.restore();
      });
    });
  }

  function drawNativeLabel(renderCtx, label) {
    if (!label) {
      return;
    }

    renderCtx.fillStyle = "rgba(0, 0, 0, 0.56)";
    renderCtx.fillRect(10, 10, Math.max(124, label.length * 6.4), 18);
    renderCtx.fillStyle = "#d8f2ff";
    renderCtx.font = "11px JetBrains Mono, monospace";
    renderCtx.fillText(label, 16, 23);
  }

  function drawNativeSelection(renderCtx, scene, state, config) {
    if (state.mode !== "edit") {
      return;
    }

    const selectedRefs = Array.isArray(getSelectedRefs?.()) ? getSelectedRefs() : [];
    if (selectedRefs.length === 0) {
      return;
    }

    const boxes = [];
    selectedRefs.forEach((ref) => {
      const object = getObjectByRef(scene, ref);
      if (!object) {
        return;
      }

      const projected = projectNativeRect(object, scene, config, {
        doorOpenAmount: object.type === "door" ? getDoorOpenAmount(scene.id, object, state.playRuntime || {}) : 0
      });
      const rect = projected.rect;
      if (!rect) {
        return;
      }

      const isPrimary = ref.kind === getSelectedRef()?.kind && ref.id === getSelectedRef()?.id;
      boxes.push(rect);
      renderCtx.save();
      renderCtx.strokeStyle = isPrimary ? "#ffcb6b" : "#8ad5ff";
      renderCtx.lineWidth = isPrimary ? 2.5 : 2;
      renderCtx.setLineDash(isPrimary ? [] : [6, 4]);
      renderCtx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
      renderCtx.restore();
    });

    if (boxes.length > 1) {
      const minX = Math.min(...boxes.map((rect) => rect.x));
      const minY = Math.min(...boxes.map((rect) => rect.y));
      const maxX = Math.max(...boxes.map((rect) => rect.x + rect.w));
      const maxY = Math.max(...boxes.map((rect) => rect.y + rect.h));
      const width = maxX - minX;
      const height = maxY - minY;
      const centerX = minX + width / 2;
      const centerY = minY + height / 2;

      renderCtx.save();
      renderCtx.globalAlpha = 0.08;
      renderCtx.fillStyle = "#8ad5ff";
      renderCtx.fillRect(minX, minY, width, height);
      renderCtx.globalAlpha = 1;
      renderCtx.strokeStyle = "#d8f2ff";
      renderCtx.lineWidth = 1.5;
      renderCtx.setLineDash([10, 6]);
      renderCtx.strokeRect(minX - 6, minY - 6, width + 12, height + 12);

      renderCtx.setLineDash([]);
      renderCtx.strokeStyle = "#8ad5ff";
      renderCtx.beginPath();
      renderCtx.moveTo(centerX - 10, centerY);
      renderCtx.lineTo(centerX + 10, centerY);
      renderCtx.moveTo(centerX, centerY - 10);
      renderCtx.lineTo(centerX, centerY + 10);
      renderCtx.stroke();

      drawNativeGizmoHandle(renderCtx, minX - 6, minY - 6);
      drawNativeGizmoHandle(renderCtx, maxX + 6, minY - 6);
      drawNativeGizmoHandle(renderCtx, minX - 6, maxY + 6);
      drawNativeGizmoHandle(renderCtx, maxX + 6, maxY + 6);

      renderCtx.fillStyle = "rgba(0,0,0,0.6)";
      renderCtx.fillRect(minX - 6, minY - 26, 90, 16);
      renderCtx.fillStyle = "#d8f2ff";
      renderCtx.font = "11px JetBrains Mono, monospace";
      renderCtx.fillText(`GRUPO x${boxes.length}`, minX, minY - 14);
      renderCtx.restore();
    }
  }

  function drawNativeSnapGuides(renderCtx, state, config) {
    if (!state.snapGuides || state.snapGuides.ttl <= 0) {
      return;
    }

    renderCtx.save();
    renderCtx.globalAlpha = Math.min(1, state.snapGuides.ttl * 1.8);
    renderCtx.strokeStyle = "#dff6ff";
    renderCtx.lineWidth = 1.5;
    renderCtx.setLineDash([8, 5]);

    (state.snapGuides.vertical || []).forEach((guide) => {
      const segment = projectNativeGuideSegment("vertical", guide, config);
      if (!segment) {
        return;
      }
      renderCtx.beginPath();
      renderCtx.moveTo(segment.start.x, segment.start.y);
      renderCtx.lineTo(segment.end.x, segment.end.y);
      renderCtx.stroke();
    });

    (state.snapGuides.horizontal || []).forEach((guide) => {
      const segment = projectNativeGuideSegment("horizontal", guide, config);
      if (!segment) {
        return;
      }
      renderCtx.beginPath();
      renderCtx.moveTo(segment.start.x, segment.start.y);
      renderCtx.lineTo(segment.end.x, segment.end.y);
      renderCtx.stroke();
    });

    renderCtx.restore();
  }

  function drawNativeGizmoHandle(renderCtx, x, y) {
    renderCtx.fillStyle = "#d8f2ff";
    renderCtx.strokeStyle = "#143446";
    renderCtx.lineWidth = 1;
    renderCtx.fillRect(x - 4, y - 4, 8, 8);
    renderCtx.strokeRect(x - 4, y - 4, 8, 8);
  }

  function drawNativePrism(renderCtx, prism) {
    const color = prism.object.type === "door" && prism.object.isOpen ? "#79b898" : prism.object.color || "#8ad5ff";
    const top = prism.projectedTop;
    const base = prism.projectedBase;

    renderCtx.save();
    renderCtx.fillStyle = color;
    renderCtx.globalAlpha = 0.22;
    renderCtx.beginPath();
    renderCtx.moveTo(top[0].x, top[0].y);
    top.slice(1).forEach((point) => renderCtx.lineTo(point.x, point.y));
    renderCtx.closePath();
    renderCtx.fill();

    renderCtx.strokeStyle = color;
    renderCtx.globalAlpha = 0.92;
    renderCtx.lineWidth = prism.object.type === "player" || prism.object.type === "enemy" ? 2.2 : 1.5;

    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      renderCtx.beginPath();
      renderCtx.moveTo(base[index].x, base[index].y);
      renderCtx.lineTo(base[next].x, base[next].y);
      renderCtx.lineTo(top[next].x, top[next].y);
      renderCtx.lineTo(top[index].x, top[index].y);
      renderCtx.closePath();
      renderCtx.stroke();
    }

    renderCtx.beginPath();
    renderCtx.moveTo(top[0].x, top[0].y);
    top.slice(1).forEach((point) => renderCtx.lineTo(point.x, point.y));
    renderCtx.closePath();
    renderCtx.stroke();
    renderCtx.restore();
  }

  return {
    start,
    resize,
    beginPlaySession,
    endPlaySession,
    createPlaySaveData,
    applyPlaySaveData
  };
}

function roundRectPath(renderCtx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  renderCtx.beginPath();
  renderCtx.moveTo(x + r, y);
  renderCtx.arcTo(x + width, y, x + width, y + height, r);
  renderCtx.arcTo(x + width, y + height, x, y + height, r);
  renderCtx.arcTo(x, y + height, x, y, r);
  renderCtx.arcTo(x, y, x + width, y, r);
  renderCtx.closePath();
}

function wrapCanvasText(renderCtx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let row = 0;

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (renderCtx.measureText(candidate).width > maxWidth && line) {
      renderCtx.fillText(line, x, y + row * lineHeight);
      line = word;
      row += 1;
      return;
    }
    line = candidate;
  });

  if (line) {
    renderCtx.fillText(line, x, y + row * lineHeight);
  }
}

function resolvePixelSnapStep(scene) {
  const rawScale = scene?.physics?.pixelScale;
  return Math.max(1, Number.isFinite(Number(rawScale)) ? Math.round(Number(rawScale)) : 1);
}

function snapToStep(value, step = 1) {
  const safeStep = Math.max(1, Number.isFinite(Number(step)) ? Math.round(Number(step)) : 1);
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  return Math.round(numeric / safeStep) * safeStep;
}

function drawBonesGuide(object, rect, timeSeconds, renderCtx = null) {
  const ctx = renderCtx || null;
  if (!ctx) {
    return;
  }

  const bones = parseBones2D(object?.bones2D);
  if (bones.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255, 229, 158, 0.95)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  bones.forEach((bone, index) => {
    const wave = object?.bonesAnimate === true ? Math.sin(timeSeconds * 4 + index * 0.65) * 2.4 : 0;
    const x1 = rect.x + bone.x1;
    const y1 = rect.y + bone.y1;
    const x2 = rect.x + bone.x2;
    const y2 = rect.y + bone.y2 + wave;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 244, 198, 0.95)";
    ctx.beginPath();
    ctx.arc(x1, y1, 2.3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.setLineDash([]);
  ctx.restore();
}

function parseBones2D(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [startRaw, endRaw] = entry.split(">").map((value) => value.trim());
      if (!startRaw || !endRaw) {
        return null;
      }

      const [x1Raw, y1Raw] = startRaw.split(",").map((value) => value.trim());
      const [x2Raw, y2Raw] = endRaw.split(",").map((value) => value.trim());
      const x1 = Number(x1Raw);
      const y1 = Number(y1Raw);
      const x2 = Number(x2Raw);
      const y2 = Number(y2Raw);
      if (![x1, y1, x2, y2].every((value) => Number.isFinite(value))) {
        return null;
      }

      return { x1, y1, x2, y2 };
    })
    .filter(Boolean);
}

function parseShapePoints(object) {
  const raw = String(object?.shapePoints || "").trim();
  if (!raw) {
    return [];
  }

  const localPoints = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [xRaw, yRaw] = entry.split(",").map((value) => value.trim());
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return { x, y };
    })
    .filter(Boolean);

  if (localPoints.length < 2) {
    return [];
  }

  return localPoints.map((point) => ({
    x: Number(object.x || 0) + point.x,
    y: Number(object.y || 0) + point.y,
    z: Number(object.z || 0)
  }));
}

function createPlayRuntimeState() {
  return {
    checkpoint: null,
    activeTriggerKeys: {},
    consumedTriggerKeys: {},
    portalLockKey: null,
    portalCooldown: 0,
    respawnInvuln: 0,
    paused: false,
    playerTeamId: "",
    variables: {},
    animationFx: {},
    doorFx: {},
    dialogue: null,
    actionQueue: [],
    activeAction: null,
    cameraOverride: null,
    activeCameraZoneKey: null,
    cameraZoneBlend: null,
    cameraShake: null,
    cameraRig: null,
    interactionHint: null,
    sequenceLabel: "",
    bodyVelocity: {},
    timelineGuard: {}
  };
}

function createAudioRuntime() {
  const state = {
    enabled: true,
    masterVolume: 0.85,
    sfxVolume: 0.9,
    musicVolume: 0,
    preferredMusicClipId: "",
    clips: [],
    clipSignature: "",
    routing: {},
    musicElement: null,
    musicElementId: "",
    context: null,
    masterGain: null,
    musicOsc: null,
    musicGain: null
  };

  function normalizeClipList(source) {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((clip, index) => {
        if (!clip || typeof clip !== "object") {
          return null;
        }

        const src = String(clip.src || clip.url || clip.path || "").trim();
        if (!src) {
          return null;
        }

        const rawId = String(clip.id || clip.name || `clip_${index + 1}`)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "");
        const id = rawId || `clip_${index + 1}`;
        const kind = String(clip.kind || "ui").trim().toLowerCase() || "ui";

        return {
          id,
          name: String(clip.name || id),
          src,
          kind,
          volume: clamp(Number.isFinite(Number(clip.volume)) ? Number(clip.volume) : 1, 0, 1),
          loop: clip.loop === true
        };
      })
      .filter(Boolean);
  }

  function setClips(source) {
    const normalized = normalizeClipList(source);
    const signature = normalized.map((clip) => `${clip.id}|${clip.kind}|${clip.src}|${clip.volume}|${clip.loop ? 1 : 0}`).join(";");
    if (signature === state.clipSignature) {
      return;
    }

    state.clipSignature = signature;
    state.clips = normalized;
    stopElementMusic();
    ensureMusic();
  }

  function setRouting(source) {
    const safeSource = source && typeof source === "object" && !Array.isArray(source) ? source : {};
    state.routing = Object.entries(safeSource).reduce((acc, [key, value]) => {
      const routeKey = String(key || "").trim().toLowerCase();
      if (!routeKey) {
        return acc;
      }

      acc[routeKey] = String(value || "").trim().toLowerCase();
      return acc;
    }, {});
  }

  function setPreferredMusicClipId(clipId) {
    const nextId = String(clipId || "").trim().toLowerCase();
    if (state.preferredMusicClipId === nextId) {
      return;
    }

    state.preferredMusicClipId = nextId;
    ensureMusic();
  }

  function ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    if (!state.context) {
      try {
        state.context = new AudioContextCtor();
      } catch {
        state.context = null;
      }
    }

    if (state.context && state.context.state === "suspended") {
      state.context.resume().catch(() => {});
    }

    return state.context;
  }

  function ensureMasterGain(ctx) {
    if (!ctx) {
      return null;
    }

    if (!state.masterGain) {
      state.masterGain = ctx.createGain();
      state.masterGain.gain.value = 0;
      state.masterGain.connect(ctx.destination);
    }

    return state.masterGain;
  }

  function updateMasterVolume(ctx) {
    const output = ensureMasterGain(ctx);
    if (!output || !ctx) {
      return;
    }

    const target = state.enabled ? Math.max(0, Math.min(1, Number(state.masterVolume || 0))) : 0;
    output.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
  }

  function stopSynthMusic() {
    const ctx = state.context;
    if (state.musicOsc) {
      try {
        state.musicOsc.stop();
      } catch {
        // ignore
      }
      try {
        state.musicOsc.disconnect();
      } catch {
        // ignore
      }
      state.musicOsc = null;
    }

    if (state.musicGain) {
      if (ctx) {
        state.musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
      try {
        state.musicGain.disconnect();
      } catch {
        // ignore
      }
      state.musicGain = null;
    }
  }

  function stopElementMusic() {
    if (!state.musicElement) {
      return;
    }

    try {
      state.musicElement.pause();
      state.musicElement.currentTime = 0;
      state.musicElement.src = "";
    } catch {
      // ignore
    }

    state.musicElement = null;
    state.musicElementId = "";
  }

  function stopMusic() {
    stopSynthMusic();
    stopElementMusic();
  }

  function resolveMusicClip() {
    if (state.preferredMusicClipId) {
      const preferred = state.clips.find((clip) => clip.id === state.preferredMusicClipId);
      if (preferred) {
        return preferred;
      }
    }

    const routedMusicId = String(state.routing.music || "").trim().toLowerCase();
    if (routedMusicId) {
      const routedMusic = state.clips.find((clip) => clip.id === routedMusicId);
      if (routedMusic) {
        return routedMusic;
      }
    }

    return state.clips.find((clip) => clip.kind === "music") || null;
  }

  function ensureMusicElement(clip) {
    if (!clip || typeof Audio === "undefined") {
      return false;
    }

    if (state.musicElement && state.musicElementId !== clip.id) {
      stopElementMusic();
    }

    if (!state.musicElement) {
      try {
        const element = new Audio(clip.src);
        element.preload = "auto";
        element.loop = clip.loop !== false;
        state.musicElement = element;
        state.musicElementId = clip.id;
      } catch {
        state.musicElement = null;
        state.musicElementId = "";
        return false;
      }
    } else {
      state.musicElement.loop = clip.loop !== false;
    }

    const volume = clamp(Number(state.masterVolume || 0) * Number(state.musicVolume || 0) * Number(clip.volume || 1), 0, 1);
    state.musicElement.volume = state.enabled ? volume : 0;

    if (state.musicElement.paused) {
      const maybePromise = state.musicElement.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {});
      }
    }

    return true;
  }

  function ensureSynthMusic() {
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }

    updateMasterVolume(ctx);

    if (!state.musicGain) {
      state.musicGain = ctx.createGain();
      state.musicGain.gain.value = 0;
      state.musicGain.connect(ensureMasterGain(ctx));
    }

    if (!state.musicOsc) {
      state.musicOsc = ctx.createOscillator();
      state.musicOsc.type = "triangle";
      state.musicOsc.frequency.setValueAtTime(96, ctx.currentTime);
      state.musicOsc.connect(state.musicGain);
      state.musicOsc.start();
    }

    const target = Math.max(0, Math.min(1, Number(state.musicVolume || 0))) * 0.065;
    state.musicGain.gain.setTargetAtTime(target, ctx.currentTime, 0.2);
  }

  function ensureMusic() {
    const ctx = ensureContext();
    if (ctx) {
      updateMasterVolume(ctx);
    }

    if (!state.enabled || Number(state.musicVolume || 0) <= 0) {
      stopMusic();
      return;
    }

    const musicClip = resolveMusicClip();
    if (musicClip && ensureMusicElement(musicClip)) {
      stopSynthMusic();
      return;
    }

    stopElementMusic();
    ensureSynthMusic();
  }

  function resolveSfxClip(kind) {
    const cleanKind = String(kind || "").trim().toLowerCase();
    if (!cleanKind) {
      return null;
    }

    const routedId = String(state.routing[cleanKind] || "").trim().toLowerCase();
    if (routedId) {
      const routed = state.clips.find((clip) => clip.id === routedId);
      if (routed) {
        return routed;
      }
    }

    const byId = state.clips.find((clip) => clip.id === cleanKind);
    if (byId) {
      return byId;
    }

    return state.clips.find((clip) => clip.kind === cleanKind) || null;
  }

  function playSfxClip(kind) {
    const clip = resolveSfxClip(kind);
    if (!clip || typeof Audio === "undefined") {
      return false;
    }

    const volume = clamp(Number(state.masterVolume || 0) * Number(state.sfxVolume || 0) * Number(clip.volume || 1), 0, 1);
    if (volume <= 0 || !state.enabled) {
      return true;
    }

    try {
      const sfx = new Audio(clip.src);
      sfx.preload = "auto";
      sfx.volume = volume;
      const maybePromise = sfx.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  function playSfx(kind = "ui") {
    if (!state.enabled || Number(state.sfxVolume || 0) <= 0) {
      return;
    }

    if (playSfxClip(kind)) {
      return;
    }

    const ctx = ensureContext();
    if (!ctx) {
      return;
    }

    updateMasterVolume(ctx);

    const defs = {
      trigger: { f: 820, f2: 560, t: 0.09, gain: 0.2, type: "square" },
      checkpoint: { f: 660, f2: 920, t: 0.16, gain: 0.22, type: "triangle" },
      portal: { f: 280, f2: 760, t: 0.2, gain: 0.24, type: "sawtooth" },
      pauseOn: { f: 430, f2: 330, t: 0.08, gain: 0.18, type: "triangle" },
      pauseOff: { f: 330, f2: 460, t: 0.08, gain: 0.18, type: "triangle" },
      respawn: { f: 220, f2: 510, t: 0.22, gain: 0.2, type: "sine" },
      ui: { f: 520, f2: 640, t: 0.06, gain: 0.14, type: "square" }
    };
    const def = defs[String(kind || "ui")] || defs.ui;
    const volume = Math.max(0, Math.min(1, Number(state.sfxVolume || 0)));
    const gainNode = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = def.type;
    osc.frequency.setValueAtTime(def.f, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, def.f2), ctx.currentTime + def.t);
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, def.gain * volume), ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + def.t);
    osc.connect(gainNode);
    gainNode.connect(ensureMasterGain(ctx));
    osc.start();
    osc.stop(ctx.currentTime + def.t + 0.03);
    osc.onended = () => {
      try {
        osc.disconnect();
      } catch {
        // ignore
      }
      try {
        gainNode.disconnect();
      } catch {
        // ignore
      }
    };
  }

  return {
    get enabled() {
      return state.enabled;
    },
    set enabled(value) {
      state.enabled = value !== false;
      ensureMusic();
    },
    get masterVolume() {
      return state.masterVolume;
    },
    set masterVolume(value) {
      state.masterVolume = Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0.85));
      ensureMusic();
    },
    get sfxVolume() {
      return state.sfxVolume;
    },
    set sfxVolume(value) {
      state.sfxVolume = Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0.9));
    },
    get musicVolume() {
      return state.musicVolume;
    },
    set musicVolume(value) {
      state.musicVolume = Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
      ensureMusic();
    },
    setClips,
    setRouting,
    setPreferredMusicClipId,
    ensureMusic,
    stopMusic,
    playSfx
  };
}

function colorWithAlpha(color, alpha) {
  const safeAlpha = Math.max(0, Math.min(1, Number.isFinite(Number(alpha)) ? Number(alpha) : 1));
  const channels = parseColorChannels(color);
  if (!channels) {
    return `rgba(255,255,255,${safeAlpha})`;
  }

  return `rgba(${channels.r},${channels.g},${channels.b},${safeAlpha})`;
}

function parseColorChannels(color) {
  const raw = String(color || "").trim();
  if (!raw) {
    return null;
  }

  const hexMatch = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const values = rgbMatch[1].split(",").map((value) => value.trim());
    if (values.length < 3) {
      return null;
    }

    const toChannel = (value) => {
      if (value.endsWith("%")) {
        const percent = Number.parseFloat(value.slice(0, -1));
        if (!Number.isFinite(percent)) {
          return 0;
        }
        return Math.max(0, Math.min(255, Math.round((percent / 100) * 255)));
      }

      const numeric = Number.parseFloat(value);
      if (!Number.isFinite(numeric)) {
        return 0;
      }
      return Math.max(0, Math.min(255, Math.round(numeric)));
    };

    return {
      r: toChannel(values[0]),
      g: toChannel(values[1]),
      b: toChannel(values[2])
    };
  }

  return null;
}

function makeGameplayKey(sceneId, objectId) {
  return `${sceneId}:${objectId}`;
}

function makeRuntimeTargetKey(sceneId, kind, objectId) {
  return `${sceneId}:${kind}:${objectId}`;
}
