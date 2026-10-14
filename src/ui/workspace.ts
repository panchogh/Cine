import type { AppState, CameraMotion, EntityId, ProjectDocument, ProjectShot, ViewId } from '../contracts';
import type { Store, Unsubscribe } from '../state/store';
import { createActorAction } from '../state/reducer';
import { LIMITS } from '../data/constraints';
import { createDefaultProject } from '../data/defaults';
import { deriveEffectiveGate } from '../core/geometry';
import { deserializePortableProject, serializePortableProject } from '../project/portable';
import { createObjectUrlLease, exportShotCsv } from '../shotlist/csv';
import { deleteShot, duplicateShot, moveShot, renameShot, setShotNotes, validateThumbnailBlob } from '../shotlist/catalog';
import { deriveFrame } from '../render/frame';
import '../styles/workspace.css';

const VIEWS: { id: ViewId; label: string; description: string }[] = [
  { id: 'camera', label: 'Cámara', description: 'Encuadre de cámara' },
  { id: 'topdown', label: 'Planta', description: 'Vista superior X y Z' },
  { id: 'stage3d', label: 'Maqueta', description: 'Esquema del set' },
  { id: 'side', label: 'Elevación', description: 'Proyección lateral Z y Y' },
];
const PANELS = [
  { id: 'actors', label: 'Escena' }, { id: 'framing', label: 'Encuadre' },
  { id: 'optics', label: 'Cámara' }, { id: 'focus', label: 'Foco' },
  { id: 'shotlist', label: 'Planilla' },
] as const;

export function formatFocus(state: AppState): number {
  return deriveFrame(state.project, state.runtime.timeSeconds, state.ui.activeView).metrics.focus.axialDistanceM;
}

export function deriveWorkspaceModel(state: AppState) {
  const frame = deriveFrame(state.project, state.runtime.timeSeconds, state.ui.activeView);
  const focusM = frame.metrics.focus.axialDistanceM;
  const gate = deriveEffectiveGate({ sensorGateMm: state.project.camera.sensorGateMm, outputAspect: state.project.camera.outputAspect, squeeze: state.project.camera.squeeze });
  return {
    focalLengthMm: state.project.camera.focalLengthMm,
    focusDistanceM: focusM,
    focusMode: state.project.camera.focus.kind,
    focusTapeDistanceM: frame.metrics.focus.tapeDistanceM,
    showGuides: state.ui.showGuides,
    activeView: state.ui.activeView,
    activePanel: state.ui.activePanel,
    selectedActorId: state.ui.selectedActorId,
    actorCount: state.project.scene.actors.length,
    gateLabel: `${gate.widthMm.toFixed(2)} × ${gate.heightMm.toFixed(2)} mm · ${gate.outputAspect.toFixed(2)}:1`,
  };
}

