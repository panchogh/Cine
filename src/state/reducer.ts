import type { AppAction, AppState } from '../contracts';
import { LIMITS, clamp } from '../data/constraints';
import { entityId } from '../data/defaults';

export function reduceAppState(state: AppState, action: AppAction): AppState {
  const dirty = (patch: Partial<AppState>): AppState => ({ ...state, ...patch, runtime: { ...state.runtime, ...patch.runtime, invalidated: true } });
  switch (action.type) {
    case 'project/replaced': {
      const actorIds = new Set(action.project.scene.actors.map(actor => actor.id));
      const focusActorId = action.project.camera.focus.kind === 'actor' ? action.project.camera.focus.actorId : null;
      const selectedActorId = state.ui.selectedActorId && actorIds.has(state.ui.selectedActorId)
        ? state.ui.selectedActorId
        : focusActorId && actorIds.has(focusActorId) ? focusActorId : action.project.scene.actors[0]?.id ?? null;
      const shotIds = new Set(action.project.shots.map(shot => shot.id));
      const selectedShotId = action.selectedShotId !== undefined
        ? action.selectedShotId
        : state.ui.selectedShotId && shotIds.has(state.ui.selectedShotId) ? state.ui.selectedShotId : null;
      return dirty({ project: action.project, ui: { ...state.ui, selectedActorId, selectedShotId }, runtime: { ...state.runtime, assets: action.assets ?? new Map(), persistenceStatus: 'saved', invalidated: true } });
    }
    case 'project/snapshotRestored':
      return reduceAppState(state, { type: 'project/replaced', project: action.project, assets: state.runtime.assets, selectedShotId: action.shotId });
    case 'ui/viewChanged': return dirty({ ui: { ...state.ui, activeView: action.view } });
    case 'ui/panelChanged': return dirty({ ui: { ...state.ui, activePanel: action.panel } });
    case 'ui/actorSelected': return dirty({ ui: { ...state.ui, selectedActorId: state.project.scene.actors.some(a => a.id === action.actorId) ? action.actorId : null } });
    case 'ui/guidesToggled': return dirty({ ui: { ...state.ui, showGuides: action.enabled } });
    case 'scene/actorAdded': {
      if (state.project.scene.actors.length >= LIMITS.actors.max) return state;
      const n = state.project.scene.actors.length + 1;
      const actor = { id: action.actorId, name: `Actor ${n}`, positionM: { x: (n - 1) * 1.2, y: 0, z: 0 }, heightM: 1.76, yawDeg: 0, pose: 'standing' as const, color: '#f2aa68' };
      return dirty({ project: { ...state.project, scene: { ...state.project.scene, actors: [...state.project.scene.actors, actor] }, updatedAt: new Date().toISOString() }, ui: { ...state.ui, selectedActorId: actor.id } });
    }
    case 'scene/actorRemoved': {
      const removedActor = state.project.scene.actors.find(a => a.id === action.actorId);
      const actors = state.project.scene.actors.filter(a => a.id !== action.actorId);
      if (actors.length < LIMITS.actors.min || actors.length === state.project.scene.actors.length) return state;
      const focus = state.project.camera.focus.kind === 'actor' && state.project.camera.focus.actorId === action.actorId
        ? { kind: 'manual' as const, distanceM: clamp(removedActor ? Math.hypot(removedActor.positionM.x - state.project.camera.positionM.x, removedActor.positionM.y - state.project.camera.positionM.y, removedActor.positionM.z - state.project.camera.positionM.z) : 1.85, LIMITS.focusDistanceM.min, LIMITS.focusDistanceM.max) }
        : state.project.camera.focus;
      const project = { ...state.project, scene: { ...state.project.scene, actors }, camera: { ...state.project.camera, focus }, updatedAt: new Date().toISOString() };
      return dirty({ project, ui: { ...state.ui, selectedActorId: state.ui.selectedActorId === action.actorId ? actors[0]?.id ?? null : state.ui.selectedActorId } });
    }
    case 'scene/actorMoved':
      return dirty({ project: { ...state.project, scene: { ...state.project.scene, actors: state.project.scene.actors.map(a => a.id === action.actorId ? { ...a, positionM: action.positionM } : a) }, updatedAt: new Date().toISOString() } });
    case 'scene/actorPoseChanged':
      return dirty({ project: { ...state.project, scene: { ...state.project.scene, actors: state.project.scene.actors.map(a => a.id === action.actorId ? { ...a, pose: action.pose } : a) }, updatedAt: new Date().toISOString() } });
    case 'scene/locationChanged':
      if (!['studio', 'interior', 'street'].includes(action.locationId)) return state;
      return dirty({ project: { ...state.project, scene: { ...state.project.scene, locationId: action.locationId }, updatedAt: new Date().toISOString() } });
    case 'camera/focalChanged':
      if (!Number.isFinite(action.focalLengthMm)) return state;
      return dirty({ project: { ...state.project, camera: { ...state.project.camera, focalLengthMm: clamp(action.focalLengthMm, ...Object.values(LIMITS.focalLengthMm) as [number, number]) }, updatedAt: new Date().toISOString() } });
    case 'camera/focusChanged':
      if (!Number.isFinite(action.distanceM)) return state;
      return dirty({ project: { ...state.project, camera: { ...state.project.camera, focus: { kind: 'manual', distanceM: clamp(action.distanceM, LIMITS.focusDistanceM.min, LIMITS.focusDistanceM.max) } }, updatedAt: new Date().toISOString() } });
    case 'camera/motionChanged':
      if (!Number.isFinite(action.motion.durationS) || action.motion.durationS < 0) return state;
      return dirty({ project: { ...state.project, camera: { ...state.project.camera, motion: action.motion }, updatedAt: new Date().toISOString() }, runtime: { ...state.runtime, timeSeconds: 0, isPlaying: false } });
    case 'runtime/tick': return { ...state, runtime: { ...state.runtime, timeSeconds: Math.max(0, action.timeSeconds), invalidated: true } };
    case 'runtime/playbackChanged': return { ...state, runtime: { ...state.runtime, isPlaying: action.isPlaying, invalidated: true } };
    case 'runtime/viewportResized': return { ...state, runtime: { ...state.runtime, viewportCssPx: { width: action.width, height: action.height, dpr: action.dpr }, invalidated: true } };
    case 'runtime/persistenceChanged': return { ...state, runtime: { ...state.runtime, persistenceStatus: action.status } };
    default: return state;
  }
}

export const createActorAction = (): AppAction => ({ type: 'scene/actorAdded', actorId: entityId() });
