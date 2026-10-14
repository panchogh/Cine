import { describe, expect, it } from 'vitest';
import { createInitialState, entityId } from '../../src/data/defaults';
import { reduceAppState } from '../../src/state/reducer';
import { fixtureProject } from '../fixtures/project';

describe('phase-1 shared state contracts', () => {
  it('keeps project, UI and runtime as separate top-level domains', () => {
    const state = createInitialState(fixtureProject);
    expect(state).toHaveProperty('project'); expect(state).toHaveProperty('ui'); expect(state).toHaveProperty('runtime');
    expect(state.project).not.toHaveProperty('activeView');
    expect(state.project).not.toHaveProperty('viewportCssPx');
  });
  it('selects a stable actor ID and repairs focus when that actor is removed', () => {
    const state = createInitialState({ ...fixtureProject, scene: { ...fixtureProject.scene, actors: [...fixtureProject.scene.actors, { ...fixtureProject.scene.actors[0]!, id: entityId('actor-2') }] } }); const actor = state.project.scene.actors[0]!;
    const next = reduceAppState(state, { type: 'scene/actorRemoved', actorId: actor.id });
    expect(next.project.scene.actors).toHaveLength(1);
    expect(next.project.camera.focus.kind).toBe('manual');
    expect(next.ui.selectedActorId).toBe(next.project.scene.actors[0]!.id);
  });
  it('enforces actor maximum and focal limits', () => {
    let state = createInitialState(fixtureProject);
    for (let i = 0; i < 8; i++) state = reduceAppState(state, { type: 'scene/actorAdded', actorId: entityId(`actor-${i}`) });
    expect(state.project.scene.actors).toHaveLength(6);
    state = reduceAppState(state, { type: 'camera/focalChanged', focalLengthMm: 1000 });
    expect(state.project.camera.focalLengthMm).toBe(250);
  });
  it('keeps playback time ephemeral and resets it when camera motion changes', () => {
    let state = createInitialState(fixtureProject);
    state = reduceAppState(state, { type: 'camera/motionChanged', motion: { kind: 'push_in', durationS: 2, pushInDistanceM: 1 } });
    state = reduceAppState(state, { type: 'runtime/playbackChanged', isPlaying: true });
    state = reduceAppState(state, { type: 'runtime/tick', timeSeconds: 0.75 });
    expect(state.runtime).toMatchObject({ isPlaying: true, timeSeconds: 0.75 });
    expect(state.project.camera.motion).toEqual({ kind: 'push_in', durationS: 2, pushInDistanceM: 1 });
    state = reduceAppState(state, { type: 'camera/motionChanged', motion: { kind: 'static', durationS: 0 } });
    expect(state.runtime).toMatchObject({ isPlaying: false, timeSeconds: 0 });
  });
  it('stores scenario and articulated pose selections in the project', () => {
    const initial = createInitialState(fixtureProject); const actor = initial.project.scene.actors[0]!;
    let next = reduceAppState(initial, { type: 'scene/locationChanged', locationId: 'interior' });
    next = reduceAppState(next, { type: 'scene/actorPoseChanged', actorId: actor.id, pose: 'sitting' });
    expect(next.project.scene.locationId).toBe('interior');
    expect(next.project.scene.actors[0]?.pose).toBe('sitting');
    expect(reduceAppState(next, { type: 'scene/locationChanged', locationId: 'unknown' })).toBe(next);
  });
});
