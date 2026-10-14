import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppAction } from '../../src/contracts';
import { entityId } from '../../src/data/defaults';
import { hitTest, bindGestures, topdownWorldPoint } from '../../src/interaction/gestures';
import { canvasRenderer } from '../../src/render/canvas-renderer';
import { deriveFrame } from '../../src/render/frame';
import { createRenderScheduler } from '../../src/render/scheduler';
import { actorPolygon } from '../../src/render/actor-geometry';
import { captureShot } from '../../src/shotlist/catalog';
import { fixtureProject } from '../fixtures/project';

afterEach(() => vi.unstubAllGlobals());

describe('render and gesture acceptance', () => {
  it('V13: picking follows roll and remains in CSS pixels at DPR 1 or 2', () => {
    const project = { ...fixtureProject, camera: { ...fixtureProject.camera, rollDeg: 35 } };
    const frame = deriveFrame(project, 0, 'camera');
    const actor = frame.actors[0]!; const viewport = { widthPx: 960, heightPx: 600 };
    const polygon = actorPolygon(actor, frame, 'camera', viewport);
    const center = centroid(polygon);
    expect(hitTest({ xCssPx: center.x, yCssPx: center.y }, frame, viewport)).toBe(actor.id);
    // Device backing resolution is deliberately absent from the API; the same CSS point is used at DPR 2.
    expect(hitTest({ xCssPx: center.x, yCssPx: center.y }, frame, viewport)).toBe(actor.id);
    expect(hitTest({ xCssPx: 480, yCssPx: 10 }, frame, viewport)).toBeNull();
    const overlapProject = { ...project, scene: { ...project.scene, actors: [actor, { ...actor, id: entityId('overlap-actor'), color: '#ef6655' }] } };
    const overlapFrame = deriveFrame(overlapProject, 0, 'camera');
    const overlapPoly = actorPolygon(overlapFrame.actors[1]!, overlapFrame, 'camera', viewport);
    const overlapCenter = centroid(overlapPoly);
    expect(hitTest({ xCssPx: overlapCenter.x, yCssPx: overlapCenter.y }, overlapFrame, viewport)).toBe(overlapFrame.actors[1]!.id);
  });

  it('V14/V15: Pointer Events accumulate slow drag deltas, commit once and cancel cleanly', () => {
    const frame = deriveFrame(fixtureProject, 0, 'topdown');
    const fake = fakeCanvas(600, 600);
    const actions: AppAction[] = [];
    const dispose = bindGestures(fake.canvas, () => frame, action => actions.push(action));
    const actor = frame.actors[0]!;
    const center = centroid(actorPolygon(actor, frame, 'topdown', { widthPx: 600, heightPx: 600 }));
    fake.fire('pointerdown', { pointerId: 7, isPrimary: true, pointerType: 'touch', button: 0, clientX: center.x + 100, clientY: center.y + 50 });
    fake.fire('pointermove', { pointerId: 7, clientX: center.x + 101, clientY: center.y + 50 });
    fake.fire('pointermove', { pointerId: 7, clientX: center.x + 102, clientY: center.y + 49 });
    fake.fire('pointermove', { pointerId: 7, clientX: center.x + 104, clientY: center.y + 48 });
    fake.fire('pointerup', { pointerId: 7 });
    expect(actions.filter(action => action.type === 'scene/actorMoved')).toHaveLength(1);
    expect(actions.filter(action => action.type === 'ui/actorSelected')).toHaveLength(1);
    const moved = actions.find(action => action.type === 'scene/actorMoved');
    if (moved?.type === 'scene/actorMoved') {
      expect(moved.positionM.x).toBeGreaterThan(actor.positionM.x);
      expect(moved.positionM.z).toBeGreaterThan(actor.positionM.z);
    }
    expect(fake.canvas.style.touchAction).toBe('none');

    fake.fire('pointerdown', { pointerId: 8, isPrimary: true, pointerType: 'mouse', button: 0, clientX: center.x + 100, clientY: center.y + 50 });
    fake.fire('pointermove', { pointerId: 8, clientX: center.x + 120, clientY: center.y + 70 });
    fake.fire('pointercancel', { pointerId: 8 });
    expect(actions.filter(action => action.type === 'scene/actorMoved')).toHaveLength(1);
    dispose();
    expect(fake.canvas.style.touchAction).toBe('');
    expect(fake.listenerCount()).toBe(0);
  });

  it('V15: maps a CSS point back to X/Z with the same inverted screen Y convention', () => {
    expect(topdownWorldPoint({ xCssPx: 300, yCssPx: 348 }, { widthPx: 600, heightPx: 600 })).toEqual({ x: 0, z: 0 });
    expect(topdownWorldPoint({ xCssPx: 312, yCssPx: 336 }, { widthPx: 600, heightPx: 600 })).toEqual({ x: 0.24, z: 0.24 });
  });

  it('V16/V17: captures camera view from one evaluated frame regardless of its displayed view', async () => {
    const project = { ...fixtureProject, camera: { ...fixtureProject.camera, motion: { kind: 'push_in' as const, durationS: 2, pushInDistanceM: 0.8 } } };
    const sideFrame = deriveFrame(project, 1.25, 'side');
    const canvasRuntime = fakeDocument();
    vi.stubGlobal('document', canvasRuntime.document);
    const blobs = [];
    for (const view of ['camera', 'topdown', 'stage3d', 'side'] as const) {
      const blob = await canvasRenderer.captureFrame(deriveFrame(project, 1.25, view), { widthPx: 1280, heightPx: 720 });
      blobs.push(blob);
    }
    const blob = blobs[3]!;
    expect(blob.type).toBe('image/png');
    for (const context of canvasRuntime.contexts.filter(context => context.canvas.width === 1280)) {
      expect(context.text).toEqual([]);
      expect(context.strokeRectCalls).toBe(0);
    }
    expect(sideFrame.timeSeconds).toBe(1.25);
    expect(sideFrame.camera.timeSeconds).toBe(1.25);
    expect(canvasRuntime.canvases.find(canvas => canvas.width === 1280)?.width).toBe(1280);
    expect(canvasRuntime.contexts.find(context => context.canvas.width === 1280)?.dashCalls).toBe(0);
    const evaluatedCamera = { ...project.camera, positionM: sideFrame.camera.positionM, yawDeg: sideFrame.camera.yawDeg, pitchDeg: sideFrame.camera.pitchDeg, rollDeg: sideFrame.camera.rollDeg, focalLengthMm: sideFrame.camera.focalLengthMm, focus: { kind: 'manual' as const, distanceM: sideFrame.camera.focusDistanceM }, motion: { kind: 'static' as const, durationS: 0 } };
    const shotCapture = captureShot(project, { camera: evaluatedCamera, capturedAtS: sideFrame.timeSeconds, thumbnail: blob });
    expect(shotCapture.shot.camera.positionM).toEqual(sideFrame.camera.positionM);
    expect(shotCapture.shot.capturedAtS).toBe(sideFrame.camera.timeSeconds);
    expect(shotCapture.thumbnail?.blob).toBe(blob);
  });

  it('V18: ND changes approximate attenuation and seeded grain is deterministic; shutter stays metadata', async () => {
    const canvasRuntime = fakeDocument(); vi.stubGlobal('document', canvasRuntime.document);
    const project = { ...fixtureProject, look: { ...fixtureProject.look, ndStops: 3, grainPercent: 45, shutterAngleDeg: 180, frameRate: 24 } };
    const frame = deriveFrame(project, 0.5, 'camera');
    const previewCanvas = canvasRuntime.document.createElement(); previewCanvas.width = 800; previewCanvas.height = 335;
    const context = previewCanvas.getContext!()!; canvasRenderer.renderView(context, frame, { guides: false });
    const previewContext = canvasRuntime.contexts.find(item => item.canvas === previewCanvas)!;
    expect(previewContext.fillStyles.some(value => value.includes('0.875'))).toBe(true);
    expect(previewContext.composites).toContain('soft-light');
    expect(previewContext.text.some(text => text.includes('obturación metadato (sin blur)'))).toBe(true);
    const firstNoise = canvasRuntime.noise.at(-1)!;
    await canvasRenderer.captureFrame(frame, { widthPx: 800, heightPx: 335 });
    expect(canvasRuntime.noise.at(-1)).toEqual(firstNoise);
  });

  it('V19: aperture, focal, gate and squeeze change only their expected optical/projected results', () => {
    const base = deriveFrame(fixtureProject, 0, 'camera');
    const actor = base.actors[0]!;
    const basePoly = actorPolygon(actor, base, 'camera', { widthPx: 1200, heightPx: 600 });
    const squeezeProject = { ...fixtureProject, camera: { ...fixtureProject.camera, squeeze: 2 } };
    const squeezedFrame = deriveFrame(squeezeProject, 0, 'camera');
    const squeezedPoly = actorPolygon(squeezedFrame.actors[0]!, squeezedFrame, 'camera', { widthPx: 1200, heightPx: 600 });
    const baseWidth = Math.max(...basePoly.map(p => p.x)) - Math.min(...basePoly.map(p => p.x));
    const squeezedWidth = Math.max(...squeezedPoly.map(p => p.x)) - Math.min(...squeezedPoly.map(p => p.x));
    expect(squeezedWidth).toBeGreaterThan(baseWidth);
    const longLens = deriveFrame({ ...fixtureProject, camera: { ...fixtureProject.camera, focalLengthMm: 85 } }, 0, 'camera');
    const longLensPoly = actorPolygon(longLens.actors[0]!, longLens, 'camera', { widthPx: 1200, heightPx: 600 });
    expect(Math.max(...longLensPoly.map(p => p.x)) - Math.min(...longLensPoly.map(p => p.x))).toBeGreaterThan(baseWidth);
    const largeGate = deriveFrame({ ...fixtureProject, camera: { ...fixtureProject.camera, sensorGateMm: { x: 40, y: 24 } } }, 0, 'camera');
    expect(largeGate.metrics.fieldOfView.horizontalDeg).toBeGreaterThan(base.metrics.fieldOfView.horizontalDeg);
    const stoppedDown = deriveFrame({ ...fixtureProject, camera: { ...fixtureProject.camera, fNumber: 11 } }, 0, 'camera');
    expect(stoppedDown.metrics.depthOfField!.farLimitM - stoppedDown.metrics.depthOfField!.nearLimitM).toBeGreaterThan(base.metrics.depthOfField!.farLimitM - base.metrics.depthOfField!.nearLimitM);
  });

  it('A04/A05: every view derives the same evaluated camera pose and output gate', () => {
    const project = { ...fixtureProject, camera: { ...fixtureProject.camera, motion: { kind: 'orbit' as const, durationS: 4, orbitTargetM: { x: 0, y: 1.5, z: 0 }, orbitDegrees: 60 } } };
    const frames = (['camera', 'topdown', 'stage3d', 'side'] as const).map(view => deriveFrame(project, 2, view));
    for (const frame of frames) {
      expect(frame.camera.positionM).toEqual(frames[0]!.camera.positionM);
      expect(frame.camera.yawDeg).toBe(frames[0]!.camera.yawDeg);
      expect(frame.gate).toEqual(frames[0]!.gate);
    }
  });

  it('scheduler coalesces static invalidations, pauses hidden frames and ticks only while animated', () => {
    let nextId = 0; let hidden = false; let renders = 0; let onVisibility: () => void = () => undefined;
    const pending = new Map<number, FrameRequestCallback>();
    const scheduler = createRenderScheduler(() => renders++, {
      requestFrame(callback) { const id = ++nextId; pending.set(id, callback); return id; },
      cancelFrame(id) { pending.delete(id); },
      isHidden: () => hidden,
      subscribeVisibility(listener) { onVisibility = listener; return () => { onVisibility = () => undefined; }; },
    });
    for (let i = 0; i < 100; i++) scheduler.invalidate();
    expect(pending.size).toBe(1);
    flush(pending); expect(renders).toBe(1);
    hidden = true; scheduler.invalidate(); scheduler.setAnimating(true); expect(pending.size).toBe(0);
    hidden = false; onVisibility(); expect(pending.size).toBe(1); flush(pending); expect(renders).toBe(2); expect(pending.size).toBe(1);
    scheduler.setAnimating(false); flush(pending); expect(renders).toBe(3); expect(pending.size).toBe(0);
    scheduler.dispose();
  });
});

