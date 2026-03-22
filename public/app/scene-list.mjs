import { OBJECT_TYPE_LABELS } from "./constants.mjs";

export function createSceneListController({ container, objectCountBadge, getScene, getSelectedRef, getSelectedRefs, onSelect, sameRef, safe }) {
  function refresh() {
    const scene = getScene();
    const selected = getSelectedRef();
    const selectedRefs = Array.isArray(getSelectedRefs?.()) ? getSelectedRefs() : selected ? [selected] : [];
    const gameplayObjects = Array.isArray(scene.gameObjects) ? scene.gameObjects : [];
    const getTypeLabel = (type) => OBJECT_TYPE_LABELS[type] || type || "Objeto";

    const items = [
      { ref: { kind: "entity", id: "player" }, title: scene.player.name, sub: `Entidade / ${getTypeLabel("player")}` },
      { ref: { kind: "entity", id: "enemy" }, title: scene.enemy.name, sub: `Entidade / ${getTypeLabel("enemy")}` },
      ...scene.walls.map((wall) => ({ ref: { kind: "wall", id: wall.id }, title: wall.name, sub: `Parede / ${wall.w}x${wall.h}` })),
      ...gameplayObjects.map((item) => ({
        ref: { kind: "gameplayObject", id: item.id },
        title: item.name,
        sub: `Jogo / ${getTypeLabel(item.type)}`
      }))
    ];

    container.innerHTML = "";
    items.forEach((item) => {
      const isSelected = selectedRefs.some((entry) => sameRef(entry, item.ref));
      const isPrimary = sameRef(item.ref, selected);
      const node = document.createElement("div");
      node.className = [
        "scene-item",
        isSelected ? "multi-active" : "",
        isPrimary ? "primary-active active" : ""
      ]
        .filter(Boolean)
        .join(" ");
      node.innerHTML = `<strong>${safe(item.title)}</strong><small>${safe(item.sub)}</small>`;
      node.addEventListener("click", (event) => onSelect(item.ref, { toggle: event.ctrlKey || event.metaKey }));
      container.appendChild(node);
    });

    objectCountBadge.textContent = `${2 + scene.walls.length + gameplayObjects.length} objetos`;
  }

  return {
    refresh
  };
}
