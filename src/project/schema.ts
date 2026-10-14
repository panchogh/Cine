import type { Actor, EntityId, IndependentShotSnapshot, ProjectDocument, ProjectShot } from '../contracts';
import { LIMITS } from '../data/constraints';

export type { IndependentShotSnapshot } from '../contracts';

export interface PortableProjectV1 {
  format: 'cineoptics-project';
  formatVersion: 1;
  project: ProjectDocument;
  thumbnails: Array<{ id: EntityId; mimeType: string; dataBase64: string }>;
}

export interface ValidationIssue { path: string; message: string; }
export type ValidationResult = { ok: true; project: ProjectDocument } | { ok: false; issues: ValidationIssue[] };

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string';
const id = (v: unknown): v is string => text(v) && v.length > 0 && v.length <= 200;
const vector = (v: unknown): v is { x: number; y: number; z: number } => object(v) && finite(v.x) && finite(v.y) && finite(v.z);
const validActor = (v: unknown): v is Actor => object(v) && id(v.id) && text(v.name) && vector(v.positionM) && finite(v.heightM) && v.heightM > 0 && finite(v.yawDeg) && ['standing', 'sitting', 'walking'].includes(String(v.pose)) && text(v.color);
function validMotion(value: unknown): boolean {
  if (!object(value) || !['static', 'push_in', 'orbit', 'handheld'].includes(String(value.kind)) || !finite(value.durationS) || value.durationS < 0) return false;
  if (value.kind === 'push_in') return value.pushInDistanceM === undefined || (finite(value.pushInDistanceM) && value.pushInDistanceM >= 0);
  if (value.kind === 'orbit') return (value.orbitTargetM === undefined || vector(value.orbitTargetM)) && (value.orbitDegrees === undefined || finite(value.orbitDegrees));
  if (value.kind === 'handheld') {
    if (value.handheld === undefined) return true;
    const h = value.handheld;
    return object(h) && finite(h.translationM) && h.translationM >= 0 && finite(h.rotationDeg) && h.rotationDeg >= 0 && finite(h.frequencyHz) && h.frequencyHz >= 0 && (h.phaseRad === undefined || finite(h.phaseRad));
  }
  return true;
}