function centroid(points: { x: number; y: number }[]): { x: number; y: number } {
  return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
}

function fakeCanvas(width: number, height: number) {
  const listeners = new Map<string, EventListener>(); const captured = new Set<number>();
  const canvas = {
    style: { touchAction: '' },
    addEventListener(type: string, listener: EventListener) { listeners.set(type, listener); },
    removeEventListener(type: string) { listeners.delete(type); },
    getBoundingClientRect() { return { left: 100, top: 50, width, height, right: 100 + width, bottom: 50 + height, x: 100, y: 50, toJSON() {} }; },
    setPointerCapture(id: number) { captured.add(id); }, hasPointerCapture(id: number) { return captured.has(id); }, releasePointerCapture(id: number) { captured.delete(id); },
  } as unknown as HTMLCanvasElement;
  return {
    canvas,
    fire(type: string, values: Record<string, unknown>) { const listener = listeners.get(type); if (listener) listener(Object.assign(new Event(type), values)); },
    listenerCount: () => listeners.size,
  };
}

function fakeDocument() {
  const contexts: FakeContext[] = []; const canvases: FakeCanvas[] = []; const noise: Uint8ClampedArray[] = [];
  const document = {
    createElement() {
      const canvas: FakeCanvas = { width: 0, height: 0, ownerDocument: document as unknown as Document, toBlob(callback: BlobCallback, type?: string) { callback(new Blob(['frame'], { type: type ?? 'image/png' })); } };
      canvas.getContext = () => { const context = new FakeContext(canvas, noise); contexts.push(context); return context as unknown as CanvasRenderingContext2D; };
      canvases.push(canvas); return canvas;
    },
  };
  return { document, contexts, canvases, noise };
}

