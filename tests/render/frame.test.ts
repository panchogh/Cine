import { describe, expect, it } from 'vitest';
import { entityId } from '../../src/data/defaults';
import { deriveFrame } from '../../src/render/frame';
import { cameraBasis } from '../../src/core/geometry';
import { fixtureProject } from '../fixtures/project';

describe('integrated frame adapter', () => {
  it('derives gate, optical metrics and pose-aware actors from the shared project/time', () => {
    const frame = deriveFrame(fixtureProject, 0, 'camera');
    expect(frame.gate.widthMm).toBe(36);
    expect(frame.gate.heightMm).toBeCloseTo(36 / 2.39, 8);
    expect(frame.metrics.fieldOfView.horizontalDeg).toBeCloseTo(39.598, 3);
    expect(frame.metrics.depthOfField?.nearLimitM).toBeLessThan(frame.camera.focusDistanceM);
    expect(frame.actors[0]).toMatchObject({ id: entityId('fixture-actor-1'), pose: 'standing', yawDeg: 0 });
    expect(frame.locationId).toBe(fixtureProject.scene.locationId);
  });

  it('evaluates persisted push-in parameters at the requested instant', () => {
    const project = { ...fixtureProject, camera: { ...fixtureProject.camera, motion: { kind: 'push_in' as const, durationS: 2, pushInDistanceM: 1 } } };
    const start = deriveFrame(project, 0, 'camera');
    const end = deriveFrame(project, 2, 'side');
    const forward = cameraBasis(start.camera.yawDeg, start.camera.pitchDeg).forward;
    const movementTowardScene = (end.camera.positionM.x - start.camera.positionM.x) * forward.x
      + (end.camera.positionM.y - start.camera.positionM.y) * forward.y
      + (end.camera.positionM.z - start.camera.positionM.z) * forward.z;
    expect(movementTowardScene).toBeGreaterThan(0);
    expect(end.activeView).toBe('side');
    expect(end.timeSeconds).toBe(2);
    expect(end.warnings).toEqual([]);
  });
});
