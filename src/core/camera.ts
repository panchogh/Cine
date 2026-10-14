import type { Actor, EntityId, EvaluatedCamera, ProjectDocument, Vec3 } from '../contracts';
import { LIMITS } from '../data/constraints';
import { actorFocusPoint, lookAtPose, orbitPose } from './geometry';

export interface MotionParameters {
  /** Required for orbit; otherwise an orbit motion reports a missing-parameter warning and stays at base pose. */
  orbitTargetM?: Vec3;
  orbitDegrees?: number;
  /** Push-in travel in metres, positive toward the focus target. */
  pushInDistanceM?: number;
  handheld?: { translationM: number; rotationDeg: number; frequencyHz: number; phaseRad?: number };
}
export interface CameraEvaluation { camera: EvaluatedCamera; warning?: string }
export interface FrameCompensation { positionM: Vec3; requestedDistanceM: number; actualDistanceM: number; limited: boolean; warning?: string }

/** Evaluate a deterministic motion sample at absolute project time. Motion amplitudes are explicit inputs. */
export function evaluateCamera(project: ProjectDocument, timeSeconds: number, parameters: MotionParameters = {}): CameraEvaluation {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) throw new RangeError('timeSeconds must be finite and non-negative.');
  const base = project.camera;
  if (!Number.isFinite(base.motion.durationS) || base.motion.durationS < 0) throw new RangeError('motion.durationS must be finite and non-negative.');
  const t = base.motion.durationS > 0 ? clamp(timeSeconds / base.motion.durationS, 0, 1) : 0;
  let positionM = { ...base.positionM };
  let yawDeg = base.yawDeg;
  let pitchDeg = base.pitchDeg;
  let rollDeg = base.rollDeg;
  let warning: string | undefined;

  if (base.motion.kind === 'push_in') {
    if (parameters.pushInDistanceM === undefined) warning = 'push_in requires explicit pushInDistanceM; returning base pose.';
    else {
      if (!Number.isFinite(parameters.pushInDistanceM)) throw new RangeError('pushInDistanceM must be finite.');
      const target = focusTarget(project);
      const direction = normalize(subtract(target, positionM));
      positionM = add(positionM, scale(direction, parameters.pushInDistanceM * smoothstep(t)));
    }
  } else if (base.motion.kind === 'orbit') {
    const focusedId = base.focus.kind === 'actor' ? base.focus.actorId : undefined;
    const focusActor = focusedId ? project.scene.actors.find(a => a.id === focusedId) : undefined;
    const target = parameters.orbitTargetM ?? (focusActor ? actorFocusPoint(focusActor) : undefined);
    if (!target || parameters.orbitDegrees === undefined) warning = 'orbit requires orbitTargetM and orbitDegrees; returning base pose.';
    else {
      if (!Number.isFinite(parameters.orbitDegrees)) throw new RangeError('orbitDegrees must be finite.');
      const initial = subtract(base.positionM, target);
      const radius = Math.hypot(initial.x, initial.y, initial.z);
      const yaw = Math.atan2(-initial.x, -initial.z) * 180 / Math.PI;
      const pitch = Math.atan2(initial.y, Math.hypot(initial.x, initial.z)) * 180 / Math.PI;
      const pose = orbitPose({ targetM: target, distanceM: radius, yawDeg: yaw + parameters.orbitDegrees * smoothstep(t), pitchDeg: -pitch, rollDeg });
      positionM = pose.positionM; yawDeg = pose.yawDeg; pitchDeg = pose.pitchDeg;
    }
  } else if (base.motion.kind === 'handheld') {
    const h = parameters.handheld;
    if (!h) warning = 'handheld requires explicit amplitudes and frequency; returning base pose.';
    else {
      if (![h.translationM, h.rotationDeg, h.frequencyHz].every(Number.isFinite) || h.translationM < 0 || h.rotationDeg < 0 || h.frequencyHz < 0) throw new RangeError('handheld parameters must be finite and non-negative.');
      const phase = 2 * Math.PI * h.frequencyHz * timeSeconds + (h.phaseRad ?? 0);
      positionM = add(positionM, { x: h.translationM * Math.sin(phase), y: h.translationM * 0.55 * Math.sin(phase * 1.31), z: h.translationM * 0.35 * Math.cos(phase * 0.73) });
      yawDeg += h.rotationDeg * Math.sin(phase * 0.83);
      pitchDeg += h.rotationDeg * 0.65 * Math.cos(phase * 1.17);
      rollDeg += h.rotationDeg * 0.35 * Math.sin(phase * 0.61);
    }
  }

  let focusDistanceM = base.focus.kind === 'manual' ? base.focus.distanceM : 0;
  if (base.focus.kind === 'actor') {
    const focusActorId = base.focus.actorId;
    const actor = project.scene.actors.find(candidate => candidate.id === focusActorId);
    focusDistanceM = actor ? axialTo(actorFocusPoint(actor), positionM, yawDeg, pitchDeg) : LIMITS.focusDistanceM.min;
    if (focusDistanceM <= 0) {
      focusDistanceM = LIMITS.focusDistanceM.min;
      warning = 'Focus actor is on or behind the evaluated camera plane.';
    }
  }
  return { camera: { positionM, yawDeg, pitchDeg, rollDeg, focalLengthMm: base.focalLengthMm, focusDistanceM, timeSeconds }, ...(warning ? { warning } : {}) };
}

