import { cameraBasis } from '../core/geometry';
import type { FrameActor, FrameModel, RenderApi, RenderViewOptions, Vec2, Vec3, ViewId } from '../contracts';
import { actorPolygon, cameraFrameRect, mapLayout, worldToMap } from './actor-geometry';

const VIEW_LABELS: Record<ViewId, string> = { camera: 'Cámara', topdown: 'Planta', stage3d: 'Maqueta', side: 'Elevación · sección YZ' };
interface RenderLook { ndStops: number; grainPercent: number; shutterAngleDeg: number; frameRate: number }
interface InternalRenderOptions extends RenderViewOptions { cleanCapture?: boolean }
const grainPatternCache = new WeakMap<CanvasRenderingContext2D, { key: string; pattern: CanvasPattern }>();

function drawFrame(context: CanvasRenderingContext2D, frame: FrameModel, options: InternalRenderOptions): void {
  const pixelScale = context.getTransform().a || 1;
  const width = context.canvas.width / pixelScale; const height = context.canvas.height / pixelScale;
  context.clearRect(0, 0, width, height);
  context.fillStyle = options.clearColor ?? '#101311'; context.fillRect(0, 0, width, height);
  switch (frame.activeView) {
    case 'camera': drawCamera(context, frame, options.guides, width, height, options.cleanCapture ?? false); applyCameraLook(context, frame, width, height); break;
    case 'topdown': drawMap(context, frame, 'topdown', width, height); break;
    case 'stage3d': drawMap(context, frame, 'stage3d', width, height); break;
    case 'side': drawMap(context, frame, 'side', width, height); break;
  }
  if (!options.cleanCapture) drawOverlay(context, frame, width);
}

function drawCamera(context: CanvasRenderingContext2D, frame: FrameModel, guides: boolean, width: number, height: number, cleanCapture: boolean): void {
  const rect = cameraFrameRect(frame, { widthPx: width, heightPx: height });
  context.fillStyle = '#080a09'; context.fillRect(rect.left, rect.top, rect.width, rect.height);
  if (!cleanCapture || guides) { context.strokeStyle = '#d6dfd9'; context.lineWidth = 1.5; context.strokeRect(rect.left, rect.top, rect.width, rect.height); }
  if (guides) {
    context.strokeStyle = '#72d1b1'; context.setLineDash([5, 5]); context.beginPath();
    context.moveTo(rect.left + rect.width / 3, rect.top); context.lineTo(rect.left + rect.width / 3, rect.top + rect.height);
    context.moveTo(rect.left + rect.width * 2 / 3, rect.top); context.lineTo(rect.left + rect.width * 2 / 3, rect.top + rect.height);
    context.moveTo(rect.left, rect.top + rect.height / 3); context.lineTo(rect.left + rect.width, rect.top + rect.height / 3);
    context.moveTo(rect.left, rect.top + rect.height * 2 / 3); context.lineTo(rect.left + rect.width, rect.top + rect.height * 2 / 3);
    context.stroke(); context.setLineDash([]);
  }
  context.save(); context.beginPath(); context.rect(rect.left, rect.top, rect.width, rect.height); context.clip();
  const basis = cameraBasis(frame.camera.yawDeg, frame.camera.pitchDeg);
  const ordered = frame.actors.map(actor => ({ actor, depth: axialDepth(actor, frame, basis.forward) })).sort((a, b) => b.depth - a.depth);
  for (const { actor } of ordered) {
    const polygon = actorPolygon(actor, frame, 'camera', { widthPx: width, heightPx: height });
    fillPolygon(context, polygon, actor.color, '#0c100e');
  }
  context.restore();
}

function drawMap(context: CanvasRenderingContext2D, frame: FrameModel, kind: Exclude<ViewId, 'camera'>, width: number, height: number): void {
  const layout = mapLayout({ widthPx: width, heightPx: height });
  drawGrid(context, kind, layout);
  for (const actor of frame.actors) fillPolygon(context, actorPolygon(actor, frame, kind, layout), actor.color, '#0c100e');
  if (kind === 'topdown') drawTopdownFrustum(context, frame, layout);
  else if (kind === 'side') drawSideFrustum(context, frame, layout);
  else drawStageFrustum(context, frame, layout);
  context.fillStyle = '#a9b5ac'; context.font = '11px system-ui';
  const caption = kind === 'topdown' ? 'X ↔ · Z ↑ · metros' : kind === 'side' ? 'Sección/proyección: Z ↔ · Y ↑ · metros' : 'Proyección isométrica · X/Y/Z · metros';
  context.fillText(caption, 18, height - 16);
}

