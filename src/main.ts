import type { AppAction, AppState, CameraDocument, EntityId, ProjectDocument } from './contracts';
import { createInitialState, createDefaultProject, entityId } from './data/defaults';
import { deriveFrame } from './render/frame';
import { canvasRenderer } from './render/canvas-renderer';
import type { ThreeViewport } from './render/three-viewport';
import { createRenderScheduler } from './render/scheduler';
import { bindGestures } from './interaction/gestures';
import { createStore } from './state/store';
import { mountWorkspace } from './ui/workspace';
import { projectRepository } from './project/repository';
import { createProjectSaveQueue } from './project/save-queue';
import { captureShot, restoreShot, validateThumbnailBlob } from './shotlist/catalog';
import './styles/main.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('No existe el nodo #app');

// A stable local ID permits IndexedDB recovery between browser sessions without a server/account.
const localProjectId = entityId('cineoptics-local-project-v1');
const project = { ...createDefaultProject(), id: localProjectId };
const store = createStore(createInitialState(project));
let feedback = 'Cargando proyecto local…';
let observedProject = store.getState().project;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastAnimationTimestamp: number | null = null;
const queueProjectSave = createProjectSaveQueue(projectRepository);
let viewport3d: ThreeViewport | null = null;
let viewport3dLoading = true;
let appDisposed = false;

function setPersistence(status: AppState['runtime']['persistenceStatus'], message: string): void {
  feedback = message;
  store.dispatch({ type: 'runtime/persistenceChanged', status });
}

function frameFor(state: AppState) {
  return deriveFrame(state.project, state.runtime.timeSeconds, state.ui.activeView);
}

function paint(state: AppState): void {
  const canvas = root!.querySelector<HTMLCanvasElement>('#co-canvas');
  const webglCanvas = root!.querySelector<HTMLCanvasElement>('#co-webgl-canvas');
  const notice = root!.querySelector<HTMLElement>('#co-renderer-notice');
  if (!canvas || !webglCanvas) return;
  const frame = frameFor(state);
  const useWebgl = viewport3d !== null && (frame.activeView === 'camera' || frame.activeView === 'stage3d');
  canvas.hidden = useWebgl; webglCanvas.hidden = !useWebgl;
  if (notice) {
    notice.hidden = useWebgl || viewport3d !== null || viewport3dLoading;
    if (!viewport3d && !viewport3dLoading) notice.textContent = 'WebGL 2 no disponible · mostrando vista técnica 2D.';
  }
  if (useWebgl) {
    try { viewport3d!.renderView(frame, { guides: state.ui.showGuides, selectedActorId: state.ui.selectedActorId }, state.runtime.viewportCssPx.dpr); }
    catch (error) { if (notice) { notice.hidden = false; notice.textContent = `Renderer 3D suspendido: ${error instanceof Error ? error.message : 'error gráfico'}. Vista técnica disponible.`; } canvas.hidden = false; webglCanvas.hidden = true; }
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr)); const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasRenderer.renderView(context, frame, { guides: state.ui.showGuides });
  const readout = root!.querySelector<HTMLElement>('#co-frame-metrics');
  if (readout) {
    const dof = frame.metrics.depthOfField;
    readout.textContent = `${frame.metrics.fieldOfView.horizontalDeg.toFixed(1)}° × ${frame.metrics.fieldOfView.verticalDeg.toFixed(1)}° · DoF ${dof ? `${dof.nearLimitM.toFixed(2)}–${dof.farIsInfinity ? '∞' : dof.farLimitM.toFixed(2)} m` : 'n/d'}`;
    readout.title = frame.warnings.join(' · ');
  }
}

async function writeSnapshot(projectSnapshot: ProjectDocument, assetsSnapshot: ReadonlyMap<EntityId, Blob>): Promise<void> {
  try {
    await queueProjectSave(projectSnapshot, assetsSnapshot);
    if (store.getState().project === projectSnapshot) setPersistence('saved', 'Guardado');
  } catch (error) {
    if (store.getState().project === projectSnapshot) setPersistence('error', error instanceof Error ? `Error al guardar: ${error.message}` : 'Error al guardar el proyecto local.');
    throw error;
  }
}

