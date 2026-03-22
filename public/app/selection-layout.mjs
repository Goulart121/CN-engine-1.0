import { num } from "./utils.mjs";

export function getSelectionBounds(objects) {
  const list = Array.isArray(objects) ? objects.filter(Boolean) : [];
  if (list.length === 0) {
    return null;
  }

  const minX = Math.min(...list.map((object) => object.x));
  const minY = Math.min(...list.map((object) => object.y));
  const maxX = Math.max(...list.map((object) => object.x + object.w));
  const maxY = Math.max(...list.map((object) => object.y + object.h));

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.round(maxX - minX),
    h: Math.round(maxY - minY)
  };
}

export function alignSelectionEntries(entries, mode) {
  const list = cloneEntries(entries);
  const bounds = getSelectionBounds(list);
  if (!bounds) {
    return [];
  }

  return list.map((entry) => {
    const next = { ...entry };

    if (mode === "left") next.x = bounds.x;
    if (mode === "right") next.x = bounds.x + bounds.w - entry.w;
    if (mode === "top") next.y = bounds.y;
    if (mode === "bottom") next.y = bounds.y + bounds.h - entry.h;
    if (mode === "h-center") next.x = Math.round(bounds.x + bounds.w / 2 - entry.w / 2);
    if (mode === "v-center") next.y = Math.round(bounds.y + bounds.h / 2 - entry.h / 2);

    return next;
  });
}

export function distributeSelectionEntries(entries, axis) {
  const list = cloneEntries(entries).map((entry, index) => ({ ...entry, __selectionLayoutId: `entry_${index}` }));
  if (list.length < 3) {
    return list;
  }

  if (axis === "x") {
    const ordered = [...list].sort((a, b) => a.x - b.x || a.y - b.y);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const inner = ordered.slice(1, -1);
    const available = last.x - (first.x + first.w);
    const occupied = inner.reduce((sum, entry) => sum + entry.w, 0);
    const gap = inner.length > 0 ? (available - occupied) / (inner.length + 1) : 0;
    let cursor = first.x + first.w + gap;
    inner.forEach((entry) => {
      entry.x = Math.round(cursor);
      cursor += entry.w + gap;
    });
    return mapBackToOriginal(list, ordered);
  }

  const ordered = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const inner = ordered.slice(1, -1);
  const available = last.y - (first.y + first.h);
  const occupied = inner.reduce((sum, entry) => sum + entry.h, 0);
  const gap = inner.length > 0 ? (available - occupied) / (inner.length + 1) : 0;
  let cursor = first.y + first.h + gap;
  inner.forEach((entry) => {
    entry.y = Math.round(cursor);
    cursor += entry.h + gap;
  });
  return mapBackToOriginal(list, ordered);
}

export function getGroupHandleAtPoint(bounds, point, options = {}) {
  if (!bounds || !point) {
    return null;
  }

  const pad = num(options.pad, 6);
  const radius = num(options.radius, 10);
  const corners = [
    { key: "nw", x: bounds.x - pad, y: bounds.y - pad },
    { key: "ne", x: bounds.x + bounds.w + pad, y: bounds.y - pad },
    { key: "sw", x: bounds.x - pad, y: bounds.y + bounds.h + pad },
    { key: "se", x: bounds.x + bounds.w + pad, y: bounds.y + bounds.h + pad }
  ];

  return corners.find((corner) => Math.abs(point.x - corner.x) <= radius && Math.abs(point.y - corner.y) <= radius)?.key || null;
}

export function resizeSelectionEntries(entries, handle, point, options = {}) {
  const list = cloneEntries(entries);
  const bounds = getSelectionBounds(list);
  if (!bounds || !point || !["nw", "ne", "sw", "se"].includes(handle)) {
    return list;
  }

  const minSize = Math.max(8, num(options.minSize, 8));
  const oldMinX = bounds.x;
  const oldMinY = bounds.y;
  const oldMaxX = bounds.x + bounds.w;
  const oldMaxY = bounds.y + bounds.h;

  let minX = oldMinX;
  let minY = oldMinY;
  let maxX = oldMaxX;
  let maxY = oldMaxY;

  if (handle.includes("w")) {
    minX = Math.min(point.x, oldMaxX - minSize);
  } else {
    maxX = Math.max(point.x, oldMinX + minSize);
  }

  if (handle.includes("n")) {
    minY = Math.min(point.y, oldMaxY - minSize);
  } else {
    maxY = Math.max(point.y, oldMinY + minSize);
  }

  const newBounds = {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.max(minSize, Math.round(maxX - minX)),
    h: Math.max(minSize, Math.round(maxY - minY))
  };

  const scaleX = bounds.w === 0 ? 1 : newBounds.w / bounds.w;
  const scaleY = bounds.h === 0 ? 1 : newBounds.h / bounds.h;

  return list.map((entry) => {
    const relLeft = (entry.x - bounds.x) / Math.max(1, bounds.w);
    const relTop = (entry.y - bounds.y) / Math.max(1, bounds.h);
    const relRight = (entry.x + entry.w - bounds.x) / Math.max(1, bounds.w);
    const relBottom = (entry.y + entry.h - bounds.y) / Math.max(1, bounds.h);

    const nextX = newBounds.x + relLeft * newBounds.w;
    const nextY = newBounds.y + relTop * newBounds.h;
    const nextRight = newBounds.x + relRight * newBounds.w;
    const nextBottom = newBounds.y + relBottom * newBounds.h;

    return {
      ...entry,
      x: Math.round(nextX),
      y: Math.round(nextY),
      w: Math.max(minSize, Math.round(nextRight - nextX)),
      h: Math.max(minSize, Math.round(nextBottom - nextY)),
      scaleX,
      scaleY
    };
  });
}

function cloneEntries(entries) {
  return (Array.isArray(entries) ? entries : []).filter(Boolean).map((entry) => ({ ...entry }));
}

function mapBackToOriginal(original, mutatedOrdered) {
  const byId = new Map(mutatedOrdered.map((entry) => [entry.__selectionLayoutId, entry]));
  return original.map((entry, index) => {
    const key = `entry_${index}`;
    const found = byId.get(key) || entry;
    const { __selectionLayoutId, ...clean } = found;
    return { ...clean };
  });
}
