import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraBasis, projectPoint } from '../../src/core/geometry';
import { configureFrameCamera } from '../../src/render/three-viewport';
import { deriveFrame } from '../../src/render/frame';
import { fixtureProject } from '../fixtures/project';

describe('Three.js camera adapter', () => {
  it.each([1, 1.33, 2])('matches core projection within one output pixel at squeeze %s', squeeze => {
    const project = { ...fixtureProject, camera: { ...fixtureProject.camera, squeeze, yawDeg: 31, pitchDeg: -7, rollDeg: 19 } };
    const frame = deriveFrame(project, 0, 'camera');
    const camera = new THREE.PerspectiveCamera(); configureFrameCamera(frame, camera);
    const basis = cameraBasis(frame.camera.yawDeg, frame.camera.pitchDeg, frame.camera.rollDeg);
    const viewport = { widthPx: 1280, heightPx: 720 }; const aspect = frame.gate.widthMm * squeeze / frame.gate.heightMm;
    const frameWidth = Math.min(viewport.widthPx, viewport.heightPx * aspect); const frameHeight = Math.min(viewport.heightPx, viewport.widthPx / aspect);
    const left = (viewport.widthPx - frameWidth) / 2; const top = (viewport.heightPx - frameHeight) / 2;
    for (const [xNdc, yNdc] of [[0, 0], [.42, .3], [-.38, -.32], [.48, -.42]]) {
      const depth = 6;
      const rightM = xNdc * frame.gate.widthMm / (frame.camera.focalLengthMm * squeeze) * depth;
      const upM = yNdc * frame.gate.heightMm / frame.camera.focalLengthMm * depth;
      const point = new THREE.Vector3(
        frame.camera.positionM.x + basis.forward.x * depth + basis.right.x * rightM + basis.up.x * upM,
        frame.camera.positionM.y + basis.forward.y * depth + basis.right.y * rightM + basis.up.y * upM,
        frame.camera.positionM.z + basis.forward.z * depth + basis.right.z * rightM + basis.up.z * upM,
      );
      const projected = projectPoint({ x: point.x, y: point.y, z: point.z }, frame.camera, frame.gate, viewport, squeeze)!;
      const actual = point.clone().project(camera);
      const expectedX = ((projected.xPx - left) / frameWidth) * 2 - 1;
      const expectedY = 1 - ((projected.yPx - top) / frameHeight) * 2;
      expect(Math.abs(actual.x - expectedX) * frameWidth / 2).toBeLessThanOrEqual(1);
      expect(Math.abs(actual.y - expectedY) * frameHeight / 2).toBeLessThanOrEqual(1);
    }
  });
});
