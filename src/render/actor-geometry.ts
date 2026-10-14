import type { FrameActor, FrameModel, Vec2, Vec3, ViewId } from '../contracts';
import { projectPoint } from '../core/geometry';

export interface RenderViewport { widthPx: number; heightPx: number }
export interface MapLayout extends RenderViewport { scale: number; origin: Vec2 }

export function actorWorldCorners(actor: FrameActor): Vec3[] {
  const height = actor.heightM * (actor.pose === 'sitting' ? 0.65 : 1);
  const halfWidth = actor.heightM * (actor.pose === 'sitting' ? 0.23 : 0.12);
  const halfDepth = actor.heightM * 0.07;
  const yaw = actor.yawDeg * Math.PI / 180;
  const points: Vec3[] = [];
  for (const y of [actor.positionM.y, actor.positionM.y + height]) {
    for (const x of [-halfWidth, halfWidth]) for (const z of [-halfDepth, halfDepth]) {
      points.push({
        x: actor.positionM.x + x * Math.cos(yaw) + z * Math.sin(yaw),
        y,
        z: actor.positionM.z - x * Math.sin(yaw) + z * Math.cos(yaw),
      });
    }
  }
  return points;
}

export function cameraFrameRect(frame: FrameModel, viewport: RenderViewport): { left: number; top: number; width: number; height: number } {
  const aspect = frame.gate.outputAspect;
  const height = Math.min(viewport.heightPx, viewport.widthPx / aspect);
  const width = height * aspect;
  return { left: (viewport.widthPx - width) / 2, top: (viewport.heightPx - height) / 2, width, height };
}

export function mapLayout(viewport: RenderViewport): MapLayout {
  return { ...viewport, scale: Math.min(viewport.widthPx, viewport.heightPx) / 12, origin: { x: viewport.widthPx / 2, y: viewport.heightPx * 0.58 } };
}

export function worldToMap(point: Vec3, view: Exclude<ViewId, 'camera'>, layout: MapLayout): Vec2 {
  if (view === 'topdown') return { x: layout.origin.x + point.x * layout.scale, y: layout.origin.y - point.z * layout.scale };
  if (view === 'side') return { x: layout.origin.x + point.z * layout.scale, y: layout.origin.y - point.y * layout.scale };
  const iso = (point.x - point.z) * 0.72;
  const vertical = point.y - (point.x + point.z) * 0.36;
  return { x: layout.origin.x + iso * layout.scale, y: layout.origin.y - vertical * layout.scale };
}

export function actorPolygon(actor: FrameActor, frame: FrameModel, view: ViewId, viewport: RenderViewport): Vec2[] {
  const corners = actorWorldCorners(actor);
  if (view === 'camera') {
    const rect = cameraFrameRect(frame, viewport);
    const points = corners.map(point => {
      const projected = projectPoint(point, frame.camera, frame.gate, { widthPx: rect.width, heightPx: rect.height }, frame.squeeze);
      return projected ? { x: rect.left + projected.xPx, y: rect.top + projected.yPx } : null;
    }).filter((point): point is Vec2 => point !== null);
    return clipPolygon(convexHull(points), rect);
  }
  return convexHull(corners.map(point => worldToMap(point, view, mapLayout(viewport))));
}

function clipPolygon(points: Vec2[], rect: { left: number; top: number; width: number; height: number }): Vec2[] {
  let output = points;
  const edges: { inside: (p: Vec2) => boolean; intersect: (a: Vec2, b: Vec2) => Vec2 }[] = [
    { inside: p => p.x >= rect.left, intersect: (a, b) => ({ x: rect.left, y: a.y + (b.y - a.y) * (rect.left - a.x) / (b.x - a.x) }) },
    { inside: p => p.x <= rect.left + rect.width, intersect: (a, b) => ({ x: rect.left + rect.width, y: a.y + (b.y - a.y) * (rect.left + rect.width - a.x) / (b.x - a.x) }) },
    { inside: p => p.y >= rect.top, intersect: (a, b) => ({ x: a.x + (b.x - a.x) * (rect.top - a.y) / (b.y - a.y), y: rect.top }) },
    { inside: p => p.y <= rect.top + rect.height, intersect: (a, b) => ({ x: a.x + (b.x - a.x) * (rect.top + rect.height - a.y) / (b.y - a.y), y: rect.top + rect.height }) },
  ];
  for (const edge of edges) {
    const input = output; output = [];
    if (!input.length) break;
    let previous = input[input.length - 1]!;
    for (const current of input) {
      const currentInside = edge.inside(current); const previousInside = edge.inside(previous);
      if (currentInside) { if (!previousInside) output.push(edge.intersect(previous, current)); output.push(current); }
      else if (previousInside) output.push(edge.intersect(previous, current));
      previous = current;
    }
  }
  return output;
}

export function convexHull(points: Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 1) return sorted;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const point of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop(); lower.push(point); }
  const upper: Vec2[] = [];
  for (const point of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop(); upper.push(point); }
  lower.pop(); upper.pop();
  return [...lower, ...upper];
}

export function polygonContains(point: Vec2, polygon: Vec2[], tolerancePx = 0): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!; const b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    if (tolerancePx > 0 && distanceToSegment(point, a, b) <= tolerancePx) return true;
  }
  return inside;
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
