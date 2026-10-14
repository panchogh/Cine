import { LIMITS } from '../data/constraints';
import type { AppAction, CssPoint, EntityId, FrameModel, GestureApi } from '../contracts';
import { actorPolygon, cameraFrameRect, mapLayout, polygonContains } from '../render/actor-geometry';

const DEFAULT_VIEWPORT = { widthPx: 1280, heightPx: 720 };
const DRAG_THRESHOLD_CSS_PX = 3;
const HIT_TOLERANCE_CSS_PX = 5;
interface PointerDrag { pointerId: number; actorId: EntityId; start: CssPoint; last: CssPoint; moved: boolean; originalY: number }

/** The optional viewport is CSS pixels. DPR belongs only to the canvas backing store. */
export function hitTest(point: CssPoint, frame: FrameModel, viewportCssPx = DEFAULT_VIEWPORT): EntityId | null {
  if (![point.xCssPx, point.yCssPx, viewportCssPx.widthPx, viewportCssPx.heightPx].every(Number.isFinite) || viewportCssPx.widthPx <= 0 || viewportCssPx.heightPx <= 0) return null;
  if (frame.activeView === 'camera') {
    const rect = cameraFrameRect(frame, viewportCssPx);
    if (point.xCssPx < rect.left || point.xCssPx > rect.left + rect.width || point.yCssPx < rect.top || point.yCssPx > rect.top + rect.height) return null;
  }
  for (const actor of [...frame.actors].reverse()) {
    const polygon = actorPolygon(actor, frame, frame.activeView, viewportCssPx);
    if (polygonContains({ x: point.xCssPx, y: point.yCssPx }, polygon, HIT_TOLERANCE_CSS_PX)) return actor.id;
  }
  return null;
}

export function topdownWorldPoint(point: CssPoint, viewportCssPx: { widthPx: number; heightPx: number }): { x: number; z: number } {
  const layout = mapLayout(viewportCssPx);
  return { x: (point.xCssPx - layout.origin.x) / layout.scale, z: (layout.origin.y - point.yCssPx) / layout.scale };
}

/** Pointer Events interaction: selection works in every view; only Planta moves actors. */
export function bindGestures(canvas: HTMLCanvasElement, readFrame: () => FrameModel, dispatch: (action: AppAction) => void): () => void {
  let drag: PointerDrag | null = null;
  let disposed = false;
  const oldTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  const cssPoint = (event: PointerEvent): CssPoint => {
    const rect = canvas.getBoundingClientRect();
    return { xCssPx: event.clientX - rect.left, yCssPx: event.clientY - rect.top };
  };
  const viewport = () => {
    const rect = canvas.getBoundingClientRect();
    return { widthPx: Math.max(1, rect.width), heightPx: Math.max(1, rect.height) };
  };
  const finish = (event: PointerEvent, commit: boolean): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = drag; drag = null;
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Browser may have cancelled capture already. */ }
    if (commit && current.moved) {
      const world = topdownWorldPoint(current.last, viewport());
      dispatch({ type: 'scene/actorMoved', actorId: current.actorId, positionM: {
        x: Math.min(LIMITS.sceneCoordinateM.max, Math.max(LIMITS.sceneCoordinateM.min, world.x)),
        y: current.originalY,
        z: Math.min(LIMITS.sceneCoordinateM.max, Math.max(LIMITS.sceneCoordinateM.min, world.z)),
      } });
    }
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (disposed || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const frame = readFrame(); const point = cssPoint(event); const actorId = hitTest(point, frame, viewport());
    dispatch({ type: 'ui/actorSelected', actorId });
    if (!actorId || frame.activeView !== 'topdown') return;
    const actor = frame.actors.find(item => item.id === actorId);
    if (!actor) return;
    drag = { pointerId: event.pointerId, actorId, start: point, last: point, moved: false, originalY: actor.positionM.y };
    try { canvas.setPointerCapture(event.pointerId); } catch { drag = null; }
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = cssPoint(event); drag.last = point;
    if (Math.hypot(point.xCssPx - drag.start.xCssPx, point.yCssPx - drag.start.yCssPx) >= DRAG_THRESHOLD_CSS_PX) drag.moved = true;
  };
  const onPointerUp = (event: PointerEvent): void => finish(event, true);
  const onPointerCancel = (event: PointerEvent): void => finish(event, false);
  const onLostCapture = (event: PointerEvent): void => finish(event, false);
  const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && drag) { const id = drag.pointerId; finish({ pointerId: id } as PointerEvent, false); } };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('lostpointercapture', onLostCapture);
  canvas.addEventListener('keydown', onKeyDown);
  return () => {
    disposed = true;
    if (drag) finish({ pointerId: drag.pointerId } as PointerEvent, false);
    canvas.style.touchAction = oldTouchAction;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('lostpointercapture', onLostCapture);
    canvas.removeEventListener('keydown', onKeyDown);
  };
}

export const gestureApi: GestureApi = { hitTest, bindGestures };

// Keep imports used to document the exact screen-space frame bounds consumed by both paths.
export { cameraFrameRect };
