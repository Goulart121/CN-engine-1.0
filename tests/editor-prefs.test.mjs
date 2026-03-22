import test from "node:test";
import assert from "node:assert/strict";

import { loadProjectEditorPrefs, saveProjectEditorPrefs } from "../public/app/editor-prefs.mjs";

test("editor prefs salva e carrega preferencias por nome de projeto", () => {
  const store = new Map();
  const previousStorage = globalThis.localStorage;

  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    }
  };

  try {
    const project = { name: "Projeto Teste" };
    const prefs = {
      tool: "paint",
      viewportRenderer: "native-3d",
      nativeCamera: {
        focusX: 420,
        focusY: 260,
        yaw: -0.8,
        pitch: 0.58,
        zoom: 1.3
      },
      paintTool: "line",
      tileLayer: "foreground",
      tileId: 4,
      layerSettings: {
        foreground: { visible: true, locked: true }
      }
    };

    saveProjectEditorPrefs(project, prefs);

    assert.deepEqual(loadProjectEditorPrefs(project), prefs);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("editor prefs retorna null quando localStorage nao existe", () => {
  const previousStorage = globalThis.localStorage;

  try {
    globalThis.localStorage = undefined;
    assert.equal(loadProjectEditorPrefs({ name: "Sem Storage" }), null);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});
