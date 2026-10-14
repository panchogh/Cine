import { createDefaultProject, entityId } from '../../src/data/defaults';
import type { ProjectDocument } from '../../src/contracts/types';

/** Shared deterministic baseline for B/C/D module work. */
const base = createDefaultProject('2026-10-13T12:00:00.000Z');
const fixtureActorId = entityId('fixture-actor-1');
export const fixtureProject: ProjectDocument = {
  ...base,
  id: entityId('fixture-project'),
  scene: { ...base.scene, actors: base.scene.actors.map(actor => ({ ...actor, id: fixtureActorId })) },
  camera: { ...base.camera, focus: { kind: 'actor', actorId: fixtureActorId } },
};
