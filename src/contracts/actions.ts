import type { CameraMotion, EntityId, ProjectDocument, ViewId, Vec3 } from './types';

export type AppAction =
  | { type: 'ui/viewChanged'; view: ViewId }
  | { type: 'ui/panelChanged'; panel: 'framing' | 'optics' | 'focus' | 'actors' | 'locations' | 'rig' | 'sensor' | 'shotlist' }
  | { type: 'ui/actorSelected'; actorId: EntityId | null }
  | { type: 'ui/guidesToggled'; enabled: boolean }
  | { type: 'scene/actorAdded'; actorId: EntityId }
  | { type: 'scene/actorRemoved'; actorId: EntityId }
  | { type: 'scene/actorMoved'; actorId: EntityId; positionM: Vec3 }
  | { type: 'scene/actorPoseChanged'; actorId: EntityId; pose: import('./types').Actor['pose'] }
  | { type: 'scene/locationChanged'; locationId: string }
  | { type: 'project/replaced'; project: ProjectDocument; assets?: Map<EntityId, Blob>; selectedShotId?: EntityId | null }
  | { type: 'project/snapshotRestored'; project: ProjectDocument; shotId: EntityId }
  | { type: 'camera/focalChanged'; focalLengthMm: number }
  | { type: 'camera/focusChanged'; distanceM: number }
  | { type: 'camera/motionChanged'; motion: CameraMotion }
  | { type: 'runtime/tick'; timeSeconds: number }
  | { type: 'runtime/playbackChanged'; isPlaying: boolean }
  | { type: 'runtime/viewportResized'; width: number; height: number; dpr: number }
  | { type: 'runtime/persistenceChanged'; status: 'loading' | 'saved' | 'saving' | 'error' };
