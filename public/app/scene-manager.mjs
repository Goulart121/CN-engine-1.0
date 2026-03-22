export function createSceneManagerController({
  container,
  countBadge,
  getProject,
  getActiveSceneId,
  onSelect,
  safe
}) {
  function refresh() {
    const project = getProject();
    const activeSceneId = getActiveSceneId();
    const scenes = Array.isArray(project?.scenes) ? project.scenes : [];

    container.innerHTML = "";

    scenes.forEach((scene) => {
      const node = document.createElement("div");
      node.className = `scene-item${scene.id === activeSceneId ? " active" : ""}`;
      node.innerHTML = `<strong>${safe(scene.name)}</strong><small>${safe(scene.id)}</small>`;
      node.addEventListener("click", () => onSelect(scene.id));
      container.appendChild(node);
    });

    countBadge.textContent = `${scenes.length} mapas`;
  }

  return {
    refresh
  };
}
