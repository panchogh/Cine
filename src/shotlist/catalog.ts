import type { CameraDocument, EntityId, IndependentShotSnapshot, ProjectDocument, ProjectShot } from '../contracts';
import { entityId } from '../data/defaults';
import { isIndependentSnapshot } from '../project/schema';

export interface CaptureInput { camera: CameraDocument; capturedAtS: number; thumbnail?: Blob; name?: string; notes?: string; }
export interface CaptureResult { project: ProjectDocument; thumbnail: { id: EntityId; blob: Blob } | null; shot: IndependentShotSnapshot; }

/** Browser boundary check for generated thumbnails; call before storing a renderer Blob. */
export async function validateThumbnailBlob(blob: Blob, limits = { maxBytes: 2 * 1024 * 1024, maxWidth: 1280, maxHeight: 720 }): Promise<void> {
  if (blob.size > limits.maxBytes) throw new Error(`La miniatura supera ${limits.maxBytes} bytes.`);
  if (!/^image\/(png|jpeg|webp|avif)$/.test(blob.type)) throw new Error('La miniatura debe ser PNG, JPEG, WebP o AVIF.');
  if (typeof createImageBitmap !== 'function') throw new Error('Este entorno no permite verificar dimensiones de miniatura.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(blob); } catch { throw new Error('La miniatura no se pudo decodificar.'); }
  try {
    if (bitmap.width > limits.maxWidth || bitmap.height > limits.maxHeight) throw new Error(`La miniatura supera ${limits.maxWidth}×${limits.maxHeight} px.`);
  } finally { bitmap.close(); }
}

/** Capture owns only the state needed to reconstruct this shot; it never copies the shot catalog. */
export function captureShot(project: ProjectDocument, input: CaptureInput, makeId: () => EntityId = entityId): CaptureResult {
  if (!Number.isFinite(input.capturedAtS) || input.capturedAtS < 0) throw new Error('El tiempo de captura debe ser finito y no negativo.');
  if (input.thumbnail && (input.thumbnail.size > 2 * 1024 * 1024 || !/^image\/(png|jpeg|webp|avif)$/.test(input.thumbnail.type))) throw new Error('La miniatura debe ser PNG, JPEG, WebP o AVIF de hasta 2 MiB.');
  const shotId = makeId();
  const thumbnailId = input.thumbnail ? makeId() : null;
  const scene = structuredClone(project.scene);
  const shot: IndependentShotSnapshot = {
    id: shotId, name: input.name ?? `Plano ${project.shots.length + 1}`, notes: input.notes ?? '', capturedAtS: input.capturedAtS,
    camera: structuredClone(input.camera), actorIds: scene.actors.map(actor => actor.id), snapshotVersion: 1,
    scene, look: structuredClone(project.look), thumbnailId,
  };
  return { project: { ...project, shots: [...project.shots, shot], updatedAt: new Date().toISOString() }, shot,
    thumbnail: input.thumbnail && thumbnailId ? { id: thumbnailId, blob: input.thumbnail } : null };
}

/** Restore captured physical state while retaining current project identity and shot catalog. */
export function restoreShot(project: ProjectDocument, shotId: EntityId): ProjectDocument {
  const shot = project.shots.find(row => row.id === shotId);
  if (!shot) throw new Error(`No existe el plano ${shotId}.`);
  if (!isIndependentSnapshot(shot)) throw new Error('El plano antiguo no contiene una escena independiente; no se puede restaurar con fidelidad.');
  return { ...project, scene: structuredClone(shot.scene), camera: structuredClone(shot.camera), look: structuredClone(shot.look), updatedAt: new Date().toISOString() };
}

export function renameShot(project: ProjectDocument, shotId: EntityId, name: string): ProjectDocument {
  return updateShot(project, shotId, shot => ({ ...shot, name }));
}
export function setShotNotes(project: ProjectDocument, shotId: EntityId, notes: string): ProjectDocument {
  return updateShot(project, shotId, shot => ({ ...shot, notes }));
}
export function deleteShot(project: ProjectDocument, shotId: EntityId): ProjectDocument {
  if (!project.shots.some(shot => shot.id === shotId)) return project;
  return { ...project, shots: project.shots.filter(shot => shot.id !== shotId), updatedAt: new Date().toISOString() };
}
export function moveShot(project: ProjectDocument, shotId: EntityId, targetIndex: number): ProjectDocument {
  const from = project.shots.findIndex(shot => shot.id === shotId);
  if (from < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= project.shots.length || from === targetIndex) return project;
  const shots = [...project.shots]; const [shot] = shots.splice(from, 1); shots.splice(targetIndex, 0, shot);
  return { ...project, shots, updatedAt: new Date().toISOString() };
}
export function duplicateShot(project: ProjectDocument, shotId: EntityId, makeId: () => EntityId = entityId): ProjectDocument {
  const source = project.shots.find(shot => shot.id === shotId);
  if (!source) throw new Error(`No existe el plano ${shotId}.`);
  const copy = structuredClone(source);
  copy.id = makeId(); copy.name = `${source.name} copia`;
  // Thumbnail blobs are stored by asset ID, so duplicated rows reference the same immutable blob.
  const index = project.shots.indexOf(source);
  const shots = [...project.shots]; shots.splice(index + 1, 0, copy);
  return { ...project, shots, updatedAt: new Date().toISOString() };
}

function updateShot(project: ProjectDocument, shotId: EntityId, edit: (s: ProjectShot) => ProjectShot): ProjectDocument {
  if (!project.shots.some(s => s.id === shotId)) throw new Error(`No existe el plano ${shotId}.`);
  return { ...project, shots: project.shots.map(s => s.id === shotId ? edit(s) : s), updatedAt: new Date().toISOString() };
}
