import type { Actor, EvaluatedCamera, Vec2, Vec3 } from '../contracts';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface CameraBasis { right: Vec3; up: Vec3; forward: Vec3 }
export interface CameraOrbit { targetM: Vec3; distanceM: number; yawDeg: number; pitchDeg: number; rollDeg?: number }
export interface GateInput { sensorGateMm: Vec2; outputAspect: number; squeeze: number }
export interface Viewport { widthPx: number; heightPx: number }
export interface ProjectedPoint { xNdc: number; yNdc: number; xPx: number; yPx: number; axialDepthM: number; visible: boolean }

export function cameraBasis(yawDeg: number, pitchDeg: number, rollDeg = 0): CameraBasis {
  const yaw = yawDeg * RAD;
  const pitch = pitchDeg * RAD;
  const roll = rollDeg * RAD;
  const forward = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
  const unrolledRight = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const unrolledUp = { x: -Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(yaw) * Math.sin(pitch) };
  return {
    forward,
    right: add(scale(unrolledRight, Math.cos(roll)), scale(unrolledUp, Math.sin(roll))),
    up: add(scale(unrolledUp, Math.cos(roll)), scale(unrolledRight, -Math.sin(roll))),
  };
}

/** Orbit around a world-space target. Yaw 0 looks toward +Z; positive yaw turns toward +X. */
export function orbitPose(orbit: CameraOrbit): Pick<EvaluatedCamera, 'positionM' | 'yawDeg' | 'pitchDeg' | 'rollDeg'> {
  assertPositive('distanceM', orbit.distanceM);
  const basis = cameraBasis(orbit.yawDeg, orbit.pitchDeg);
  return {
    positionM: subtract(orbit.targetM, scale(basis.forward, orbit.distanceM)),
    yawDeg: orbit.yawDeg,
    pitchDeg: orbit.pitchDeg,
    rollDeg: orbit.rollDeg ?? 0,
  };
}

/** Centered largest crop whose de-squeezed width/height equals outputAspect. */
export function deriveEffectiveGate(input: GateInput): { widthMm: number; heightMm: number; outputAspect: number } {
  assertPositive('sensorGateMm.x', input.sensorGateMm.x);
  assertPositive('sensorGateMm.y', input.sensorGateMm.y);
  assertPositive('outputAspect', input.outputAspect);
  assertPositive('squeeze', input.squeeze);
  const physicalAspect = input.outputAspect / input.squeeze;
  let widthMm = input.sensorGateMm.x;
  let heightMm = input.sensorGateMm.y;
  if (widthMm / heightMm > physicalAspect) widthMm = heightMm * physicalAspect;
  else heightMm = widthMm / physicalAspect;
  return { widthMm, heightMm, outputAspect: input.outputAspect };
}

export function fieldOfView(gate: { widthMm: number; heightMm: number }, focalLengthMm: number, squeeze = 1): { horizontalDeg: number; verticalDeg: number; diagonalDeg: number } {
  assertPositive('focalLengthMm', focalLengthMm);
  assertPositive('gate.widthMm', gate.widthMm);
  assertPositive('gate.heightMm', gate.heightMm);
  assertPositive('squeeze', squeeze);
  const fov = (sizeMm: number) => 2 * Math.atan(sizeMm / (2 * focalLengthMm)) * DEG;
  return {
    horizontalDeg: fov(gate.widthMm * squeeze),
    verticalDeg: fov(gate.heightMm),
    diagonalDeg: fov(Math.hypot(gate.widthMm * squeeze, gate.heightMm)),
  };
}

/** Pinhole projection on the de-squeezed, cropped gate; viewport is CSS/output pixels. */
export function projectPoint(worldPointM: Vec3, camera: Pick<EvaluatedCamera, 'positionM' | 'yawDeg' | 'pitchDeg' | 'rollDeg' | 'focalLengthMm'>, gate: { widthMm: number; heightMm: number }, viewport: Viewport, squeeze = 1): ProjectedPoint | null {
  assertPositive('focalLengthMm', camera.focalLengthMm);
  assertPositive('gate.widthMm', gate.widthMm);
  assertPositive('gate.heightMm', gate.heightMm);
  assertPositive('viewport.widthPx', viewport.widthPx);
  assertPositive('viewport.heightPx', viewport.heightPx);
  assertPositive('squeeze', squeeze);
  const basis = cameraBasis(camera.yawDeg, camera.pitchDeg, camera.rollDeg);
  const relative = subtract(worldPointM, camera.positionM);
  const axialDepthM = dot(relative, basis.forward);
  if (!Number.isFinite(axialDepthM) || axialDepthM < 1e-6) return null;
  const imageXmm = camera.focalLengthMm * dot(relative, basis.right) / axialDepthM * squeeze;
  const imageYmm = camera.focalLengthMm * dot(relative, basis.up) / axialDepthM;
  const xNdc = imageXmm / gate.widthMm;
  const yNdc = imageYmm / gate.heightMm;
  if (!Number.isFinite(xNdc) || !Number.isFinite(yNdc)) return null;
  const outputAspect = gate.widthMm * squeeze / gate.heightMm;
  const viewportAspect = viewport.widthPx / viewport.heightPx;
  const frameWidthPx = viewportAspect >= outputAspect ? viewport.heightPx * outputAspect : viewport.widthPx;
  const frameHeightPx = viewportAspect >= outputAspect ? viewport.heightPx : viewport.widthPx / outputAspect;
  const frameLeftPx = (viewport.widthPx - frameWidthPx) / 2;
  const frameTopPx = (viewport.heightPx - frameHeightPx) / 2;
  return {
    xNdc, yNdc,
    xPx: frameLeftPx + (xNdc + 0.5) * frameWidthPx,
    yPx: frameTopPx + (0.5 - yNdc) * frameHeightPx,
    axialDepthM,
    visible: Math.abs(xNdc) <= 0.5 && Math.abs(yNdc) <= 0.5,
  };
}

/** Assumed focus marks: standing/walking at 90% of height, sitting at 55%. */
export function actorFocusPoint(actor: Actor): Vec3 {
  const fraction = actor.pose === 'sitting' ? 0.55 : 0.9;
  return { x: actor.positionM.x, y: actor.positionM.y + actor.heightM * fraction, z: actor.positionM.z };
}

export function axialDistanceM(pointM: Vec3, camera: Pick<EvaluatedCamera, 'positionM' | 'yawDeg' | 'pitchDeg'>): number {
  return dot(subtract(pointM, camera.positionM), cameraBasis(camera.yawDeg, camera.pitchDeg).forward);
}

export function lookAtPose(positionM: Vec3, targetM: Vec3): { positionM: Vec3; yawDeg: number; pitchDeg: number } {
  const direction = subtract(targetM, positionM);
  const horizontal = Math.hypot(direction.x, direction.z);
  if (Math.hypot(horizontal, direction.y) === 0) throw new RangeError('Camera and target must differ.');
  return { positionM: { ...positionM }, yawDeg: Math.atan2(direction.x, direction.z) * DEG, pitchDeg: Math.atan2(direction.y, horizontal) * DEG };
}

function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function subtract(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(a: Vec3, amount: number): Vec3 { return { x: a.x * amount, y: a.y * amount, z: a.z * amount }; }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function assertPositive(name: string, value: number): void { if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and greater than zero.`); }
