import type { EvaluatedCamera, FocusMode, ProjectDocument, Vec3 } from '../contracts';
import { LIMITS } from '../data/constraints';
import { actorFocusPoint, axialDistanceM } from './geometry';

export interface DepthOfFieldInput { focalLengthMm: number; fNumber: number; circleOfConfusionMm: number; focusDistanceM: number }
export interface DepthOfField { hyperfocalDistanceM: number; nearLimitM: number; farLimitM: number; farIsInfinity: boolean }
export interface FocusResult { mode: FocusMode['kind']; targetPointM: Vec3 | null; axialDistanceM: number; tapeDistanceM: number | null; warning?: string }

/** Thin-lens, paraxial DoF approximation. f, CoC and focus are converted to mm before calculation. */
export function depthOfField(input: DepthOfFieldInput): DepthOfField {
  positive('focalLengthMm', input.focalLengthMm);
  positive('fNumber', input.fNumber);
  positive('circleOfConfusionMm', input.circleOfConfusionMm);
  positive('focusDistanceM', input.focusDistanceM);
  supported('focalLengthMm', input.focalLengthMm, LIMITS.focalLengthMm.min, LIMITS.focalLengthMm.max);
  supported('fNumber', input.fNumber, LIMITS.fNumber.min, LIMITS.fNumber.max);
  supported('circleOfConfusionMm', input.circleOfConfusionMm, LIMITS.circleOfConfusionMm.min, LIMITS.circleOfConfusionMm.max);
  supported('focusDistanceM', input.focusDistanceM, LIMITS.focusDistanceM.min, LIMITS.focusDistanceM.max);
  const f = input.focalLengthMm;
  const H = f * f / (input.fNumber * input.circleOfConfusionMm) + f;
  const subjectMm = input.focusDistanceM * 1000;
  // With H=f²/(N·c)+f, these exact thin-lens forms put infinity at S=H.
  const nearDenominator = H + subjectMm - 2 * f;
  const farDenominator = H - subjectMm;
  const nearMm = H * subjectMm / nearDenominator;
  const farIsInfinity = farDenominator <= 0;
  const result = {
    hyperfocalDistanceM: H / 1000,
    nearLimitM: Math.max(0, nearMm / 1000),
    farLimitM: farIsInfinity ? Infinity : farDenominator > 0 ? H * subjectMm / farDenominator / 1000 : Infinity,
    farIsInfinity,
  };
  if (![result.hyperfocalDistanceM, result.nearLimitM].every(Number.isFinite) || (!result.farIsInfinity && !Number.isFinite(result.farLimitM))) throw new RangeError('DoF result exceeded supported numeric precision.');
  return result;
}

/** Geometric aperture is f-number; this module intentionally has no T-stop substitution. */
export function entrancePupilDiameterMm(focalLengthMm: number, fNumber: number): number {
  positive('focalLengthMm', focalLengthMm); positive('fNumber', fNumber);
  return focalLengthMm / fNumber;
}

/** Axial focus plane through the pose-aware subject point; tape distance is reported separately. */
export function resolveFocus(project: ProjectDocument, camera: EvaluatedCamera): FocusResult {
  const focus = project.camera.focus;
  if (focus.kind === 'manual') {
    const d = focus.distanceM;
    return { mode: 'manual', targetPointM: null, axialDistanceM: d, tapeDistanceM: d };
  }
  const actor = project.scene.actors.find(candidate => candidate.id === focus.actorId);
  if (!actor) return { mode: 'actor', targetPointM: null, axialDistanceM: camera.focusDistanceM, tapeDistanceM: null, warning: 'Focus actor is missing; retaining evaluated manual distance.' };
  const point = actorFocusPoint(actor);
  const axial = axialDistanceM(point, camera);
  const tape = Math.hypot(point.x - camera.positionM.x, point.y - camera.positionM.y, point.z - camera.positionM.z);
  if (axial <= 0) return { mode: 'actor', targetPointM: point, axialDistanceM: axial, tapeDistanceM: tape, warning: 'Focus target is on or behind the camera plane.' };
  return { mode: 'actor', targetPointM: point, axialDistanceM: axial, tapeDistanceM: tape };
}

function positive(name: string, value: number): void { if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and greater than zero.`); }
function supported(name: string, value: number, min: number, max: number): void { if (value < min || value > max) throw new RangeError(`${name} is outside the supported CineOptics range [${min}, ${max}].`); }