function drawGrid(context: CanvasRenderingContext2D, kind: Exclude<ViewId, 'camera'>, layout: ReturnType<typeof mapLayout>): void {
  context.strokeStyle = '#29332d'; context.lineWidth = 1;
  for (let i = -5; i <= 5; i++) {
    const a = kind === 'topdown' ? worldToMap({ x: i, y: 0, z: -5 }, kind, layout) : kind === 'side' ? worldToMap({ x: 0, y: i, z: -5 }, kind, layout) : worldToMap({ x: i, y: 0, z: -5 }, kind, layout);
    const b = kind === 'topdown' ? worldToMap({ x: i, y: 0, z: 5 }, kind, layout) : kind === 'side' ? worldToMap({ x: 0, y: i, z: 5 }, kind, layout) : worldToMap({ x: i, y: 0, z: 5 }, kind, layout);
    const c = kind === 'topdown' ? worldToMap({ x: -5, y: 0, z: i }, kind, layout) : kind === 'side' ? worldToMap({ x: 0, y: -5, z: i }, kind, layout) : worldToMap({ x: -5, y: 0, z: i }, kind, layout);
    const d = kind === 'topdown' ? worldToMap({ x: 5, y: 0, z: i }, kind, layout) : kind === 'side' ? worldToMap({ x: 0, y: 5, z: i }, kind, layout) : worldToMap({ x: 5, y: 0, z: i }, kind, layout);
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.moveTo(c.x, c.y); context.lineTo(d.x, d.y); context.stroke();
  }
}

function drawTopdownFrustum(context: CanvasRenderingContext2D, frame: FrameModel, layout: ReturnType<typeof mapLayout>): void {
  const corners = gateCorners(frame, 5).map(point => groundProjection(point, frame.camera.positionM));
  drawFrustum(context, worldToMap(frame.camera.positionM, 'topdown', layout), corners.map(point => worldToMap(point, 'topdown', layout)));
}

function drawSideFrustum(context: CanvasRenderingContext2D, frame: FrameModel, layout: ReturnType<typeof mapLayout>): void {
  const basis = cameraBasis(frame.camera.yawDeg, frame.camera.pitchDeg, frame.camera.rollDeg);
  const distance = 5; const vertical = distance * Math.tan(frame.metrics.fieldOfView.verticalDeg * Math.PI / 360);
  const points = [-1, 1].map(sign => add3(frame.camera.positionM, add3(scale3(basis.forward, distance), scale3(basis.up, vertical * sign))));
  const center = add3(frame.camera.positionM, scale3(basis.forward, distance));
  drawFrustum(context, worldToMap(frame.camera.positionM, 'side', layout), [...points, center].map(point => worldToMap(point, 'side', layout)), false);
  const ray = worldToMap(center, 'side', layout); const origin = worldToMap(frame.camera.positionM, 'side', layout);
  context.strokeStyle = '#f1eee3'; context.lineWidth = 1.3; context.beginPath(); context.moveTo(origin.x, origin.y); context.lineTo(ray.x, ray.y); context.stroke();
}

function drawStageFrustum(context: CanvasRenderingContext2D, frame: FrameModel, layout: ReturnType<typeof mapLayout>): void {
  const corners = gateCorners(frame, 5).map(point => worldToMap(point, 'stage3d', layout));
  drawFrustum(context, worldToMap(frame.camera.positionM, 'stage3d', layout), corners);
}

function gateCorners(frame: FrameModel, distanceM: number): Vec3[] {
  const basis = cameraBasis(frame.camera.yawDeg, frame.camera.pitchDeg, frame.camera.rollDeg);
  const halfWidth = distanceM * Math.tan(frame.metrics.fieldOfView.horizontalDeg * Math.PI / 360);
  const halfHeight = distanceM * Math.tan(frame.metrics.fieldOfView.verticalDeg * Math.PI / 360);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => add3(frame.camera.positionM, add3(
    scale3(basis.forward, distanceM),
    add3(scale3(basis.right, x! * halfWidth), scale3(basis.up, y! * halfHeight)),
  )));
}

function groundProjection(point: Vec3, camera: Vec3): Vec3 {
  const direction = subtract3(point, camera);
  if (direction.y < -1e-5) {
    const distance = -camera.y / direction.y;
    if (distance > 0 && Number.isFinite(distance)) return add3(camera, scale3(direction, distance));
  }
  const horizontalLength = Math.hypot(direction.x, direction.z) || 1;
  return { x: camera.x + direction.x / horizontalLength * 5, y: 0, z: camera.z + direction.z / horizontalLength * 5 };
}

function drawFrustum(context: CanvasRenderingContext2D, origin: Vec2, corners: Vec2[], closeLoop = true): void {
  context.strokeStyle = '#f1eee3'; context.lineWidth = 1.5; context.beginPath();
  for (const corner of corners) { context.moveTo(origin.x, origin.y); context.lineTo(corner.x, corner.y); }
  if (closeLoop && corners.length >= 3) {
    context.moveTo(corners[0]!.x, corners[0]!.y);
    for (const corner of corners.slice(1)) context.lineTo(corner.x, corner.y);
    context.closePath();
  }
  context.stroke(); context.fillStyle = '#f1eee3'; context.beginPath(); context.arc(origin.x, origin.y, 4, 0, Math.PI * 2); context.fill();
}

