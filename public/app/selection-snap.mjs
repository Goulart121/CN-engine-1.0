import { num } from "./utils.mjs";

export function collectSnapLines(objects, world = null) {
  const sourceObjects = Array.isArray(objects) ? objects.filter(Boolean) : [];
  const vertical = [];
  const horizontal = [];

  sourceObjects.forEach((object) => {
    vertical.push({ value: object.x, start: object.y, end: object.y + object.h });
    vertical.push({ value: object.x + object.w / 2, start: object.y, end: object.y + object.h });
    vertical.push({ value: object.x + object.w, start: object.y, end: object.y + object.h });

    horizontal.push({ value: object.y, start: object.x, end: object.x + object.w });
    horizontal.push({ value: object.y + object.h / 2, start: object.x, end: object.x + object.w });
    horizontal.push({ value: object.y + object.h, start: object.x, end: object.x + object.w });
  });

  if (world) {
    vertical.push({ value: 0, start: 0, end: world.height });
    vertical.push({ value: world.width / 2, start: 0, end: world.height });
    vertical.push({ value: world.width, start: 0, end: world.height });
    horizontal.push({ value: 0, start: 0, end: world.width });
    horizontal.push({ value: world.height / 2, start: 0, end: world.width });
    horizontal.push({ value: world.height, start: 0, end: world.width });
  }

  return { vertical, horizontal };
}

export function snapMoveBounds(bounds, snapLines, options = {}) {
  const threshold = Math.max(0, num(options.threshold, 8));
  const xMatch = findBestLineMatch([bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w], snapLines?.vertical || [], threshold);
  const yMatch = findBestLineMatch([bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h], snapLines?.horizontal || [], threshold);

  return {
    bounds: {
      ...bounds,
      x: Math.round(bounds.x + xMatch.delta),
      y: Math.round(bounds.y + yMatch.delta)
    },
    deltaX: xMatch.delta,
    deltaY: yMatch.delta,
    guides: buildGuides(xMatch, yMatch, bounds)
  };
}

export function snapResizeBounds(bounds, handle, snapLines, options = {}) {
  const threshold = Math.max(0, num(options.threshold, 8));
  let nextBounds = { ...bounds };
  const guides = { vertical: [], horizontal: [] };

  if (String(handle || "").includes("e")) {
    const match = findBestLineMatch([bounds.x + bounds.w], snapLines?.vertical || [], threshold);
    nextBounds.w = Math.max(8, Math.round(bounds.w + match.delta));
    guides.vertical = match.guide ? [match.guide] : [];
  }

  if (String(handle || "").includes("w")) {
    const match = findBestLineMatch([bounds.x], snapLines?.vertical || [], threshold);
    nextBounds.x = Math.round(bounds.x + match.delta);
    nextBounds.w = Math.max(8, Math.round(bounds.w - match.delta));
    guides.vertical = match.guide ? [match.guide] : [];
  }

  if (String(handle || "").includes("s")) {
    const match = findBestLineMatch([bounds.y + bounds.h], snapLines?.horizontal || [], threshold);
    nextBounds.h = Math.max(8, Math.round(bounds.h + match.delta));
    guides.horizontal = match.guide ? [match.guide] : [];
  }

  if (String(handle || "").includes("n")) {
    const match = findBestLineMatch([bounds.y], snapLines?.horizontal || [], threshold);
    nextBounds.y = Math.round(bounds.y + match.delta);
    nextBounds.h = Math.max(8, Math.round(bounds.h - match.delta));
    guides.horizontal = match.guide ? [match.guide] : [];
  }

  return { bounds: nextBounds, guides };
}

function findBestLineMatch(candidates, lines, threshold) {
  let best = { delta: 0, guide: null, distance: Number.POSITIVE_INFINITY };

  candidates.forEach((candidate) => {
    lines.forEach((line) => {
      const delta = line.value - candidate;
      const distance = Math.abs(delta);
      if (distance <= threshold && distance < best.distance) {
        best = {
          delta,
          distance,
          guide: { ...line }
        };
      }
    });
  });

  return {
    delta: Number.isFinite(best.distance) ? best.delta : 0,
    guide: Number.isFinite(best.distance) ? best.guide : null
  };
}

function buildGuides(xMatch, yMatch, bounds) {
  return {
    vertical: xMatch.guide ? [{ ...xMatch.guide, start: Math.min(xMatch.guide.start, bounds.y), end: Math.max(xMatch.guide.end, bounds.y + bounds.h) }] : [],
    horizontal: yMatch.guide ? [{ ...yMatch.guide, start: Math.min(yMatch.guide.start, bounds.x), end: Math.max(yMatch.guide.end, bounds.x + bounds.w) }] : []
  };
}
