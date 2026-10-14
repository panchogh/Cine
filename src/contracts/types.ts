/** World X points right, Y up, Z toward the initial background. Scene distances are metres. */
export type EntityId = string & { readonly __entityId: unique symbol };
export type ViewId = 'camera' | 'topdown' | 'stage3d' | 'side';
export type FocusMode = { kind: 'manual'; distanceM: number } | { kind: 'actor'; actorId: EntityId };
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
export type CameraMotion =
  | { kind: 'static'; durationS: number }
  | { kind: 'push_in'; durationS: number; pushInDistanceM?: number }
  | { kind: 'orbit'; durationS: number; orbitTargetM?: Vec3; orbitDegrees?: number }
  | { kind: 'handheld'; durationS: number; handheld?: { translationM: number; rotationDeg: number; frequencyHz: number; phaseRad?: number } };

export interface Actor {
  id: EntityId;
  name: string;
  positionM: Vec3;
  heightM: number;
  yawDeg: number;
  pose: 'standing' | 'sitting' | 'walking';
  color: string;
}

export interface CameraDocument {
  positionM: Vec3;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  focalLengthMm: number;
  sensorGateMm: Vec2;
  outputAspect: number;
  squeeze: number;
  fNumber: number;
  circleOfConfusionMm: number;
  focus: FocusMode;
  motion: CameraMotion;
}

export interface ShotSnapshotBase {
  id: EntityId;
  name: string;
  notes: string;
  capturedAtS: number;
  camera: CameraDocument;
  actorIds: EntityId[];
}

/** Legacy row: metadata only, retained for schema-v1 migration compatibility. */
export interface ShotSnapshot extends ShotSnapshotBase { snapshotVersion?: never; }
/** Versioned row that owns the exact scene/look needed for restoration. */
export interface IndependentShotSnapshot extends ShotSnapshotBase {
  snapshotVersion: 1;
  scene: ProjectDocument['scene'];
  look: ProjectDocument['look'];
  thumbnailId: EntityId | null;
}
export type ProjectShot = ShotSnapshot | IndependentShotSnapshot;

/** Portable, versioned source of truth. No UI or renderer state is serialized here. */
export interface ProjectDocument {
  schemaVersion: 1;
  id: EntityId;
  name: string;
  createdAt: string;
  updatedAt: string;
  scene: { actors: Actor[]; locationId: string; backgroundDistanceM: number };
  camera: CameraDocument;
  look: { ndStops: number; grainPercent: number; shutterAngleDeg: number; frameRate: number };
  shots: ProjectShot[];
}

export interface UIState {
  activeView: ViewId;
  activePanel: 'framing' | 'optics' | 'focus' | 'actors' | 'locations' | 'rig' | 'sensor' | 'shotlist';
  selectedActorId: EntityId | null;
  selectedShotId: EntityId | null;
  showGuides: boolean;
}

/** Ephemeral values: never save to ProjectDocument. */
export interface RuntimeState {
  timeSeconds: number;
  isPlaying: boolean;
  viewportCssPx: { width: number; height: number; dpr: number };
  invalidated: boolean;
  assets: Map<EntityId, Blob>;
  persistenceStatus: 'loading' | 'saved' | 'saving' | 'error';
}

export interface AppState {
  project: ProjectDocument;
  ui: UIState;
  runtime: RuntimeState;
}

/** One evaluated pose per instant; all views and capture consume this same object. */
export interface EvaluatedCamera {
  positionM: Vec3;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  focalLengthMm: number;
  focusDistanceM: number;
  timeSeconds: number;
}
export interface FrameGate { widthMm: number; heightMm: number; outputAspect: number; }
export interface FrameActor { id: EntityId; name: string; positionM: Vec3; heightM: number; yawDeg: number; pose: Actor['pose']; color: string; }
export interface FrameMetrics {
  fieldOfView: { horizontalDeg: number; verticalDeg: number; diagonalDeg: number };
  depthOfField: { hyperfocalDistanceM: number; nearLimitM: number; farLimitM: number; farIsInfinity: boolean } | null;
  focus: { mode: FocusMode['kind']; targetPointM: Vec3 | null; axialDistanceM: number; tapeDistanceM: number | null; warning?: string };
}
export interface FrameModel {
  camera: EvaluatedCamera;
  gate: FrameGate;
  squeeze: number;
  actors: FrameActor[];
  locationId: string;
  activeView: ViewId;
  timeSeconds: number;
  metrics: FrameMetrics;
  warnings: string[];
  look: Pick<ProjectDocument['look'], 'ndStops' | 'grainPercent' | 'shutterAngleDeg' | 'frameRate'>;
}
export interface RenderViewOptions { guides: boolean; clearColor?: string; selectedActorId?: EntityId | null; }
export interface CaptureOptions { widthPx: number; heightPx: number; includeGuides?: boolean; }
export interface CssViewport { widthPx: number; heightPx: number; }
export interface RenderApi {
  renderView(context: CanvasRenderingContext2D, frame: FrameModel, options: RenderViewOptions): void;
  captureFrame(frame: FrameModel, options: CaptureOptions): Promise<Blob>;
}
export interface CssPoint { xCssPx: number; yCssPx: number; }
/** Gesture implementation uses CSS pixels, independent of canvas backing-store DPR. */
export interface GestureApi {
  hitTest(point: CssPoint, frame: FrameModel, viewportCssPx?: CssViewport): EntityId | null;
  bindGestures(canvas: HTMLCanvasElement, readFrame: () => FrameModel, dispatch: (action: import('./actions').AppAction) => void): () => void;
}
export interface ProjectRepository {
  save(project: ProjectDocument): Promise<{ savedAt: string }>;
  load(id: EntityId): Promise<ProjectDocument | null>;
  saveWithAssets(project: ProjectDocument, assets?: ReadonlyMap<EntityId, Blob>): Promise<{ savedAt: string }>;
  loadWithAssets(id: EntityId): Promise<{ project: ProjectDocument; assets: Map<EntityId, Blob>; recovered: boolean } | null>;
}
