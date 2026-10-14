import type { AppState, EntityId, ProjectDocument } from '../contracts/types';

export function entityId(seed?: string): EntityId {
  const value = seed ?? (globalThis.crypto?.randomUUID?.() ?? `cine-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return value as EntityId;
}

export function createDefaultProject(now = new Date().toISOString()): ProjectDocument {
  const actorId = entityId();
  return {
    schemaVersion: 1,
    id: entityId(),
    name: 'Nuevo proyecto',
    createdAt: now,
    updatedAt: now,
    scene: {
      actors: [{ id: actorId, name: 'Protagonista', positionM: { x: 0, y: 0, z: 0 }, heightM: 1.76, yawDeg: 0, pose: 'standing', color: '#6fa8ff' }],
      locationId: 'studio',
      backgroundDistanceM: 6,
    },
    camera: {
      positionM: { x: 0, y: 1.12, z: 7 }, yawDeg: 180, pitchDeg: 0, rollDeg: 0,
      focalLengthMm: 50, sensorGateMm: { x: 36, y: 24 }, outputAspect: 2.39, squeeze: 1,
      fNumber: 2.8, circleOfConfusionMm: 0.029, focus: { kind: 'actor', actorId },
      motion: { kind: 'static', durationS: 0 },
    },
    look: { ndStops: 0, grainPercent: 10, shutterAngleDeg: 180, frameRate: 24 },
    shots: [],
  };
}

export function createInitialState(project = createDefaultProject()): AppState {
  return {
    project,
    ui: { activeView: 'camera', activePanel: 'framing', selectedActorId: project.scene.actors[0]?.id ?? null, selectedShotId: null, showGuides: false },
    runtime: { timeSeconds: 0, isPlaying: false, viewportCssPx: { width: 0, height: 0, dpr: 1 }, invalidated: true, assets: new Map(), persistenceStatus: 'loading' },
  };
}
