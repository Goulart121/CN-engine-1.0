import { createNativePreviewConfig, unprojectNativePoint } from "./native-3d.mjs";
import { isScene3DPreview, unprojectScenePoint } from "./scene-space.mjs";

export function bindEditorInput({
  canvas,
  model,
  isTyping,
  getViewportRenderer,
  setMode,
  pickAt,
  getObjectByRef,
  getSelectedRefs,
  paintBrush,
  paintLine,
  paintRect,
  fillTiles,
  sampleTile,
  hitGroupHandle,
  startPaintShapePreview,
  updatePaintShapePreview,
  clearPaintShapePreview,
  startSelectionBox,
  updateSelectionBox,
  clearSelectionBox,
  selectArea,
  addWall,
  onSelect,
  onDragMove,
  onDragStart,
  onDragEnd,
  onPaintStart,
  onPaintEnd,
  onViewportOrbit,
  onViewportPan,
  onViewportZoom,
  onViewportNavigateEnd,
  onDuplicateSelection,
  onDeleteSelection,
  onUndo,
  onRedo
}) {
  let paintStrokeActive = false;
  let shapeStrokeActive = false;
  let shapeErase = false;
  let shapeStartPoint = null;
  let selectionBoxActive = false;
  let viewportNav = null;

  function getViewportSize() {
    return {
      width: Math.max(1, canvas.width || canvas.clientWidth || 1),
      height: Math.max(1, canvas.height || canvas.clientHeight || 1)
    };
  }

  function getActiveViewportRenderer() {
    return getViewportRenderer?.() === "native-3d" ? "native-3d" : "scene";
  }

  function getViewportPickOptions() {
    return {
      camera: model.state.cam,
      viewportRenderer: getActiveViewportRenderer(),
      nativeCamera: model.state.nativeCamera,
      viewport: getViewportSize()
    };
  }

  function getSceneZoomFactor() {
    if (getActiveViewportRenderer() === "native-3d") {
      return 1;
    }

    const overrideZoom = Number(model.state?.editorZoomOverride);
    if (Number.isFinite(overrideZoom)) {
      return Math.max(0.35, Math.min(3, overrideZoom));
    }

    const rawZoom = model.scene?.camera2D?.zoom;
    const zoom = Number.isFinite(Number(rawZoom)) ? Number(rawZoom) : 1;
    return Math.max(0.35, Math.min(3, zoom));
  }

  function getViewportWorldPoint(localPoint, z = 0) {
    if (getActiveViewportRenderer() === "native-3d") {
      const config = createNativePreviewConfig(model.scene, model.state.cam, getViewportSize(), model.state.nativeCamera);
      return unprojectNativePoint(localPoint, config, z);
    }

    if (isScene3DPreview(model.scene)) {
      return unprojectScenePoint(localPoint, model.state.cam, z, model.scene);
    }

    return {
      x: model.state.cam.x + localPoint.x,
      y: model.state.cam.y + localPoint.y,
      z
    };
  }

  function getPointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const rawLocal = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
    const zoom = getSceneZoomFactor();
    const local =
      getActiveViewportRenderer() === "native-3d"
        ? rawLocal
        : {
            x: rawLocal.x / zoom,
            y: rawLocal.y / zoom
          };
    return {
      local,
      rawLocal,
      world: getViewportWorldPoint(local, 0)
    };
  }

  function startPaintStroke() {
    if (paintStrokeActive) {
      return;
    }
    paintStrokeActive = true;
    onPaintStart?.();
  }

  function endPaintStroke() {
    if (!paintStrokeActive) {
      return;
    }
    paintStrokeActive = false;
    onPaintEnd?.();
  }

  function beginShapeStroke(point, erase) {
    shapeStrokeActive = true;
    shapeErase = erase;
    shapeStartPoint = point;
    startPaintShapePreview?.(point, erase);
    onPaintStart?.();
  }

  function finishShapeStroke(point) {
    if (!shapeStrokeActive || !shapeStartPoint) {
      return;
    }

    if (model.state.paintTool === "line") {
      paintLine?.(shapeStartPoint, point, shapeErase ? 0 : model.state.tileId);
    } else {
      paintRect?.(shapeStartPoint, point, shapeErase ? 0 : model.state.tileId);
    }

    shapeStrokeActive = false;
    shapeErase = false;
    shapeStartPoint = null;
    clearPaintShapePreview?.();
    onPaintEnd?.();
  }

  function startViewportNavigation(mode, pointer) {
    viewportNav = {
      mode,
      lastLocal: { ...pointer.local },
      lastWorldGround: getViewportWorldPoint(pointer.local, 0)
    };
  }

  function updateViewportNavigation(pointer) {
    if (!viewportNav) {
      return;
    }

    const deltaX = pointer.local.x - viewportNav.lastLocal.x;
    const deltaY = pointer.local.y - viewportNav.lastLocal.y;

    if (viewportNav.mode === "orbit") {
      onViewportOrbit?.(deltaX * 0.014, deltaY * 0.01);
    } else {
      const currentWorld = getViewportWorldPoint(pointer.local, 0);
      const previousWorld = viewportNav.lastWorldGround || currentWorld;
      onViewportPan?.(previousWorld.x - currentWorld.x, previousWorld.y - currentWorld.y);
      viewportNav.lastWorldGround = currentWorld;
    }

    viewportNav.lastLocal = { ...pointer.local };
  }

  function endViewportNavigation() {
    if (!viewportNav) {
      return;
    }

    viewportNav = null;
    onViewportNavigateEnd?.();
  }

  function onKeyDown(event) {
    const state = model.state;

    if (event.key === "Tab") {
      event.preventDefault();
      setMode(state.mode === "edit" ? "play" : "edit");
      return;
    }

    if (isTyping(event.target)) {
      return;
    }

    const ctrlOrCmd = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    const isUndo = ctrlOrCmd && !event.shiftKey && key === "z";
    const isRedo = ctrlOrCmd && (key === "y" || (event.shiftKey && key === "z"));

    if (isUndo) {
      event.preventDefault();
      onUndo?.();
      return;
    }

    if (isRedo) {
      event.preventDefault();
      onRedo?.();
      return;
    }

    if (ctrlOrCmd && !event.shiftKey && key === "d") {
      event.preventDefault();
      onDuplicateSelection?.();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDeleteSelection?.();
      return;
    }

    if (state.mode === "play" && !event.repeat && (event.key === "e" || event.key === "E" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      state.input.interactQueued = true;
      return;
    }

    if (state.mode === "play" && !event.repeat && event.key === "Escape") {
      event.preventDefault();
      state.input.pauseQueued = true;
      return;
    }

    if (event.key === "w" || event.key === "ArrowUp") state.input.up = true;
    if (event.key === "s" || event.key === "ArrowDown") state.input.down = true;
    if (event.key === "a" || event.key === "ArrowLeft") state.input.left = true;
    if (event.key === "d" || event.key === "ArrowRight") state.input.right = true;
    if (event.key === "Shift") state.input.run = true;
  }

  function onKeyUp(event) {
    const state = model.state;
    if (event.key === "w" || event.key === "ArrowUp") state.input.up = false;
    if (event.key === "s" || event.key === "ArrowDown") state.input.down = false;
    if (event.key === "a" || event.key === "ArrowLeft") state.input.left = false;
    if (event.key === "d" || event.key === "ArrowRight") state.input.right = false;
    if (event.key === "Shift") state.input.run = false;
  }

  function onMouseDown(event) {
    const state = model.state;
    const scene = model.scene;
    const pointer = getPointer(event);
    const point = pointer.world;
    const nativeViewport = getActiveViewportRenderer() === "native-3d";

    if (nativeViewport && (event.altKey && event.button === 0)) {
      startViewportNavigation("orbit", pointer);
      return;
    }

    if (state.mode === "edit" && event.button === 1) {
      startViewportNavigation("pan", pointer);
      return;
    }

    if (state.mode !== "edit") {
      return;
    }

    if (state.tool === "paint") {
      handlePaintMouseDown(event, point);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (state.tool === "addWall") {
      addWall(point);
      return;
    }

    const groupHandle = hitGroupHandle?.(pointer.local, point);
    if (groupHandle) {
      const selectedRefs = Array.isArray(getSelectedRefs?.()) ? getSelectedRefs() : [];
      state.drag = {
        active: true,
        mode: "resizeGroup",
        handle: groupHandle,
        refs: selectedRefs.map((ref) => ({ ...ref })),
        ref: selectedRefs[selectedRefs.length - 1] || null,
        ox: 0,
        oy: 0,
        pointerMode: "world"
      };
      onDragStart?.({ mode: "resizeGroup", handle: groupHandle, refs: selectedRefs });
      return;
    }

    const hit = pickAt(scene, pointer.local.x, pointer.local.y, getViewportPickOptions());
    const toggleSelection = event.ctrlKey || event.metaKey;
    if (!hit) {
      selectionBoxActive = true;
      startSelectionBox?.(pointer.local);
      return;
    }

    if (toggleSelection) {
      onSelect(hit, { toggle: true });
      return;
    }

    const selectedRefs = Array.isArray(getSelectedRefs?.()) ? getSelectedRefs() : [];
    const hitAlreadySelected = selectedRefs.some((entry) => sameRef(entry, hit));
    if (!hitAlreadySelected) {
      onSelect(hit, { replace: true });
    }

    const object = getObjectByRef(scene, hit);
    if (!object) {
      return;
    }

    const dragRefs = hitAlreadySelected && selectedRefs.length > 0 ? selectedRefs : [hit];
    const dragPoint =
      getActiveViewportRenderer() === "native-3d"
        ? getViewportWorldPoint(pointer.local, object.z || 0)
        : isScene3DPreview(scene)
          ? unprojectScenePoint(pointer.local, state.cam, object.z || 0, scene)
          : point;

    state.drag = {
      active: true,
      mode: "move",
      ref: hit,
      refs: dragRefs.map((ref) => ({ ...ref })),
      ox: dragPoint.x - object.x,
      oy: dragPoint.y - object.y,
      pointerMode: getActiveViewportRenderer() === "native-3d" ? "native-3d" : isScene3DPreview(scene) ? "projected" : "world"
    };

    onDragStart?.({ mode: "move", refs: dragRefs });
  }

  function handlePaintMouseDown(event, point) {
    const state = model.state;
    const isErase = event.button === 2;

    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    if (state.paintTool === "brush" || state.paintTool === "random") {
      startPaintStroke();
      paintBrush?.(point, isErase ? 0 : state.tileId);
      return;
    }

    if (state.paintTool === "rect" || state.paintTool === "line") {
      beginShapeStroke(point, isErase);
      return;
    }

    if (state.paintTool === "fill") {
      onPaintStart?.();
      fillTiles?.(point, isErase ? 0 : state.tileId);
      onPaintEnd?.();
      return;
    }

    if (state.paintTool === "eyedropper" && event.button === 0) {
      sampleTile?.(point);
    }
  }

  function onMouseMove(event) {
    const state = model.state;
    const pointer = getPointer(event);
    const point = pointer.world;

    if (viewportNav) {
      updateViewportNavigation(pointer);
      return;
    }

    if (state.mode !== "edit") {
      return;
    }

    if (state.tool === "paint") {
      if (state.paintTool === "brush" || state.paintTool === "random") {
        if ((event.buttons & 1) === 1) {
          startPaintStroke();
          paintBrush?.(point, state.tileId);
        }
        if ((event.buttons & 2) === 2) {
          startPaintStroke();
          paintBrush?.(point, 0);
        }
        return;
      }

      if ((state.paintTool === "rect" || state.paintTool === "line") && shapeStrokeActive) {
        updatePaintShapePreview?.(point);
        return;
      }
    }

    if (selectionBoxActive) {
      updateSelectionBox?.(pointer.local);
      return;
    }

    if (!state.drag.active) {
      return;
    }

    let dragPoint = point;
    if (state.drag.pointerMode === "native-3d" && state.drag.ref) {
      const leadObject = getObjectByRef(model.scene, state.drag.ref);
      if (leadObject) {
        dragPoint = getViewportWorldPoint(pointer.local, leadObject.z || 0);
      }
    } else if (state.drag.pointerMode === "projected" && state.drag.ref) {
      const leadObject = getObjectByRef(model.scene, state.drag.ref);
      if (leadObject) {
        dragPoint = unprojectScenePoint(pointer.local, state.cam, leadObject.z || 0, model.scene);
      }
    }

    onDragMove({
      mode: state.drag.mode || "move",
      handle: state.drag.handle || null,
      ref: state.drag.ref,
      refs: state.drag.refs || [state.drag.ref],
      point: dragPoint,
      viewportPoint: pointer.local,
      offset: { x: state.drag.ox, y: state.drag.oy }
    });
  }

  function onMouseUp(event) {
    const pointer = getPointer(event);
    const point = pointer.world;

    if (viewportNav) {
      endViewportNavigation();
      return;
    }

    if (model.state.drag.active) {
      model.state.drag.active = false;
      onDragEnd?.();
    }

    if (shapeStrokeActive) {
      finishShapeStroke(point);
    }

    if (selectionBoxActive) {
      selectionBoxActive = false;
      selectArea?.(pointer.local, { toggle: event.ctrlKey || event.metaKey });
      clearSelectionBox?.();
    }

    endPaintStroke();
  }

  function onWheel(event) {
    if (model.state.mode !== "edit") {
      return;
    }

    event.preventDefault();
    const pointer = getPointer(event);
    const factor = Math.pow(1.0015, -event.deltaY);
    onViewportZoom?.(factor, pointer);
    onViewportNavigateEnd?.();
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  return {
    dispose() {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", onMouseUp);
    }
  };
}

function sameRef(a, b) {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}
