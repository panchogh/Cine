import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '../../src/contracts';
import { createDefaultProject, entityId } from '../../src/data/defaults';
import { cameraBasis, deriveEffectiveGate, fieldOfView, orbitPose, projectPoint } from '../../src/core/geometry';
import { depthOfField, resolveFocus } from '../../src/core/optics';
import { compensateFraming, evaluateCamera, shotPreset } from '../../src/core/camera';

function sampleProject(): ProjectDocument {
  const base = createDefaultProject('2026-10-13T12:00:00.000Z');
  const a = { ...base.scene.actors[0]!, id: entityId('core-a'), positionM: { x: 0, y: 0, z: 0 } };
  const b = { ...a, id: entityId('core-b'), name: 'B', positionM: { x: 2, y: 0, z: 0 }, pose: 'sitting' as const };
  return { ...base, scene: { ...base.scene, actors: [a, b] }, camera: { ...base.camera, positionM: { x: 0, y: 1.62, z: -3 }, yawDeg: 0, pitchDeg: 0, rollDeg: 0, focus: { kind: 'actor', actorId: a.id }, motion: { kind: 'static', durationS: 2 } } };
}

describe('CineOptics core acceptance', () => {
  it('V01: derives horizontal and vertical FOV from the active gate and focal length', () => {
    const fov = fieldOfView({ widthMm: 36, heightMm: 24 }, 50);
    expect(fov.horizontalDeg).toBeCloseTo(39.598, 3);
    expect(fov.verticalDeg).toBeCloseTo(26.991, 3);
  });

  it('V02: crops a centered effective output gate, including squeeze', () => {
    const gate = deriveEffectiveGate({ sensorGateMm: { x: 36, y: 24 }, outputAspect: 2.39, squeeze: 1 });
    expect(gate.widthMm).toBe(36);
    expect(gate.heightMm).toBeCloseTo(15.0627615, 6);
    expect(gate.heightMm).not.toBe(24);
    expect(deriveEffectiveGate({ sensorGateMm: { x: 36, y: 24 }, outputAspect: 2.39, squeeze: 2 }).heightMm).toBe(24);
  });

  it('V03: projection is independent of canvas size at fixed aspect', () => {
    const camera = { positionM: { x: 0, y: 0, z: 0 }, yawDeg: 0, pitchDeg: 0, rollDeg: 0, focalLengthMm: 50 };
    const gate = { widthMm: 36, heightMm: 15.0627615 };
    const p = { x: 0.6, y: 0.2, z: 4 };
    const small = projectPoint(p, camera, gate, { widthPx: 800, heightPx: 800 / 2.39 })!;
    const large = projectPoint(p, camera, gate, { widthPx: 1600, heightPx: 1600 / 2.39 })!;
    expect(large.xNdc).toBeCloseTo(small.xNdc, 10);
    expect(large.yNdc).toBeCloseTo(small.yNdc, 10);
  });

  it('V04: orbit keeps a fixed radius and aims the target for cardinal and diagonal yaws', () => {
    const target = { x: 0, y: 1, z: 0 };
    for (const yaw of [0, 45, -45, 90, -90, 180]) {
      const pose = orbitPose({ targetM: target, distanceM: 5, yawDeg: yaw, pitchDeg: 0 });
      expect(Math.hypot(pose.positionM.x - target.x, pose.positionM.y - target.y, pose.positionM.z - target.z)).toBeCloseTo(5, 12);
      const basis = cameraBasis(pose.yawDeg, pose.pitchDeg, pose.rollDeg);
      const delta = { x: target.x - pose.positionM.x, y: target.y - pose.positionM.y, z: target.z - pose.positionM.z };
      expect(delta.x * basis.forward.x + delta.y * basis.forward.y + delta.z * basis.forward.z).toBeCloseTo(5, 12);
    }
  });

  it('V05: actor focus resolves a pose-aware point on the axial focus plane', () => {
    const project = sampleProject();
    const evaluated = { positionM: { x: -1, y: 1.62, z: -3 }, yawDeg: 20, pitchDeg: 5, rollDeg: 0, focalLengthMm: 50, focusDistanceM: 2, timeSeconds: 0 };
    const resolved = resolveFocus(project, evaluated);
    expect(resolved.targetPointM).not.toBeNull();
    expect(resolved.axialDistanceM).toBeGreaterThan(0);
    expect(resolved.tapeDistanceM).toBeGreaterThan(resolved.axialDistanceM);
    expect(evaluated.focusDistanceM).not.toBe(resolved.axialDistanceM);
  });

  it('V06: matches an independently calculated thin-lens DoF fixture', () => {
    // Fixture calculated separately from implementation: H=50²/(2.8·0.03)+50; limits from exact thin-lens distances.
    const dof = depthOfField({ focalLengthMm: 50, fNumber: 2.8, circleOfConfusionMm: 0.03, focusDistanceM: 3 });
    expect(dof.hyperfocalDistanceM).toBeCloseTo(29.8119047619, 8);
    expect(dof.nearLimitM).toBeCloseTo(2.73404177888, 8);
    expect(dof.farLimitM).toBeCloseTo(3.33567178759, 8);
    expect(dof.nearLimitM).toBeLessThan(3);
    expect(dof.farLimitM).toBeGreaterThan(3);
  });

  it('V07: handles the infinity threshold and rejects non-physical inputs explicitly', () => {
    const H = 29.811904761904763;
    expect(depthOfField({ focalLengthMm: 50, fNumber: 2.8, circleOfConfusionMm: 0.03, focusDistanceM: H - 1e-7 }).farIsInfinity).toBe(false);
    const atH = depthOfField({ focalLengthMm: 50, fNumber: 2.8, circleOfConfusionMm: 0.03, focusDistanceM: H });
    expect(atH.farIsInfinity).toBe(true);
    expect(atH.farLimitM).toBe(Infinity);
    expect(Number.isFinite(atH.nearLimitM)).toBe(true);
    expect(() => depthOfField({ focalLengthMm: 50, fNumber: 0, circleOfConfusionMm: 0.03, focusDistanceM: 3 })).toThrow(RangeError);
    expect(() => depthOfField({ focalLengthMm: 1e308, fNumber: 2.8, circleOfConfusionMm: 0.03, focusDistanceM: 3 })).toThrow(/supported CineOptics range/);
    expect(projectPoint({ x: 0, y: 0, z: -1 }, { positionM: { x: 0, y: 0, z: 0 }, yawDeg: 0, pitchDeg: 0, rollDeg: 0, focalLengthMm: 50 }, { widthMm: 36, heightMm: 24 }, { widthPx: 1920, heightPx: 1080 })).toBeNull();
  });

  it('V08: compensates a focal change and reports explicit near/far saturation', () => {
    const common = { cameraPositionM: { x: 0, y: 0, z: -3 }, cameraForward: { x: 0, y: 0, z: 1 }, targetM: { x: 0, y: 0, z: 0 }, oldFocalLengthMm: 24, minDistanceM: 0.35, maxDistanceM: 30 };
    const middle = compensateFraming({ ...common, newFocalLengthMm: 135 });
    expect(middle.actualDistanceM).toBeCloseTo(16.875, 12);
    expect(middle.limited).toBe(false);
    const roundTrip = compensateFraming({ cameraPositionM: middle.positionM, cameraForward: common.cameraForward, targetM: common.targetM, oldFocalLengthMm: 135, newFocalLengthMm: 24, minDistanceM: 0.35, maxDistanceM: 30 });
    expect(roundTrip.positionM.z).toBeCloseTo(-3, 12);
    const bounded = compensateFraming({ ...common, newFocalLengthMm: 250, maxDistanceM: 10 });
    expect(bounded.actualDistanceM).toBe(10);
    expect(bounded.limited).toBe(true);
    expect(bounded.warning).toMatch(/far distance limit/);
  });

  it('V09: samples camera motion at the requested time and frames selected/two-shot subjects', () => {
    const project = sampleProject();
    project.camera.motion = { kind: 'push_in', durationS: 2 };
    const still = evaluateCamera(project, 0).camera;
    const moving = evaluateCamera(project, 1, { pushInDistanceM: 1 }).camera;
    expect(moving.timeSeconds).toBe(1);
    expect(moving.positionM.z).toBeGreaterThan(still.positionM.z);
    const b = project.scene.actors[1]!;
    const solo = shotPreset(project, b.id, 'medium');
    expect(solo.actorIds).toEqual([b.id]);
    const pair = shotPreset(project, b.id, 'two-shot', project.scene.actors[0]!.id);
    expect(pair.actorIds).toEqual([b.id, project.scene.actors[0]!.id]);
    expect(pair.camera.focalLengthMm).toBeLessThan(solo.camera.focalLengthMm);
    expect(pair.actorIds).toHaveLength(2);
    expect(() => shotPreset(project, entityId('missing'), 'medium')).toThrow(RangeError);
    const orbitProject = { ...project, camera: { ...project.camera, motion: { kind: 'orbit' as const, durationS: 2 } } };
    expect(evaluateCamera(orbitProject, 1).warning).toContain('orbitTargetM');
    const orbitEnd = evaluateCamera(orbitProject, 2, { orbitTargetM: { x: 0, y: 1, z: 0 }, orbitDegrees: 90 }).camera;
    expect(orbitEnd.timeSeconds).toBe(2);
    expect(Number.isFinite(orbitEnd.positionM.x)).toBe(true);
  });
});
