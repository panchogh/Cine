import { describe, expect, it } from 'vitest';
import { createInitialState, createDefaultProject, entityId } from '../../src/data/defaults';
import type { ShotSnapshot } from '../../src/contracts';
import { captureShot } from '../../src/shotlist/catalog';
import { createNewProjectDocument, deriveWorkspaceModel, isEditableTarget, isRestorableShot, motionForKind, prepareImportedProject, resetCameraProject } from '../../src/ui/workspace';
import { deriveFrame } from '../../src/render/frame';
import { fixtureProject } from '../fixtures/project';

describe('workspace state projection', () => {
  it('projects restored camera, view, panel, selection and guide state into controls', () => {
    const actorId = fixtureProject.scene.actors[0].id;
    const state = createInitialState({
      ...fixtureProject,
      camera: { ...fixtureProject.camera, focalLengthMm: 135, focus: { kind: 'manual', distanceM: 7.35 }, sensorGateMm: { x: 25, y: 18 } },
    });
    state.ui = { ...state.ui, activeView: 'topdown', activePanel: 'focus', selectedActorId: actorId, showGuides: true };
    expect(deriveWorkspaceModel(state)).toEqual({
      focalLengthMm: 135, focusDistanceM: 7.35, focusMode: 'manual', showGuides: true,
      activeView: 'topdown', activePanel: 'focus', selectedActorId: actorId, actorCount: 1, gateLabel: '25.00 × 10.46 mm · 2.39:1', focusTapeDistanceM: 7.35,
    });
  });

  it('uses the core axial focus plane and keeps tape distance distinct for actor focus', () => {
    const state = createInitialState(fixtureProject);
    state.project = {
      ...state.project,
      camera: { ...state.project.camera, positionM: { x: 0, y: 1.62, z: -1 }, focus: { kind: 'actor', actorId: entityId('fixture-actor-1') } },
    };
    const model = deriveWorkspaceModel(state);
    const frame = deriveFrame(state.project, state.runtime.timeSeconds, state.ui.activeView);
    expect(model.focusDistanceM).toBe(frame.metrics.focus.axialDistanceM);
    expect(model.focusTapeDistanceM).toBe(frame.metrics.focus.tapeDistanceM);
    expect(model.focusDistanceM).not.toBeCloseTo(model.focusTapeDistanceM!, 4);
  });

  it('imports valid content while retaining the current local project identity', () => {
    const local = fixtureProject;
    const portable = { ...createDefaultProject('2026-10-12T00:00:00.000Z'), name: 'Otro proyecto' };
    const candidate = prepareImportedProject(local, portable);
    expect(candidate.id).toBe(local.id);
    expect(candidate.createdAt).toBe(local.createdAt);
    expect(candidate.name).toBe('Otro proyecto');
  });

  it('resets only the camera and keeps the scene and shot catalog intact', () => {
    const captured = captureShot(fixtureProject, { camera: fixtureProject.camera, capturedAtS: 1 });
    const edited = { ...captured.project, camera: { ...captured.project.camera, focalLengthMm: 135, rollDeg: 27 } };
    const reset = resetCameraProject(edited, fixtureProject.scene.actors[0].id);
    expect(reset.scene).toEqual(edited.scene);
    expect(reset.shots).toEqual(edited.shots);
    expect(reset.camera.focalLengthMm).toBe(50);
    expect(reset.camera.rollDeg).toBe(0);
    expect(reset.camera.focus).toEqual({ kind: 'actor', actorId: fixtureProject.scene.actors[0].id });
  });

  it('creates a complete default project while retaining only the local recovery identity', () => {
    const current = { ...fixtureProject, name: 'Edited', shots: [captureShot(fixtureProject, { camera: fixtureProject.camera, capturedAtS: 1 }).shot] };
    const fresh = createNewProjectDocument(current, '2026-10-13T00:00:00.000Z');
    expect(fresh.id).toBe(current.id);
    expect(fresh.name).toBe('Nuevo proyecto');
    expect(fresh.scene.actors).toHaveLength(1);
    expect(fresh.shots).toEqual([]);
    expect(fresh.camera.focus.kind).toBe('actor');
    expect(fresh.createdAt).toBe('2026-10-13T00:00:00.000Z');
  });

  it('provides bounded playback defaults for each motion mode', () => {
    expect(motionForKind('static', fixtureProject.camera.motion)).toEqual({ kind: 'static', durationS: 0 });
    expect(motionForKind('push_in', fixtureProject.camera.motion)).toEqual({ kind: 'push_in', durationS: 3, pushInDistanceM: 1 });
    expect(motionForKind('orbit', fixtureProject.camera.motion)).toEqual({ kind: 'orbit', durationS: 3, orbitDegrees: 60 });
    expect(motionForKind('handheld', fixtureProject.camera.motion)).toMatchObject({ kind: 'handheld', durationS: 3, handheld: { frequencyHz: 2 } });
  });

  it('allows loading versioned snapshots but not metadata-only legacy rows', () => {
    const legacy: ShotSnapshot = { id: entityId('legacy-shot'), name: '<b>Shot</b>', notes: 'literal', capturedAtS: 0, camera: fixtureProject.camera, actorIds: [] };
    const independent = captureShot(fixtureProject, { camera: fixtureProject.camera, capturedAtS: 2 }).shot;
    expect(isRestorableShot(legacy)).toBe(false);
    expect(isRestorableShot(independent)).toBe(true);
  });

  it('keeps save/open shortcuts inactive while focus is in editable fields', () => {
    const target = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;
    expect(isEditableTarget(target('INPUT'))).toBe(true);
    expect(isEditableTarget(target('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(target('DIV', true))).toBe(true);
    expect(isEditableTarget(target('BUTTON'))).toBe(false);
  });
});
