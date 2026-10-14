import type { EntityId, ProjectDocument } from '../contracts';
import type { PortableProjectV1 } from './schema';
import { validateProject } from './schema';

export type ThumbnailAssets = ReadonlyMap<EntityId, Blob>;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export async function serializePortableProject(project: ProjectDocument, assets: ThumbnailAssets = new Map()): Promise<Blob> {
  const validated = validateProject(project);
  if (!validated.ok) throw new Error(`Proyecto inválido: ${validated.issues.map(i => `${i.path}: ${i.message}`).join('; ')}`);
  const referenced = thumbnailIds(project);
  const thumbnails = [];
  for (const id of referenced) {
    const blob = assets.get(id);
    if (!blob) throw new Error(`Falta la miniatura ${id}; no se generó una exportación incompleta.`);
    thumbnails.push({ id, mimeType: blob.type || 'application/octet-stream', dataBase64: await blobToBase64(blob) });
  }
  const portable: PortableProjectV1 = { format: 'cineoptics-project', formatVersion: 1, project: validated.project, thumbnails };
  return new Blob([JSON.stringify(portable)], { type: 'application/vnd.cineoptics.project+json' });
}

export async function deserializePortableProject(input: Blob | string | unknown, maxBytes = DEFAULT_MAX_BYTES): Promise<{ project: ProjectDocument; assets: Map<EntityId, Blob> }> {
  let parsed: unknown;
  if (input instanceof Blob) {
    if (input.size > maxBytes) throw new Error(`Archivo demasiado grande (${input.size} bytes; límite ${maxBytes}).`);
    parsed = JSON.parse(await input.text());
  } else if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > maxBytes) throw new Error(`Archivo demasiado grande (límite ${maxBytes} bytes).`);
    try { parsed = JSON.parse(input); } catch { throw new Error('JSON corrupto o truncado.'); }
  } else parsed = input;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Formato de proyecto inválido.');
  const data = parsed as Record<string, unknown>;
  if (data.format !== 'cineoptics-project') throw new Error('El archivo no es un proyecto CineOptics portable.');
  if (data.formatVersion !== 1) throw new Error(`Versión portable no soportada: ${String(data.formatVersion)}.`);
  const validation = validateProject(data.project);
  if (!validation.ok) throw new Error(`Proyecto rechazado: ${validation.issues.map(i => `${i.path}: ${i.message}`).join('; ')}`);
  if (!Array.isArray(data.thumbnails)) throw new Error('Catálogo de miniaturas inválido.');
  const assets = new Map<EntityId, Blob>();
  for (const item of data.thumbnails) {
    if (typeof item !== 'object' || item === null) throw new Error('Registro de miniatura inválido.');
    const asset = item as Record<string, unknown>;
    if (typeof asset.id !== 'string' || typeof asset.mimeType !== 'string' || !/^image\/(png|jpeg|webp|avif)$/.test(asset.mimeType) || typeof asset.dataBase64 !== 'string' || assets.has(asset.id as EntityId)) throw new Error('Registro de miniatura inválido o duplicado.');
    const blob = base64ToBlob(asset.dataBase64, asset.mimeType);
    assets.set(asset.id as EntityId, blob);
  }
  const wanted = thumbnailIds(validation.project);
  if (wanted.size !== assets.size || [...wanted].some(id => !assets.has(id))) throw new Error('Las miniaturas no coinciden con las referencias del proyecto.');
  return { project: validation.project, assets };
}

export function thumbnailIds(project: ProjectDocument): Set<EntityId> {
  const ids = new Set<EntityId>();
  for (const shot of project.shots) {
    const id = (shot as { thumbnailId?: EntityId | null }).thumbnailId;
    if (id) ids.add(id);
  }
  return ids;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToBlob(encoded: string, mimeType: string): Blob {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Miniatura corrupta: Base64 inválido.');
  const binary = atob(encoded); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
