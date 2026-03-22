export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function snap(value, step) {
  return Math.floor(value / step) * step;
}

export function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function collides(body, walls) {
  return walls.some((wall) => overlap(body, wall));
}

export function safe(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isTyping(target) {
  return target instanceof HTMLElement && ["input", "textarea"].includes(target.tagName.toLowerCase());
}

export function sameRef(a, b) {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

export function clampWorld(object, world) {
  object.x = clamp(object.x, 0, Math.max(0, world.width - object.w));
  object.y = clamp(object.y, 0, Math.max(0, world.height - object.h));
}

export function mouseWorld(canvas, camera, event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left + camera.x,
    y: event.clientY - bounds.top + camera.y
  };
}