interface FakeCanvas { width: number; height: number; ownerDocument: Document; getContext?: () => CanvasRenderingContext2D | null; toBlob: (callback: BlobCallback, type?: string) => void }
class FakeContext {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000'; strokeStyle: string | CanvasGradient | CanvasPattern = '#000'; font = ''; lineWidth = 1; globalAlpha = 1; globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  readonly text: string[] = []; readonly fillStyles: string[] = []; readonly composites: string[] = []; dashCalls = 0; strokeRectCalls = 0;
  constructor(readonly canvas: FakeCanvas, private readonly noise: Uint8ClampedArray[]) {}
  getTransform() { return { a: 1 }; }
  clearRect() {}
  fillRect() { this.fillStyles.push(String(this.fillStyle)); this.composites.push(this.globalCompositeOperation); }
  strokeRect() { this.strokeRectCalls++; }
  setLineDash() { this.dashCalls++; }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  fill() {}
  closePath() {}
  save() {}
  restore() {}
  rect() {}
  clip() {}
  arc() {}
  fillText(text: string) { this.text.push(text); }
  createImageData(width: number, height: number) { return { data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' as PredefinedColorSpace }; }
  putImageData(data: ImageData) { this.noise.push(new Uint8ClampedArray(data.data)); }
  createPattern() { return {} as CanvasPattern; }
}

function flush(pending: Map<number, FrameRequestCallback>): void { const callbacks = [...pending.values()]; pending.clear(); for (const callback of callbacks) callback(0); }