async function saveCurrent(state = store.getState()): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; }
  setPersistence('saving', 'Guardando…');
  await writeSnapshot(state.project, state.runtime.assets);
}

function persistWhenProjectChanges(state: AppState): void {
  if (state.project === observedProject) return;
  observedProject = state.project;
  if (saveTimer) clearTimeout(saveTimer);
  setPersistence('saving', 'Guardando…');
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    const latest = store.getState();
    void writeSnapshot(latest.project, latest.runtime.assets).catch(() => undefined);
  }, 350);
}
function renderScheduledFrame(timestampMs: number): void {
  let state = store.getState();
  if (state.runtime.isPlaying) {
    const duration = state.project.camera.motion.durationS;
    if (lastAnimationTimestamp === null) lastAnimationTimestamp = timestampMs;
    else {
      const elapsedS = Math.max(0, Math.min(0.1, (timestampMs - lastAnimationTimestamp) / 1000));
      lastAnimationTimestamp = timestampMs;
      const nextTime = Math.min(duration, state.runtime.timeSeconds + elapsedS);
      store.dispatch({ type: 'runtime/tick', timeSeconds: nextTime });
      if (nextTime >= duration) store.dispatch({ type: 'runtime/playbackChanged', isPlaying: false });
    }
    state = store.getState();
  } else lastAnimationTimestamp = null;
  paint(state);
}

const scheduler = createRenderScheduler(renderScheduledFrame);
store.subscribe(() => {
  const current = store.getState();
  scheduler.invalidate();
  scheduler.setAnimating(current.runtime.isPlaying);
  // Nested status dispatches can make a subscriber's argument stale; use the latest state.
  persistWhenProjectChanges(current);
});

async function capture(state: AppState): Promise<void> {
  try {
    const frame = deriveFrame(state.project, state.runtime.timeSeconds, 'camera');
    const aspect = frame.gate.outputAspect;
    const widthPx = Math.min(1280, Math.floor(720 * aspect));
    const heightPx = Math.min(720, Math.round(widthPx / aspect));
    const thumbnail = viewport3d
      ? await viewport3d.captureFrame(frame, widthPx, heightPx)
      : await canvasRenderer.captureFrame(frame, { widthPx, heightPx, includeGuides: false });
    await validateThumbnailBlob(thumbnail);
    const camera: CameraDocument = {
      ...state.project.camera,
      positionM: { ...frame.camera.positionM }, yawDeg: frame.camera.yawDeg, pitchDeg: frame.camera.pitchDeg,
      rollDeg: frame.camera.rollDeg, focalLengthMm: frame.camera.focalLengthMm,
      focus: state.project.camera.focus.kind === 'actor' ? state.project.camera.focus : { kind: 'manual', distanceM: frame.camera.focusDistanceM },
      motion: { kind: 'static', durationS: 0 },
    };
    const captured = captureShot(state.project, { camera, capturedAtS: frame.timeSeconds, thumbnail });
    const assets = new Map(state.runtime.assets);
    if (captured.thumbnail) assets.set(captured.thumbnail.id, captured.thumbnail.blob);
    store.dispatch({ type: 'project/replaced', project: captured.project, assets, selectedShotId: captured.shot.id });
  } catch (error) {
    setPersistence('error', error instanceof Error ? `No se pudo capturar: ${error.message}` : 'No se pudo capturar el plano.');
  }
}

function loadSnapshot(shotId: EntityId): void {
  try {
    const restored = restoreShot(store.getState().project, shotId);
    store.dispatch({ type: 'project/snapshotRestored', project: restored, shotId });
  } catch (error) {
    setPersistence('error', error instanceof Error ? error.message : 'No se pudo cargar el snapshot.');
  }
}

