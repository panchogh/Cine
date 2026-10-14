import { describe, expect, it } from 'vitest';
import { entityId } from '../../src/data/defaults';
import { createStore } from '../../src/state/store';
import { createInitialState } from '../../src/data/defaults';
import { captureShot, restoreShot } from '../../src/shotlist/catalog';
import { MemoryProjectDatabase, createProjectRepository } from '../../src/project/storage';
import { fixtureProject } from '../fixtures/project';

describe('phase 2.5 integration acceptance', () => {
  it('removes an actor by ID and repairs selection and actor-focus reference', () => {
    const first = fixtureProject.scene.actors[0]!;
    const second = { ...first, id: entityId('integration-actor-2'), name: 'Segundo', positionM: { x: 2, y: 0, z: 0 } };
    const project = { ...fixtureProject, scene: { ...fixtureProject.scene, actors: [first, second] }, camera: { ...fixtureProject.camera, focus: { kind: 'actor' as const, actorId: first.id } } };
    const store = createStore(createInitialState(project));
    store.dispatch({ type: 'scene/actorRemoved', actorId: first.id });
    expect(store.getState().project.scene.actors.map(actor => actor.id)).toEqual([second.id]);
    expect(store.getState().project.camera.focus).toEqual({ kind: 'manual', distanceM: expect.any(Number) });
    expect(store.getState().ui.selectedActorId).toBe(second.id);
  });

  it('loads a saved snapshot, restores its camera and keeps asset state in the store', async () => {
    const database = new MemoryProjectDatabase();
    const repository = createProjectRepository(database);
    const captured = captureShot(fixtureProject, { camera: { ...fixtureProject.camera, focalLengthMm: 85, positionM: { x: 1, y: 2, z: -4 } }, capturedAtS: 4.25, name: 'Plano prueba' }, () => entityId('integration-shot'));
    await repository.saveWithAssets(captured.project);
    const loaded = await repository.loadWithAssets(fixtureProject.id);
    expect(loaded).not.toBeNull();

    const store = createStore(createInitialState());
    store.dispatch({ type: 'project/replaced', project: loaded!.project, assets: loaded!.assets });
    const restored = restoreShot(store.getState().project, captured.shot.id);
    store.dispatch({ type: 'project/snapshotRestored', project: restored, shotId: captured.shot.id });
    expect(store.getState().project.camera.focalLengthMm).toBe(85);
    expect(store.getState().project.camera.positionM).toEqual({ x: 1, y: 2, z: -4 });
    expect(store.getState().ui.selectedShotId).toBe(captured.shot.id);
    expect(store.getState().runtime.assets).toBe(loaded!.assets);
  });
});