export function prepareImportedProject(current: ProjectDocument, imported: ProjectDocument): ProjectDocument {
  return { ...imported, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
}

export function createNewProjectDocument(current: ProjectDocument, now = new Date().toISOString()): ProjectDocument {
  return { ...createDefaultProject(now), id: current.id, createdAt: now, updatedAt: now };
}

export function motionForKind(kind: CameraMotion['kind'], current: CameraMotion): CameraMotion {
  const durationS = kind === 'static' ? 0 : current.kind === 'static' ? 3 : current.durationS || 3;
  if (kind === 'static') return { kind, durationS };
  if (kind === 'push_in') return { kind, durationS, pushInDistanceM: 1 };
  if (kind === 'orbit') return { kind, durationS, orbitDegrees: 60 };
  return { kind, durationS, handheld: { translationM: 0.04, rotationDeg: 1.2, frequencyHz: 2 } };
}

export function resetCameraProject(project: ProjectDocument, selectedActorId: EntityId | null): ProjectDocument {
  const defaults = createDefaultProject(project.createdAt).camera;
  const actorId = project.scene.actors.some(actor => actor.id === selectedActorId) ? selectedActorId : project.scene.actors[0]?.id;
  return { ...project, camera: { ...defaults, focus: actorId ? { kind: 'actor', actorId } : defaults.focus }, updatedAt: new Date().toISOString() };
}

export function isRestorableShot(shot: ProjectShot): boolean { return shot.snapshotVersion === 1; }

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as HTMLElement;
  return Boolean(element.isContentEditable) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function labeledInput(labelText: string, id: string, min: number, max: number, step: number): { wrap: HTMLElement; label: HTMLLabelElement; range: HTMLInputElement; number: HTMLInputElement } {
  const wrap = element('div', 'co-control');
  const label = element('label', 'co-control-label', labelText); label.htmlFor = `${id}-number`;
  const row = element('div', 'co-precision-control');
  const range = element('input', 'co-control-range'); range.type = 'range'; range.id = `${id}-range`; range.min = String(min); range.max = String(max); range.step = String(step); range.setAttribute('aria-label', `${labelText} deslizante`);
  const number = element('input', 'co-control-number'); number.type = 'number'; number.id = `${id}-number`; number.min = String(min); number.max = String(max); number.step = String(step); number.setAttribute('inputmode', 'decimal');
  row.append(range, number); wrap.append(label, row);
  return { wrap, label, range, number };
}

export interface WorkspaceOptions {
  /** Called after store changes so the application can render its existing FrameModel. */
  render?: (state: AppState) => void;
  /** Capture adapter connected to the current state and evaluated camera frame. */
  capture?: (state: AppState) => void | Promise<void>;
  restoreShot?: (shotId: EntityId) => void | Promise<void>;
  saveProject?: (state: AppState) => Promise<void>;
  persistenceStatus?: (state: AppState) => string;
}

/** Build a state-driven UI shell without taking ownership of app composition or rendering. */
export function mountWorkspace(root: HTMLElement, store: Store, options: WorkspaceOptions = {}): Unsubscribe {
  const downloadLease = createObjectUrlLease();
  let transientFeedback: string | null = null;
  let durableFeedback: { message: string; project: ProjectDocument } | null = null;
  let selectedShotId = store.getState().ui.selectedShotId;
  let lastStoredShotSelection = store.getState().ui.selectedShotId;
  let editingShotInlineId: EntityId | null = null;
  let downloadTimer: ReturnType<typeof setTimeout> | undefined;
  const shell = element('div', 'co-workspace');
  const header = element('header', 'co-header');
  const identity = element('div', 'co-identity'); const projectName = element('span', 'co-project');
  identity.append(element('span', 'co-mark', 'CO'), element('h1', '', 'CineOptics'), projectName);
  const headerActions = element('div', 'co-header-actions');
  const saveStatus = element('span', 'co-save-status', 'Cargando…'); saveStatus.id = 'co-save-status'; saveStatus.setAttribute('role', 'status'); saveStatus.setAttribute('aria-live', 'polite');
  const save = element('button', 'co-save', 'Guardar'); save.type = 'button'; save.dataset.action = 'save';
  const projectMenu = element('details', 'co-project-menu');
  const projectMenuSummary = element('summary', '', 'Proyecto'); projectMenuSummary.setAttribute('aria-label', 'Abrir menú de proyecto');
  const projectMenuContent = element('div', 'co-project-menu-content');
  const newProject = element('button', '', 'Nuevo proyecto'); newProject.type = 'button'; newProject.dataset.action = 'new-project';
  const openProject = element('button', '', 'Abrir proyecto…'); openProject.type = 'button'; openProject.dataset.action = 'open';
  const exportProject = element('button', '', 'Exportar proyecto…'); exportProject.type = 'button'; exportProject.dataset.action = 'export-project';
  const exportCsv = element('button', '', 'Exportar planilla CSV'); exportCsv.type = 'button'; exportCsv.dataset.action = 'export-csv';
  const fileInput = element('input'); fileInput.type = 'file'; fileInput.accept = '.json,.cineoptics,application/json'; fileInput.hidden = true; fileInput.setAttribute('aria-label', 'Seleccionar proyecto CineOptics');
  projectMenuContent.append(newProject, openProject, exportProject, exportCsv); projectMenu.append(projectMenuSummary, projectMenuContent);
  const capture = element('button', 'co-primary', 'Capturar'); capture.type = 'button'; capture.setAttribute('aria-label', 'Capturar frame de cámara'); capture.disabled = !options.capture;
  headerActions.append(saveStatus, save, projectMenu, capture, fileInput); header.append(identity, headerActions);

  const workspace = element('main', 'co-main');
  const toolBar = element('div', 'co-tool-bar');
  const toolMode = element('span', 'co-tool-mode', 'Herramienta · Selección');
  const moveHint = element('button', 'co-tool-action', 'Mover en Planta'); moveHint.type = 'button'; moveHint.dataset.view = 'topdown'; moveHint.title = 'Cambiar a Planta para seleccionar y arrastrar actores';
  const worldHint = element('span', 'co-tool-context', 'Espacio · Mundo');
  toolBar.append(toolMode, moveHint, worldHint);
  const navigation = element('nav', 'co-nav'); navigation.setAttribute('aria-label', 'Paneles');
  const panelButtons = new Map<string, HTMLButtonElement>();
  for (const panel of PANELS) {
    const button = element('button', 'co-nav-button', panel.label); button.type = 'button'; button.dataset.panel = panel.id; button.setAttribute('aria-pressed', 'false');
    navigation.append(button); panelButtons.set(panel.id, button);
  }
  const inspector = element('aside', 'co-inspector'); inspector.id = 'co-inspector'; inspector.setAttribute('aria-label', 'Panel contextual');
  const panelTitle = element('h2', 'co-panel-title'); const panelHint = element('p', 'co-panel-hint');
  const sceneGroup = element('section', 'co-panel-group'); sceneGroup.setAttribute('aria-label', 'Actores');
  const sceneHead = element('div', 'co-group-head'); sceneHead.append(element('h3', '', 'Actores'));
  const actorCount = element('span', 'co-count'); sceneHead.append(actorCount);
  const addActor = element('button', 'co-secondary', 'Añadir actor'); addActor.type = 'button'; sceneHead.append(addActor);
  const actorList = element('div', 'co-actor-list');
  const actorPosition = element('fieldset', 'co-position-editor'); actorPosition.append(element('legend', '', 'Posición del actor seleccionado · m'));
  const positionInputs = new Map<'x' | 'y' | 'z', HTMLInputElement>();
  for (const axis of ['x', 'y', 'z'] as const) {
    const label = element('label', 'co-position-field', `${axis.toUpperCase()} (m)`);
    const input = element('input', 'co-control-number'); input.type = 'number'; input.step = '0.01'; input.min = String(LIMITS.sceneCoordinateM.min); input.max = String(LIMITS.sceneCoordinateM.max); input.dataset.positionAxis = axis;
    label.append(input); actorPosition.append(label); positionInputs.set(axis, input);
  }
  sceneGroup.append(sceneHead, actorList, actorPosition);

  const cameraGroup = element('section', 'co-panel-group'); cameraGroup.setAttribute('aria-label', 'Cámara y foco');
  const focal = labeledInput('Distancia focal (mm)', 'focal', LIMITS.focalLengthMm.min, LIMITS.focalLengthMm.max, 1);
  const focus = labeledInput('Distancia axial de foco (m)', 'focus', LIMITS.focusDistanceM.min, LIMITS.focusDistanceM.max, 0.05);
  const focusTape = element('p', 'co-focus-tape');
  cameraGroup.append(element('h3', '', 'Encuadre'), focal.wrap, focus.wrap, focusTape);
  const gateReadout = element('p', 'co-gate'); gateReadout.setAttribute('aria-label', 'Gate activo'); cameraGroup.append(gateReadout);
  const advanced = element('p', 'co-hint'); cameraGroup.append(advanced);
  const motionLabel = element('label', 'co-motion-control', 'Movimiento de cámara');
  const motionSelect = element('select', 'co-control-number'); motionSelect.dataset.motionKind = 'true';
  for (const [value, label] of [['static', 'Estática'], ['push_in', 'Push-in'], ['orbit', 'Órbita'], ['handheld', 'Handheld aproximado']]) {
    const option = element('option', '', label); option.value = value; motionSelect.append(option);
  }
  motionLabel.append(motionSelect);
  const durationLabel = element('label', 'co-motion-control', 'Duración (s)');
  const durationInput = element('input', 'co-control-number'); durationInput.type = 'number'; durationInput.min = '0'; durationInput.max = '120'; durationInput.step = '0.1'; durationInput.dataset.motionDuration = 'true'; durationLabel.append(durationInput);
  cameraGroup.append(motionLabel, durationLabel);
  const resetCamera = element('button', 'co-secondary co-reset-camera', 'Restablecer cámara'); resetCamera.type = 'button'; resetCamera.dataset.action = 'reset-camera'; cameraGroup.append(resetCamera);

  const emptyPanel = element('section', 'co-shotlist'); emptyPanel.setAttribute('aria-label', 'Planilla de planos');
  inspector.append(panelTitle, panelHint, sceneGroup, cameraGroup);

  const stage = element('section', 'co-stage'); stage.setAttribute('aria-label', 'Visor');
  const stageHeader = element('div', 'co-stage-header');
  const viewTabs = element('div', 'co-view-tabs'); viewTabs.setAttribute('role', 'tablist'); viewTabs.setAttribute('aria-label', 'Vistas');
  const viewButtons = new Map<ViewId, HTMLButtonElement>();
  for (const view of VIEWS) {
    const button = element('button', 'co-view-tab', view.label); button.type = 'button'; button.id = `co-tab-${view.id}`; button.dataset.view = view.id; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'co-canvas'); button.setAttribute('aria-selected', 'false'); button.title = view.description;
    viewTabs.append(button); viewButtons.set(view.id, button);
  }
  const panelToggle = element('button', 'co-panel-toggle', 'Panel'); panelToggle.type = 'button'; panelToggle.setAttribute('aria-controls', 'co-inspector'); panelToggle.setAttribute('aria-expanded', 'true');
  stageHeader.append(viewTabs, panelToggle);
  const canvasRegion = element('div', 'co-canvas-region');
  const canvas = element('canvas', 'co-canvas'); canvas.id = 'co-canvas'; canvas.tabIndex = 0; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Visor de la escena. Usa las vistas Cámara, Planta, Maqueta y Elevación; la escena se describe en el panel.');
  const webglCanvas = element('canvas', 'co-webgl-canvas'); webglCanvas.id = 'co-webgl-canvas'; webglCanvas.setAttribute('aria-hidden', 'true'); webglCanvas.hidden = true;
  const rendererNotice = element('div', 'co-renderer-notice'); rendererNotice.id = 'co-renderer-notice'; rendererNotice.setAttribute('role', 'status'); rendererNotice.hidden = true;
  const guideToggle = element('button', 'co-guide-toggle', 'Guías'); guideToggle.type = 'button'; guideToggle.setAttribute('aria-pressed', 'false');
  canvasRegion.append(canvas, webglCanvas, rendererNotice, guideToggle);
  const stageFoot = element('footer', 'co-stage-foot'); const metricLabel = element('span', '', 'FOV · DoF estimada'); metricLabel.id = 'co-frame-metrics';
  const transport = element('div', 'co-transport');
  const play = element('button', 'co-play', 'Reproducir'); play.type = 'button'; play.dataset.action = 'play';
  const time = element('input', 'co-time'); time.type = 'range'; time.min = '0'; time.max = '0'; time.step = '0.01'; time.value = '0'; time.setAttribute('aria-label', 'Tiempo de cámara (segundos)');
  const timeReadout = element('output', 'co-time-readout', '0.00 s');
  transport.append(play, time, timeReadout); stageFoot.append(element('span', '', 'Escena en metros'), metricLabel, transport);
  const library = element('section', 'co-library'); library.setAttribute('aria-label', 'Biblioteca y planilla');
  const libraryHead = element('div', 'co-library-head');
  const libraryTitle = element('strong', '', 'Biblioteca');
  const libraryTabs = element('div', 'co-library-tabs'); libraryTabs.setAttribute('role', 'tablist'); libraryTabs.setAttribute('aria-label', 'Biblioteca');
  let activeShelf: 'shotlist' | 'locations' | 'characters' = 'shotlist';
  for (const [id, label] of [['shotlist', 'Planilla'], ['locations', 'Escenarios'], ['characters', 'Personajes']] as const) {
    const button = element('button', 'co-library-tab', label); button.type = 'button'; button.dataset.shelf = id; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(id === activeShelf)); libraryTabs.append(button);
  }
  libraryHead.append(libraryTitle, libraryTabs);
  const libraryBody = element('div', 'co-library-body'); libraryBody.append(emptyPanel);
  library.append(libraryHead, libraryBody);
  stage.append(stageHeader, canvasRegion, stageFoot, library); workspace.append(navigation, stage, inspector); shell.append(header, toolBar, workspace);
  root.replaceChildren(shell);

  const thumbnailUrls = new Map<EntityId, { blob: Blob; url: string }>();
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const announce = (message: string, kind: 'success' | 'error' | 'info' = 'info', durable = false): void => {
    if (durable && kind === 'success') durableFeedback = { message, project: store.getState().project };
    transientFeedback = durable ? null : message; saveStatus.textContent = message; saveStatus.dataset.kind = kind;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    if (!durable) feedbackTimer = setTimeout(() => { transientFeedback = null; renderRuntimeControls(store.getState()); }, kind === 'error' ? 6500 : 2800);
  };
  const safeName = (name: string, fallback: string): string => name.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback;
  const download = (blob: Blob, filename: string): void => {
    if (downloadTimer) clearTimeout(downloadTimer);
    const url = downloadLease.replace(blob); const link = element('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    downloadTimer = window.setTimeout(() => downloadLease.dispose(), 1000);
  };
  const replaceProject = (project: ProjectDocument, assets = store.getState().runtime.assets, shotId: EntityId | null = selectedShotId): void => {
    selectedShotId = shotId;
    store.dispatch({ type: 'project/replaced', project, assets: new Map(assets), selectedShotId: shotId });
  };
  const saveNow = async (): Promise<void> => {
    announce('Guardando…');
    try {
      if (!options.saveProject) throw new Error('El guardado del proyecto no está conectado.');
      await options.saveProject(store.getState());
      announce('Guardado', 'success', true);
    } catch (error) { announce(error instanceof Error ? `Error al guardar: ${error.message}` : 'Error al guardar el proyecto.', 'error'); }
  };
  const openProjectFile = async (file: File): Promise<void> => {
    announce('Validando proyecto…');
    try {
      const imported = await deserializePortableProject(file);
      await Promise.all([...imported.assets.values()].map(blob => validateThumbnailBlob(blob)));
      const candidate = prepareImportedProject(store.getState().project, imported.project);
      replaceProject(candidate, imported.assets, null);
      projectMenuSummary.focus(); announce('Proyecto abierto');
    } catch (error) { announce(error instanceof Error ? `No se abrió el proyecto: ${error.message}` : 'No se abrió el proyecto.', 'error'); }
    finally { fileInput.value = ''; }
  };
  const exportProjectFile = async (): Promise<void> => {
    try {
      const state = store.getState();
      const blob = await serializePortableProject(state.project, state.runtime.assets);
      download(blob, `${safeName(state.project.name, 'cineoptics-proyecto')}.cineoptics.json`);
      announce('Proyecto exportado', 'success');
    } catch (error) { announce(error instanceof Error ? `No se exportó: ${error.message}` : 'No se exportó el proyecto.', 'error'); }
  };
  const exportCsvFile = (): void => {
    try { const state = store.getState(); download(exportShotCsv(state.project), `${safeName(state.project.name, 'cineoptics-proyecto')}-planos.csv`); announce('CSV exportado', 'success'); }
    catch (error) { announce(error instanceof Error ? `No se exportó el CSV: ${error.message}` : 'No se exportó el CSV.', 'error'); }
  };
  const restoreCamera = (): void => {
    const state = store.getState();
    replaceProject(resetCameraProject(state.project, state.ui.selectedActorId));
    announce('Cámara restablecida · escena y planos conservados');
  };
  const startNewProject = (): void => {
    const state = store.getState();
    if (state.runtime.persistenceStatus !== 'saved' && !window.confirm('Hay cambios que aún no tienen confirmación de guardado. ¿Crear un proyecto nuevo?')) return;
    const next = createNewProjectDocument(state.project);
    replaceProject(next, new Map(), null);
    store.dispatch({ type: 'runtime/tick', timeSeconds: 0 });
    store.dispatch({ type: 'runtime/playbackChanged', isPlaying: false });
    projectMenu.open = false;
    announce('Proyecto nuevo creado; guardando…');
  };
  const editShot = (shotId: EntityId, edit: (project: ProjectDocument) => ProjectDocument): void => {
    if (!store.getState().project.shots.some(shot => shot.id === shotId)) return;
    try { replaceProject(edit(store.getState().project)); }
    catch (error) { announce(error instanceof Error ? `No se pudo editar el plano: ${error.message}` : 'No se pudo editar el plano.', 'error'); }
  };
  const refreshShotCardText = (shotId: EntityId): void => {
    const shot = store.getState().project.shots.find(item => item.id === shotId);
    const card = emptyPanel.querySelector<HTMLElement>(`[data-shot-id="${CSS.escape(shotId)}"]`);
    if (!shot || !card) return;
    const select = card.querySelector<HTMLButtonElement>('[data-select-shot]');
    if (select) select.textContent = shot.name;
    const load = card.querySelector<HTMLButtonElement>('[data-restore-shot]');
    if (load) load.setAttribute('aria-label', `Cargar plano ${shot.name}`);
    const up = card.querySelector<HTMLButtonElement>('[data-shot-action="up"]');
    if (up) up.setAttribute('aria-label', `Subir ${shot.name}`);
    const down = card.querySelector<HTMLButtonElement>('[data-shot-action="down"]');
    if (down) down.setAttribute('aria-label', `Bajar ${shot.name}`);
    const thumbnail = card.querySelector<HTMLImageElement>('.co-shot-thumbnail');
    if (thumbnail) thumbnail.alt = `Miniatura de ${shot.name}`;
  };
  const renderShotlist = (state: AppState): void => {
    emptyPanel.replaceChildren(element('h2', '', 'Planos'));
    if (!state.project.shots.length) {
      const empty = element('div', 'co-shot-empty'); empty.append(element('p', '', 'Todavía no hay planos guardados.'), element('p', '', 'Encuadra la cámara y pulsa Capturar para crear el primero.'));
      const captureEmpty = element('button', 'co-secondary', 'Capturar plano'); captureEmpty.type = 'button'; captureEmpty.dataset.action = 'capture'; captureEmpty.disabled = !options.capture;
      empty.append(captureEmpty); emptyPanel.append(empty); return;
    }
    const liveThumbnailIds = new Set<EntityId>();
    for (const shot of state.project.shots) {
      const row = element('article', `co-shot-card${shot.id === selectedShotId ? ' is-selected' : ''}`); row.dataset.shotId = shot.id;
      const top = element('div', 'co-shot-topline');
      const choose = element('button', 'co-shot-select', shot.name); choose.type = 'button'; choose.dataset.selectShot = shot.id; choose.setAttribute('aria-pressed', String(shot.id === selectedShotId));
      const snapshotScene = 'scene' in shot ? shot.scene : state.project.scene;
      const shotFocus = shot.camera.focus;
      let focusLabel: string;
      if (shotFocus.kind === 'manual') focusLabel = `MF ${shotFocus.distanceM.toFixed(2)} m`;
      else { const actorId = shotFocus.actorId; focusLabel = `AF · ${snapshotScene.actors.find(actor => actor.id === actorId)?.name ?? 'actor'}`; }
      const meta = element('small', 'co-shot-meta', `${shot.camera.focalLengthMm} mm · f/${shot.camera.fNumber} · ${focusLabel} · ${shot.capturedAtS.toFixed(2)} s`);
      const load = element('button', 'co-shot-load', 'Cargar'); load.type = 'button'; load.dataset.restoreShot = shot.id; load.disabled = !options.restoreShot || !isRestorableShot(shot); load.setAttribute('aria-label', `Cargar plano ${shot.name}`);
      if (!isRestorableShot(shot)) load.title = 'Este plano antiguo no incluye el estado de escena necesario para restaurarlo.';
      top.append(choose, meta, load); row.append(top);
      const editors = element('div', 'co-shot-editors');
      const nameLabel = element('label', '', 'Nombre'); const nameInput = element('input', 'co-shot-name'); nameInput.type = 'text'; nameInput.maxLength = 100; nameInput.value = shot.name; nameInput.dataset.shotName = shot.id; nameLabel.append(nameInput);
      const notesLabel = element('label', '', 'Notas'); const notes = element('textarea', 'co-shot-notes'); notes.rows = 2; notes.maxLength = 4000; notes.value = shot.notes; notes.dataset.shotNotes = shot.id; notesLabel.append(notes);
      editors.append(nameLabel, notesLabel); row.append(editors);
      if ('thumbnailId' in shot && shot.thumbnailId) {
        const blob = state.runtime.assets.get(shot.thumbnailId);
        if (blob) {
          liveThumbnailIds.add(shot.thumbnailId);
          let thumbnail = thumbnailUrls.get(shot.thumbnailId);
          if (!thumbnail || thumbnail.blob !== blob) {
            if (thumbnail) URL.revokeObjectURL(thumbnail.url);
            thumbnail = { blob, url: URL.createObjectURL(blob) }; thumbnailUrls.set(shot.thumbnailId, thumbnail);
          }
          const image = element('img', 'co-shot-thumbnail'); image.src = thumbnail.url; image.alt = `Miniatura de ${shot.name}`; row.append(image);
        }
      }
      const actions = element('div', 'co-shot-actions');
      const duplicate = element('button', '', 'Duplicar'); duplicate.type = 'button'; duplicate.dataset.shotAction = 'duplicate'; duplicate.dataset.shotId = shot.id;
      const up = element('button', '', 'Subir'); up.type = 'button'; up.dataset.shotAction = 'up'; up.dataset.shotId = shot.id; up.disabled = state.project.shots[0]?.id === shot.id; up.setAttribute('aria-label', `Subir ${shot.name}`);
      const down = element('button', '', 'Bajar'); down.type = 'button'; down.dataset.shotAction = 'down'; down.dataset.shotId = shot.id; down.disabled = state.project.shots.at(-1)?.id === shot.id; down.setAttribute('aria-label', `Bajar ${shot.name}`);
      const remove = element('button', '', 'Borrar'); remove.type = 'button'; remove.dataset.shotAction = 'delete'; remove.dataset.shotId = shot.id;
      actions.append(duplicate, up, down, remove); row.append(actions); emptyPanel.append(row);
    }
    for (const [id, thumbnail] of thumbnailUrls) if (!liveThumbnailIds.has(id)) { URL.revokeObjectURL(thumbnail.url); thumbnailUrls.delete(id); }
  };
  const focusShotControl = (shotId: EntityId | null, action: 'select' | 'duplicate' | 'up' | 'down' = 'select'): void => {
    queueMicrotask(() => {
      const controls = [...emptyPanel.querySelectorAll<HTMLButtonElement>('[data-select-shot], [data-shot-action]')];
      const control = controls.find(button => action === 'select' ? button.dataset.selectShot === shotId : button.dataset.shotId === shotId && button.dataset.shotAction === action);
      (control ?? panelButtons.get('shotlist'))?.focus();
    });
  };

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action) {
      projectMenu.open = false;
      if (action === 'save') void saveNow();
      else if (action === 'new-project') startNewProject();
      else if (action === 'open') fileInput.click();
      else if (action === 'export-project') void exportProjectFile();
      else if (action === 'export-csv') exportCsvFile();
      else if (action === 'reset-camera') restoreCamera();
      else if (action === 'play') {
        const state = store.getState(); const duration = state.project.camera.motion.durationS;
        if (duration <= 0 || state.project.camera.motion.kind === 'static') return;
        if (!state.runtime.isPlaying && state.runtime.timeSeconds >= duration) store.dispatch({ type: 'runtime/tick', timeSeconds: 0 });
        store.dispatch({ type: 'runtime/playbackChanged', isPlaying: !state.runtime.isPlaying });
      }
      else if (action === 'capture' && options.capture) void options.capture(store.getState());
      return;
    }
    const panel = target.closest<HTMLButtonElement>('[data-panel]')?.dataset.panel;
    if (panel && panelButtons.has(panel)) { if (panel === 'shotlist') activeShelf = 'shotlist'; else if (panel === 'locations') activeShelf = 'locations'; store.dispatch({ type: 'ui/panelChanged', panel: panel as AppState['ui']['activePanel'] }); return; }
    const view = target.closest<HTMLButtonElement>('[data-view]')?.dataset.view as ViewId | undefined;
    if (view) { store.dispatch({ type: 'ui/viewChanged', view }); return; }
    const shelf = target.closest<HTMLButtonElement>('[data-shelf]')?.dataset.shelf as typeof activeShelf | undefined;
    if (shelf) { activeShelf = shelf; renderLibrary(store.getState()); return; }
    const location = target.closest<HTMLButtonElement>('[data-location]')?.dataset.location;
    if (location) { store.dispatch({ type: 'scene/locationChanged', locationId: location }); return; }
    const pose = target.closest<HTMLButtonElement>('[data-pose]')?.dataset.pose as 'standing' | 'sitting' | 'walking' | undefined;
    if (pose) { const id = store.getState().ui.selectedActorId; if (id) store.dispatch({ type: 'scene/actorPoseChanged', actorId: id, pose }); return; }
    const actorId = target.closest<HTMLElement>('[data-actor]')?.dataset.actor;
    if (actorId) { store.dispatch({ type: 'ui/actorSelected', actorId: actorId as AppState['ui']['selectedActorId'] & string }); return; }
    const chooseShotId = target.closest<HTMLElement>('[data-select-shot]')?.dataset.selectShot;
    if (chooseShotId) {
      selectedShotId = chooseShotId as EntityId; renderShotlist(store.getState());
      focusShotControl(selectedShotId); return;
    }
    const shotControl = target.closest<HTMLElement>('[data-shot-action]');
    const shotAction = shotControl?.dataset.shotAction; const shotControlId = shotControl?.dataset.shotId as EntityId | undefined;
    if (shotAction && shotControlId) {
      if (shotAction === 'duplicate') {
        const before = store.getState().project; const next = duplicateShot(before, shotControlId);
        selectedShotId = next.shots.find(shot => !before.shots.some(old => old.id === shot.id))?.id ?? selectedShotId;
        replaceProject(next, store.getState().runtime.assets, selectedShotId);
        focusShotControl(selectedShotId, 'duplicate');
      } else if (shotAction === 'delete') {
        const before = store.getState().project; const index = before.shots.findIndex(shot => shot.id === shotControlId); const next = deleteShot(before, shotControlId);
        if (selectedShotId === shotControlId) selectedShotId = next.shots[Math.min(index, next.shots.length - 1)]?.id ?? null;
        replaceProject(next, store.getState().runtime.assets, selectedShotId);
        focusShotControl(selectedShotId);
      } else if (shotAction === 'up' || shotAction === 'down') {
        const index = store.getState().project.shots.findIndex(shot => shot.id === shotControlId);
        editShot(shotControlId, project => moveShot(project, shotControlId, index + (shotAction === 'up' ? -1 : 1)));
        focusShotControl(shotControlId, shotAction);
      }
      return;
    }
    const restoreId = target.closest<HTMLElement>('[data-restore-shot]')?.getAttribute('data-restore-shot');
    if (restoreId && options.restoreShot) {
      const shotId = restoreId as EntityId;
      void Promise.resolve(options.restoreShot(shotId)).then(() => { announce('Plano cargado'); focusShotControl(shotId); }).catch(error => announce(error instanceof Error ? `No se cargó el plano: ${error.message}` : 'No se cargó el plano.', 'error'));
      return;
    }
    if (target.closest('[data-remove-actor]')) {
      const actorId = target.closest<HTMLElement>('[data-remove-actor]')?.dataset.removeActor;
      if (actorId) store.dispatch({ type: 'scene/actorRemoved', actorId: actorId as AppState['ui']['selectedActorId'] & string }); return;
    }
    if (target.closest('.co-add-actor')) store.dispatch(createActorAction());
    if (target.closest('.co-panel-toggle')) {
      const hidden = inspector.hidden; inspector.hidden = !hidden; panelToggle.setAttribute('aria-expanded', String(hidden));
      if (hidden) panelButtons.get(store.getState().ui.activePanel)?.focus(); else panelToggle.focus();
    }
    if (target.closest('.co-guide-toggle')) store.dispatch({ type: 'ui/guidesToggled', enabled: !store.getState().ui.showGuides });
    if (target.closest('.co-capture') && options.capture) void options.capture(store.getState());
  };
  // The add button is part of the panel header and uses a stable class for delegation.
  addActor.classList.add('co-add-actor'); capture.classList.add('co-capture');
  shell.addEventListener('click', onClick);
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && isEditableTarget(event.target)) return;
    if (event.key === 'Escape' && projectMenu.open) { projectMenu.open = false; projectMenuSummary.focus(); }
    else if (event.key === 'Escape' && !inspector.hidden) { inspector.hidden = true; panelToggle.setAttribute('aria-expanded', 'false'); panelToggle.focus(); }
    if (event.target instanceof Element && viewTabs.contains(event.target) && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const current = store.getState().ui.activeView; const index = VIEWS.findIndex(item => item.id === current); const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = VIEWS[(index + delta + VIEWS.length) % VIEWS.length]; store.dispatch({ type: 'ui/viewChanged', view: next.id }); viewButtons.get(next.id)?.focus(); event.preventDefault();
    }
  };
  shell.addEventListener('keydown', onKeydown);
  const onGlobalShortcut = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); void saveNow(); }
    else if (event.key.toLowerCase() === 'o') { event.preventDefault(); fileInput.click(); }
  };
  shell.addEventListener('keydown', onGlobalShortcut);
  const onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    if (target.dataset.motionKind) {
      const kind = target.value as CameraMotion['kind'];
      const current = store.getState().project.camera.motion;
      const motion = motionForKind(kind, current);
      store.dispatch({ type: 'camera/motionChanged', motion }); return;
    }
    if (target.dataset.motionDuration) {
      const state = store.getState(); const value = target instanceof HTMLInputElement ? target.valueAsNumber : Number.NaN; const motion = state.project.camera.motion;
      if (!(target instanceof HTMLInputElement) || !Number.isFinite(value) || value < 0 || value > 120 || motion.kind === 'static') {
        renderControls(state); target.setAttribute('aria-invalid', 'true'); return;
      }
      store.dispatch({ type: 'camera/motionChanged', motion: { ...motion, durationS: value } }); return;
    }
    const axis = target.dataset.positionAxis as 'x' | 'y' | 'z' | undefined;
    if (axis) {
      const state = store.getState(); const actor = state.project.scene.actors.find(item => item.id === state.ui.selectedActorId); const value = target instanceof HTMLInputElement ? target.valueAsNumber : Number.NaN;
      if (!actor || !Number.isFinite(value) || value < LIMITS.sceneCoordinateM.min || value > LIMITS.sceneCoordinateM.max) {
        renderControls(state); target.setAttribute('aria-invalid', 'true'); return;
      }
      const positionM = { ...actor.positionM, [axis]: value };
      target.removeAttribute('aria-invalid');
      store.dispatch({ type: 'scene/actorMoved', actorId: actor.id, positionM }); return;
    }
    const nameId = target.dataset.shotName as EntityId | undefined; const notesId = target.dataset.shotNotes as EntityId | undefined;
    if (nameId) {
      editingShotInlineId = nameId;
      try { editShot(nameId, project => renameShot(project, nameId, target.value.trim() || 'Sin título')); }
      finally { editingShotInlineId = null; }
    } else if (notesId) {
      editingShotInlineId = notesId;
      try { editShot(notesId, project => setShotNotes(project, notesId, target.value)); }
      finally { editingShotInlineId = null; }
    }
  };
  shell.addEventListener('change', onChange);
  time.addEventListener('input', () => {
    const value = time.valueAsNumber;
    if (Number.isFinite(value)) store.dispatch({ type: 'runtime/tick', timeSeconds: value });
  });
  fileInput.addEventListener('change', () => { const file = fileInput.files?.[0]; if (file) void openProjectFile(file); });
  const bindControl = (input: HTMLInputElement, kind: 'focal' | 'focus', eventName: 'input' | 'change'): void => {
    const commit = (): void => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) { renderControls(store.getState()); input.setAttribute('aria-invalid', 'true'); return; }
      input.removeAttribute('aria-invalid');
      store.dispatch(kind === 'focal' ? { type: 'camera/focalChanged', focalLengthMm: value } : { type: 'camera/focusChanged', distanceM: value });
    };
    input.addEventListener(eventName, commit);
  };
  bindControl(focal.range, 'focal', 'input'); bindControl(focal.number, 'focal', 'change'); bindControl(focus.range, 'focus', 'input'); bindControl(focus.number, 'focus', 'change');
  const renderControls = (state: AppState): void => {
    const model = deriveWorkspaceModel(state);
    if (durableFeedback && durableFeedback.project !== state.project) durableFeedback = null;
    projectName.textContent = state.project.name;
    if (state.ui.selectedShotId !== lastStoredShotSelection) { selectedShotId = state.ui.selectedShotId; lastStoredShotSelection = state.ui.selectedShotId; }
    if (selectedShotId && !state.project.shots.some(shot => shot.id === selectedShotId)) selectedShotId = null;
    const focusM = model.focusDistanceM;
    focal.range.value = focal.number.value = String(model.focalLengthMm);
    focus.range.value = focus.number.value = String(focusM);
    motionSelect.value = state.project.camera.motion.kind;
    durationInput.value = String(state.project.camera.motion.durationS);
    durationInput.disabled = state.project.camera.motion.kind === 'static';
    focus.label.textContent = model.focusMode === 'actor' ? 'Distancia axial de foco (m)' : 'Distancia de foco (m)';
    focusTape.textContent = model.focusMode === 'actor' && model.focusTapeDistanceM !== null
      ? `Distancia de cinta al sujeto · ${model.focusTapeDistanceM.toFixed(2)} m`
      : model.focusMode === 'actor' ? 'Distancia de cinta no disponible' : 'Foco manual';
    const selectedActor = state.project.scene.actors.find(actor => actor.id === state.ui.selectedActorId);
    toolMode.textContent = state.ui.activeView === 'topdown' ? 'Herramienta · Selección y movimiento' : 'Herramienta · Selección';
    moveHint.setAttribute('aria-pressed', String(state.ui.activeView === 'topdown'));
    for (const [axis, input] of positionInputs) {
      input.value = selectedActor ? String(selectedActor.positionM[axis]) : '';
      input.disabled = !selectedActor;
      input.removeAttribute('aria-invalid');
    }
    gateReadout.textContent = `Gate activo · ${model.gateLabel}`;
    advanced.textContent = `DoF estimada · CoC ${state.project.camera.circleOfConfusionMm.toFixed(3)} mm. Aproximación óptica, no calibración comercial.`;
    guideToggle.setAttribute('aria-pressed', String(model.showGuides));
    focal.range.removeAttribute('aria-invalid'); focal.number.removeAttribute('aria-invalid'); focus.range.removeAttribute('aria-invalid'); focus.number.removeAttribute('aria-invalid');
    panelTitle.textContent = PANELS.find(item => item.id === model.activePanel)?.label ?? 'Escena';
    panelHint.textContent = model.activePanel === 'actors' ? 'Selecciona un actor para inspeccionarlo.' : model.activePanel === 'shotlist' ? 'Seleccionar un plano no lo carga; usa Cargar para restaurar su estado.' : 'Los controles muestran el estado actual del proyecto.';
    sceneGroup.hidden = false; cameraGroup.hidden = false;
    if (model.activePanel === 'shotlist') activeShelf = 'shotlist';
    else if (model.activePanel === 'locations') activeShelf = 'locations';
    actorCount.textContent = `${model.actorCount} / ${LIMITS.actors.max}`;
    addActor.disabled = model.actorCount >= LIMITS.actors.max;
    actorList.replaceChildren(...state.project.scene.actors.map(actor => {
      const row = element('div', 'co-actor-row');
      const select = element('button', 'co-actor-select'); select.type = 'button'; select.dataset.actor = actor.id; select.setAttribute('aria-pressed', String(actor.id === state.ui.selectedActorId));
      const color = element('span', 'co-actor-color'); color.style.backgroundColor = actor.color;
      const identity = element('span', 'co-actor-identity'); identity.append(element('strong', '', actor.name), element('small', '', `${actor.positionM.x.toFixed(2)} m X · ${actor.positionM.z.toFixed(2)} m Z`));
      select.append(color, identity); row.append(select);
      const remove = element('button', 'co-remove-actor', 'Quitar'); remove.type = 'button'; remove.dataset.removeActor = actor.id; remove.setAttribute('aria-label', `Quitar ${actor.name}`); remove.disabled = state.project.scene.actors.length <= LIMITS.actors.min; row.append(remove);
      return row;
    }));
    if (editingShotInlineId) refreshShotCardText(editingShotInlineId);
    else renderLibrary(state);
    for (const [id, button] of panelButtons) button.setAttribute('aria-pressed', String(id === model.activePanel));
    for (const [id, button] of viewButtons) button.setAttribute('aria-selected', String(id === model.activeView));
    const view = VIEWS.find(item => item.id === model.activeView); canvas.setAttribute('aria-label', `Visor de ${view?.description ?? 'escena'}. ${model.actorCount} actores. La escena se describe en el panel.`);
  };
  const renderLibrary = (state: AppState): void => {
    for (const tab of libraryTabs.querySelectorAll<HTMLButtonElement>('[data-shelf]')) tab.setAttribute('aria-selected', String(tab.dataset.shelf === activeShelf));
    emptyPanel.hidden = activeShelf !== 'shotlist';
    libraryBody.querySelector('.co-library-catalog')?.remove();
    if (activeShelf === 'shotlist') { renderShotlist(state); return; }
    const catalog = element('div', 'co-library-catalog');
    if (activeShelf === 'locations') {
      for (const item of [
        ['studio', 'Estudio', 'Ciclorama · suelo 12 × 12 m'],
        ['interior', 'Interior', 'Sala · volumen 8 × 6 × 3 m'],
        ['street', 'Calle', 'Fachadas · acera · fondo profundo'],
      ] as const) {
        const button = element('button', `co-asset-card${state.project.scene.locationId === item[0] ? ' is-active' : ''}`); button.type = 'button'; button.dataset.location = item[0]; button.setAttribute('aria-pressed', String(state.project.scene.locationId === item[0]));
        const swatch = element('span', `co-asset-preview co-preview-${item[0]}`); const label = element('span', 'co-asset-copy'); label.append(element('strong', '', item[1]), element('small', '', item[2])); button.append(swatch, label); catalog.append(button);
      }
    } else {
      const actor = state.project.scene.actors.find(item => item.id === state.ui.selectedActorId);
      const intro = element('span', 'co-library-context', actor ? `Apariencia y pose · ${actor.name}` : 'Selecciona un actor en el árbol de escena.'); catalog.append(intro);
      for (const [pose, label] of [['standing', 'De pie'], ['sitting', 'Sentado'], ['walking', 'Paso'] ] as const) {
        const button = element('button', `co-pose-card${actor?.pose === pose ? ' is-active' : ''}`, label); button.type = 'button'; button.dataset.pose = pose; button.disabled = !actor; button.setAttribute('aria-pressed', String(actor?.pose === pose)); catalog.append(button);
      }
      const add = element('button', 'co-asset-card co-add-from-library', '＋ Añadir personaje'); add.type = 'button'; add.classList.add('co-add-actor'); add.disabled = state.project.scene.actors.length >= LIMITS.actors.max; catalog.append(add);
    }
    libraryBody.append(catalog);
  };
  const renderRuntimeControls = (state: AppState): void => {
    const duration = state.project.camera.motion.durationS;
    const playable = state.project.camera.motion.kind !== 'static' && duration > 0;
    time.max = String(Math.max(0, duration)); time.value = String(Math.min(duration, state.runtime.timeSeconds)); time.disabled = !playable;
    play.disabled = !playable; play.textContent = state.runtime.isPlaying ? 'Pausar' : 'Reproducir'; play.setAttribute('aria-label', play.textContent);
    timeReadout.textContent = `${state.runtime.timeSeconds.toFixed(2)} s${playable ? ` / ${duration.toFixed(2)} s` : ' · sin movimiento configurado'}`;
    saveStatus.textContent = durableFeedback?.message ?? transientFeedback ?? options.persistenceStatus?.(state) ?? (state.runtime.persistenceStatus === 'saved' ? 'Guardado' : state.runtime.persistenceStatus === 'saving' ? 'Guardando…' : state.runtime.persistenceStatus === 'error' ? 'Error al guardar' : 'Cargando…');
    saveStatus.dataset.kind = transientFeedback?.startsWith('Error') || state.runtime.persistenceStatus === 'error' ? 'error' : durableFeedback || state.runtime.persistenceStatus === 'saved' ? 'success' : 'info';
    save.disabled = state.runtime.persistenceStatus === 'loading';
  };
  let previousProject = store.getState().project; let previousUi = store.getState().ui;
  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    if (state.project !== previousProject || state.ui !== previousUi) {
      previousProject = state.project; previousUi = state.ui; renderControls(state);
    }
    renderRuntimeControls(state);
    options.render?.(state);
  });
  renderControls(store.getState()); renderRuntimeControls(store.getState());
  return () => {
    unsubscribe(); shell.removeEventListener('click', onClick); shell.removeEventListener('keydown', onKeydown); shell.removeEventListener('keydown', onGlobalShortcut); shell.removeEventListener('change', onChange);
    if (feedbackTimer) clearTimeout(feedbackTimer);
    if (downloadTimer) clearTimeout(downloadTimer);
    for (const item of thumbnailUrls.values()) URL.revokeObjectURL(item.url);
    thumbnailUrls.clear(); downloadLease.dispose(); root.replaceChildren();
  };
}