export function compensateFraming(input: { cameraPositionM: Vec3; cameraForward: Vec3; targetM: Vec3; oldFocalLengthMm: number; newFocalLengthMm: number; minDistanceM: number; maxDistanceM: number }): FrameCompensation {
  const { cameraPositionM, cameraForward, targetM } = input;
  for (const [key, value] of [['oldFocalLengthMm', input.oldFocalLengthMm], ['newFocalLengthMm', input.newFocalLengthMm]] as const) if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${key} must be finite and greater than zero.`);
  const min = input.minDistanceM;
  const max = input.maxDistanceM;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) throw new RangeError('Framing distance limits must be finite, positive and ordered.');
  const forward = normalize(cameraForward);
  const current = dot(subtract(targetM, cameraPositionM), forward);
  if (current <= 0) throw new RangeError('Framing target must be in front of the camera.');
  const requestedDistanceM = current * input.newFocalLengthMm / input.oldFocalLengthMm;
  const actualDistanceM = clamp(requestedDistanceM, min, max);
  const positionM = subtract(targetM, scale(forward, actualDistanceM));
  const limited = Math.abs(actualDistanceM - requestedDistanceM) > 1e-12;
  return { positionM, requestedDistanceM, actualDistanceM, limited, ...(limited ? { warning: `Framing compensation reached the ${requestedDistanceM < min ? 'near' : 'far'} distance limit (${actualDistanceM.toFixed(2)} m).` } : {}) };
}

export type ShotPresetKind = 'close-up' | 'medium' | 'wide' | 'two-shot';
export interface ShotPreset { camera: Pick<EvaluatedCamera, 'positionM' | 'yawDeg' | 'pitchDeg' | 'rollDeg' | 'focalLengthMm' | 'focusDistanceM'>; actorIds: EntityId[]; label: ShotPresetKind }

/** Approximate framing preset. It changes lens/camera values only; callers dispatch the returned patch. */
export function shotPreset(project: ProjectDocument, selectedActorId: EntityId, kind: ShotPresetKind, secondActorId?: EntityId): ShotPreset {
  const selected = project.scene.actors.find(actor => actor.id === selectedActorId);
  if (!selected) throw new RangeError('A valid selected actor ID is required.');
  const actors = [selected];
  if (kind === 'two-shot') {
    const other = secondActorId ? project.scene.actors.find(actor => actor.id === secondActorId && actor.id !== selected.id) : project.scene.actors.filter(actor => actor.id !== selected.id).sort((a, b) => distanceSquared(a.positionM, selected.positionM) - distanceSquared(b.positionM, selected.positionM))[0];
    if (!other) throw new RangeError('two-shot requires a second distinct actor.');
    actors.push(other);
  }
  const target = boundsCenter(actors);
  const focal = kind === 'close-up' ? 85 : kind === 'medium' ? 50 : kind === 'wide' ? 28 : 35;
  const fraction = kind === 'close-up' ? 0.3 : kind === 'medium' ? 0.62 : kind === 'wide' ? 0.84 : 0.78;
  const gateHeightMm = project.camera.sensorGateMm.y;
  const maxHeight = Math.max(...actors.map(a => a.heightM * poseVisibleFraction(a.pose)));
  const width = Math.max(...actors.map(a => a.positionM.x)) - Math.min(...actors.map(a => a.positionM.x)) + maxHeight * 0.4;
  const distanceM = Math.max(maxHeight * focal / (gateHeightMm * fraction), width * focal / (gateHeightMm * project.camera.outputAspect * fraction));
  const forward = { x: Math.sin(project.camera.yawDeg * Math.PI / 180) * Math.cos(project.camera.pitchDeg * Math.PI / 180), y: Math.sin(project.camera.pitchDeg * Math.PI / 180), z: Math.cos(project.camera.yawDeg * Math.PI / 180) * Math.cos(project.camera.pitchDeg * Math.PI / 180) };
  const positionM = subtract(target, scale(forward, distanceM));
  const look = lookAtPose(positionM, target);
  const focusDistanceM = distanceM;
  return { label: kind, actorIds: actors.map(a => a.id), camera: { ...look, rollDeg: 0, focalLengthMm: focal, focusDistanceM } };
}

function focusTarget(project: ProjectDocument): Vec3 {
  if (project.camera.focus.kind === 'actor') {
    const focusActorId = project.camera.focus.actorId;
    const actor = project.scene.actors.find(candidate => candidate.id === focusActorId);
    if (actor) return actorFocusPoint(actor);
  }
  const yaw = project.camera.yawDeg * Math.PI / 180;
  const pitch = project.camera.pitchDeg * Math.PI / 180;
  return add(project.camera.positionM, { x: 10 * Math.sin(yaw) * Math.cos(pitch), y: 10 * Math.sin(pitch), z: 10 * Math.cos(yaw) * Math.cos(pitch) });
}
function poseVisibleFraction(pose: Actor['pose']): number { return pose === 'sitting' ? 0.65 : 1; }
function boundsCenter(actors: Actor[]): Vec3 { return { x: actors.reduce((n, a) => n + a.positionM.x, 0) / actors.length, y: actors.reduce((n, a) => n + a.positionM.y + a.heightM * poseVisibleFraction(a.pose) / 2, 0) / actors.length, z: actors.reduce((n, a) => n + a.positionM.z, 0) / actors.length }; }
function distanceSquared(a: Vec3, b: Vec3): number { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function axialTo(target: Vec3, position: Vec3, yaw: number, pitch: number): number { const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180; const f = { x: Math.sin(y) * Math.cos(p), y: Math.sin(p), z: Math.cos(y) * Math.cos(p) }; return dot(subtract(target, position), f); }
function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function subtract(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function normalize(v: Vec3): Vec3 { const length = Math.hypot(v.x, v.y, v.z); if (!Number.isFinite(length) || length === 0) throw new RangeError('Direction vector must be non-zero and finite.'); return scale(v, 1 / length); }
function clamp(v: number, min: number, max: number): number { return Math.min(max, Math.max(min, v)); }
function smoothstep(t: number): number { return t * t * (3 - 2 * t); }