mountWorkspace(root, store, {
  render: () => scheduler.invalidate(),
  capture,
  restoreShot: loadSnapshot,
  saveProject: state => saveCurrent(state),
  persistenceStatus: () => feedback,
});
const canvas = root.querySelector<HTMLCanvasElement>('#co-canvas');
const webglCanvas = root.querySelector<HTMLCanvasElement>('#co-webgl-canvas');
const rendererNotice = root.querySelector<HTMLElement>('#co-renderer-notice');
if (webglCanvas) {
  void import('./render/three-viewport').then(({ createThreeViewport }) => {
    if (appDisposed) return;
    viewport3d = createThreeViewport(webglCanvas);
    viewport3dLoading = false;
    scheduler.invalidate();
  }).catch(error => {
    viewport3dLoading = false;
    if (rendererNotice) { rendererNotice.hidden = false; rendererNotice.textContent = `WebGL 2 no disponible · vista técnica 2D activa${error instanceof Error ? ` (${error.message})` : ''}.`; }
    scheduler.invalidate();
  });
}
const readFrame = () => frameFor(store.getState());
const dispatchInteraction = (action: AppAction) => store.dispatch(action);
const unbind2dGestures = canvas ? bindGestures(canvas, readFrame, dispatchInteraction) : () => undefined;
const unbind3dGestures = webglCanvas ? bindGestures(webglCanvas, readFrame, dispatchInteraction) : () => undefined;
const pick3dActor = (event: PointerEvent): void => {
  if (!webglCanvas || !viewport3d) return;
  const rect = webglCanvas.getBoundingClientRect(); const id = viewport3d.pickActor(event.clientX - rect.left, event.clientY - rect.top);
  store.dispatch({ type: 'ui/actorSelected', actorId: id });
};
const invalidate3d = () => scheduler.invalidate();
webglCanvas?.addEventListener('pointerdown', pick3dActor);
webglCanvas?.addEventListener('cineoptics:invalidate', invalidate3d);
const resizeObserver = new ResizeObserver(() => {
  const rect = root.querySelector<HTMLElement>('.co-canvas-region')?.getBoundingClientRect();
  if (rect) store.dispatch({ type: 'runtime/viewportResized', width: rect.width, height: rect.height, dpr: window.devicePixelRatio || 1 });
  scheduler.invalidate();
});
const canvasRegion = root.querySelector<HTMLElement>('.co-canvas-region');
if (canvasRegion) resizeObserver.observe(canvasRegion);
const onWindowResize = (): void => scheduler.invalidate();
window.addEventListener('resize', onWindowResize);
window.addEventListener('pagehide', () => {
  appDisposed = true;
  if (saveTimer) clearTimeout(saveTimer);
  resizeObserver.disconnect(); unbind2dGestures(); unbind3dGestures(); webglCanvas?.removeEventListener('pointerdown', pick3dActor); webglCanvas?.removeEventListener('cineoptics:invalidate', invalidate3d); viewport3d?.dispose(); scheduler.dispose(); window.removeEventListener('resize', onWindowResize);
}, { once: true });
scheduler.invalidate();

async function initializeProject(): Promise<void> {
  const untouchedDefault = store.getState().project;
  setPersistence('loading', 'Cargando proyecto local…');
  try {
    const loaded = await projectRepository.loadWithAssets(localProjectId);
    if (store.getState().project !== untouchedDefault) return;
    if (loaded) {
      observedProject = loaded.project;
      store.dispatch({ type: 'project/replaced', project: loaded.project, assets: loaded.assets });
      setPersistence('saved', loaded.recovered ? 'Proyecto recuperado' : 'Guardado');
    } else await saveCurrent(store.getState());
  } catch (error) {
    setPersistence('error', error instanceof Error ? `Almacenamiento local no disponible: ${error.message}` : 'Almacenamiento local no disponible.');
  }
}
void initializeProject();