export function validateProject(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  if (!object(input)) return { ok: false, issues: [{ path: '$', message: 'Se esperaba un objeto de proyecto.' }] };
  if (input.schemaVersion !== 1) return { ok: false, issues: [{ path: 'schemaVersion', message: `Versión de esquema no soportada: ${String(input.schemaVersion)}.` }] };
  if (!id(input.id) || !text(input.name) || !text(input.createdAt) || !text(input.updatedAt)) fail('$', 'Faltan identidad, nombre o fechas válidas.');
  const scene = input.scene;
  if (!object(scene) || !Array.isArray(scene.actors) || scene.actors.length < 1 || scene.actors.length > 6) fail('scene.actors', 'Debe haber de 1 a 6 actores.');
  const actors = object(scene) && Array.isArray(scene.actors) ? scene.actors : [];
  actors.forEach((a, i) => {
    if (!validActor(a)) fail(`scene.actors[${i}]`, 'Actor inválido.');
    else if ([a.positionM.x, a.positionM.y, a.positionM.z].some(n => n < LIMITS.sceneCoordinateM.min || n > LIMITS.sceneCoordinateM.max) || a.heightM < LIMITS.actorHeightM.min || a.heightM > LIMITS.actorHeightM.max) fail(`scene.actors[${i}]`, 'Actor fuera de los rangos de escena admitidos.');
  });
  const actorIds = new Set(actors.filter(validActor).map(a => a.id as string));
  if (actorIds.size !== actors.length) fail('scene.actors', 'Los IDs de actor deben ser únicos.');
  if (object(scene) && (!text(scene.locationId) || !finite(scene.backgroundDistanceM) || scene.backgroundDistanceM <= 0)) fail('scene', 'Locación o distancia de fondo inválida.');
  const camera = input.camera;
  if (!object(camera)) fail('camera', 'Falta cámara.');
  else {
    const cameraPosition = camera.positionM;
    if (!vector(cameraPosition)) fail('camera.positionM', 'Vector inválido.');
    else if ([cameraPosition.x, cameraPosition.y, cameraPosition.z].some(n => n < LIMITS.sceneCoordinateM.min || n > LIMITS.sceneCoordinateM.max)) fail('camera.positionM', 'Posición fuera de los límites de escena.');
    for (const k of ['yawDeg', 'pitchDeg', 'rollDeg', 'focalLengthMm', 'outputAspect', 'squeeze', 'fNumber', 'circleOfConfusionMm']) if (!finite(camera[k])) fail(`camera.${k}`, 'Debe ser un número finito.');
    if (!object(camera.sensorGateMm) || !finite(camera.sensorGateMm.x) || !finite(camera.sensorGateMm.y) || camera.sensorGateMm.x <= 0 || camera.sensorGateMm.y <= 0) fail('camera.sensorGateMm', 'Gate inválido.');
    if (finite(camera.focalLengthMm) && (camera.focalLengthMm < LIMITS.focalLengthMm.min || camera.focalLengthMm > LIMITS.focalLengthMm.max)) fail('camera.focalLengthMm', 'Focal fuera del rango admitido.');
    if (finite(camera.outputAspect) && (camera.outputAspect < LIMITS.outputAspect.min || camera.outputAspect > LIMITS.outputAspect.max)) fail('camera.outputAspect', 'Aspecto fuera del rango admitido.');
    if (finite(camera.squeeze) && (camera.squeeze < LIMITS.squeeze.min || camera.squeeze > LIMITS.squeeze.max)) fail('camera.squeeze', 'Squeeze fuera del rango admitido.');
    if (finite(camera.fNumber) && (camera.fNumber < LIMITS.fNumber.min || camera.fNumber > LIMITS.fNumber.max)) fail('camera.fNumber', 'f-number fuera del rango admitido.');
    if (finite(camera.circleOfConfusionMm) && (camera.circleOfConfusionMm < LIMITS.circleOfConfusionMm.min || camera.circleOfConfusionMm > LIMITS.circleOfConfusionMm.max)) fail('camera.circleOfConfusionMm', 'CoC fuera del rango admitido.');
    if (object(camera.focus)) {
      if (camera.focus.kind === 'actor' && (!id(camera.focus.actorId) || !actorIds.has(camera.focus.actorId as string))) fail('camera.focus.actorId', 'Referencia de foco inexistente.');
      else if (camera.focus.kind === 'manual' && (!finite(camera.focus.distanceM) || camera.focus.distanceM < LIMITS.focusDistanceM.min || camera.focus.distanceM > LIMITS.focusDistanceM.max)) fail('camera.focus.distanceM', 'Distancia de foco fuera de rango.');
      else if (camera.focus.kind !== 'actor' && camera.focus.kind !== 'manual') fail('camera.focus.kind', 'Modo de foco desconocido.');
    } else fail('camera.focus', 'Falta modo de foco.');
    if (!validMotion(camera.motion)) fail('camera.motion', 'Movimiento o parámetros de movimiento inválidos.');
  }
  const look = input.look;
  if (!object(look) || !finite(look.ndStops) || !finite(look.grainPercent) || !finite(look.shutterAngleDeg) || !finite(look.frameRate)) fail('look', 'Ajustes de look inválidos.');
  else if (look.ndStops < 0 || look.ndStops > 16 || look.grainPercent < 0 || look.grainPercent > 100 || look.shutterAngleDeg <= 0 || look.shutterAngleDeg > 360 || look.frameRate <= 0 || look.frameRate > 240) fail('look', 'Ajustes de look fuera de rango.');
  if (!Array.isArray(input.shots)) fail('shots', 'Catálogo de planos inválido.');
  const shots = Array.isArray(input.shots) ? input.shots : [];
  const shotIds = new Set<string>();
  shots.forEach((shot, i) => {
    if (!object(shot) || !id(shot.id) || !text(shot.name) || !text(shot.notes) || !finite(shot.capturedAtS) || !object(shot.camera) || !Array.isArray(shot.actorIds)) { fail(`shots[${i}]`, 'Plano inválido.'); return; }
    if (shotIds.has(shot.id)) fail(`shots[${i}].id`, 'ID de plano duplicado.');
    shotIds.add(shot.id);
    if (shot.actorIds.some(aid => !id(aid))) fail(`shots[${i}].actorIds`, 'ID de actor inválido.');
    // Independent snapshots may retain actors removed from the current scene; legacy rows may not.
    const independent = shot as unknown as Partial<IndependentShotSnapshot>;
    const owned = independent.scene?.actors;
    const validRefs = Array.isArray(owned) ? new Set(owned.filter(validActor).map(a => a.id as string)) : actorIds;
    if (shot.actorIds.some(aid => !validRefs.has(aid as string))) fail(`shots[${i}].actorIds`, 'El plano referencia actores ausentes de su escena.');
    if ('snapshotVersion' in shot) {
      if (independent.snapshotVersion !== 1 || !Array.isArray(owned) || !independent.look) fail(`shots[${i}]`, 'Snapshot independiente inválido.');
      else {
        const ownedIds = new Set(owned.filter(validActor).map(a => a.id as string));
        if (ownedIds.size !== owned.length || shot.actorIds.length !== ownedIds.size) fail(`shots[${i}].scene.actors`, 'La escena del snapshot debe tener actores únicos y coincidir con sus IDs.');
        owned.forEach((actor, actorIndex) => {
          if (validActor(actor) && (actor.heightM < LIMITS.actorHeightM.min || actor.heightM > LIMITS.actorHeightM.max || [actor.positionM.x, actor.positionM.y, actor.positionM.z].some(n => n < LIMITS.sceneCoordinateM.min || n > LIMITS.sceneCoordinateM.max))) fail(`shots[${i}].scene.actors[${actorIndex}]`, 'Actor del snapshot fuera de rango.');
        });
        const shotCamera = shot.camera as unknown as Record<string, unknown>;
        if (!vector(shotCamera.positionM) || ['yawDeg', 'pitchDeg', 'rollDeg', 'focalLengthMm', 'outputAspect', 'squeeze', 'fNumber', 'circleOfConfusionMm'].some(k => !finite(shotCamera[k])) || !validMotion(shotCamera.motion)) fail(`shots[${i}].camera`, 'Cámara del snapshot inválida.');
        else {
          if (finite(shotCamera.focalLengthMm) && (shotCamera.focalLengthMm < LIMITS.focalLengthMm.min || shotCamera.focalLengthMm > LIMITS.focalLengthMm.max)) fail(`shots[${i}].camera.focalLengthMm`, 'Focal del snapshot fuera de rango.');
          const focus = shotCamera.focus;
          if (!object(focus) || (focus.kind === 'actor' && (!id(focus.actorId) || !ownedIds.has(focus.actorId))) || (focus.kind === 'manual' && (!finite(focus.distanceM) || focus.distanceM < LIMITS.focusDistanceM.min || focus.distanceM > LIMITS.focusDistanceM.max)) || (focus.kind !== 'actor' && focus.kind !== 'manual')) fail(`shots[${i}].camera.focus`, 'Modo o referencia de foco inválidos en snapshot.');
          const gate = shotCamera.sensorGateMm;
          if (!object(gate) || !finite(gate.x) || !finite(gate.y) || gate.x <= 0 || gate.y <= 0) fail(`shots[${i}].camera.sensorGateMm`, 'Gate del snapshot inválido.');
        }
      }
    }
  });
  if (issues.length) return { ok: false, issues };
  return { ok: true, project: structuredClone(input) as unknown as ProjectDocument };
}

export function isIndependentSnapshot(s: ProjectShot): s is IndependentShotSnapshot {
  const candidate = s as Partial<IndependentShotSnapshot>;
  return candidate.snapshotVersion === 1 && !!candidate.scene && !!candidate.look;
}