function fillPolygon(context: CanvasRenderingContext2D, points: Vec2[], color: string, stroke: string): void {
  if (points.length < 3) return;
  context.beginPath(); context.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath(); context.fillStyle = color; context.fill(); context.strokeStyle = stroke; context.lineWidth = 1; context.stroke();
}

function applyCameraLook(context: CanvasRenderingContext2D, frame: FrameModel, width: number, height: number): void {
  const look = (frame as FrameModel & { look?: RenderLook }).look;
  if (!look) return;
  if (Number.isFinite(look.ndStops) && look.ndStops > 0) {
    const alpha = 1 - 2 ** -Math.min(look.ndStops, 16);
    context.fillStyle = `rgba(0, 0, 0, ${alpha})`; context.fillRect(0, 0, width, height);
  }
  if (Number.isFinite(look.grainPercent) && look.grainPercent > 0) {
    const pattern = grainPattern(context, frame.timeSeconds, look.grainPercent);
    if (pattern) {
      context.save(); context.globalCompositeOperation = 'soft-light'; context.globalAlpha = Math.min(0.22, look.grainPercent / 100 * 0.22);
      context.fillStyle = pattern; context.fillRect(0, 0, width, height); context.restore();
    }
  }
}

function grainPattern(context: CanvasRenderingContext2D, timeSeconds: number, grainPercent: number): CanvasPattern | null {
  const key = `${timeSeconds}:${grainPercent}`;
  const cached = grainPatternCache.get(context);
  if (cached?.key === key) return cached.pattern;
  const doc = context.canvas.ownerDocument ?? (typeof document === 'undefined' ? null : document);
  if (!doc) return null;
  const tile = doc.createElement('canvas'); tile.width = 128; tile.height = 128;
  const tileContext = tile.getContext('2d'); if (!tileContext) return null;
  const image = tileContext.createImageData(tile.width, tile.height);
  let seed = hashSeed(key) || 1;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const shade = seed >>> 24;
    image.data[i] = shade; image.data[i + 1] = shade; image.data[i + 2] = shade; image.data[i + 3] = 255;
  }
  tileContext.putImageData(image, 0, 0);
  const pattern = context.createPattern(tile, 'repeat');
  if (pattern) grainPatternCache.set(context, { key, pattern });
  return pattern;
}

function drawOverlay(context: CanvasRenderingContext2D, frame: FrameModel, width: number): void {
  const look = (frame as FrameModel & { look?: RenderLook }).look;
  context.fillStyle = '#c1ccc3'; context.font = '12px system-ui';
  const lookText = frame.activeView === 'camera' && look
    ? ` · ND ${look.ndStops} stops aprox. · grano ${look.grainPercent}% · obturación metadato (sin blur)` : '';
  context.fillText(`${VIEW_LABELS[frame.activeView]} · ${frame.camera.focalLengthMm} mm · ${frame.metrics.fieldOfView.horizontalDeg.toFixed(1)}° HFOV${lookText}`, 18, 22, Math.max(80, width - 36));
  const warning = frame.warnings[0];
  if (warning) { context.fillStyle = '#e5bd73'; context.fillText(warning, 18, 42, Math.max(80, width - 36)); }
}

function axialDepth(actor: FrameActor, frame: FrameModel, forward: Vec3): number {
  const delta = subtract3(actor.positionM, frame.camera.positionM);
  return delta.x * forward.x + delta.y * forward.y + delta.z * forward.z;
}
function add3(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function subtract3(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale3(a: Vec3, scale: number): Vec3 { return { x: a.x * scale, y: a.y * scale, z: a.z * scale }; }
function hashSeed(value: string): number { let hash = 2166136261; for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619); return hash >>> 0; }

export const canvasRenderer: RenderApi = {
  renderView: drawFrame,
  captureFrame(frame, options) {
    if (!Number.isFinite(options.widthPx) || !Number.isFinite(options.heightPx) || options.widthPx <= 0 || options.heightPx <= 0) return Promise.reject(new RangeError('La resolución de captura debe ser positiva y finita.'));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(options.widthPx); canvas.height = Math.round(options.heightPx);
    const context = canvas.getContext('2d');
    if (!context) return Promise.reject(new Error('Canvas 2D no disponible'));
    drawFrame(context, { ...frame, activeView: 'camera' }, { guides: options.includeGuides ?? false, cleanCapture: true });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo exportar el frame')), 'image/png'));
  },
};
