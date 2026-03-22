const PREFS_PREFIX = "cn-engine:prefs:";

export function loadProjectEditorPrefs(project) {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(getPrefsKey(project));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProjectEditorPrefs(project, prefs) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(getPrefsKey(project), JSON.stringify(prefs));
  } catch {
    // Ignore persistence failures to keep the editor usable in restricted environments.
  }
}

function getPrefsKey(project) {
  return `${PREFS_PREFIX}${String(project?.name || "project").trim() || "project"}`;
}
