import type { EntityId, ProjectDocument, ProjectRepository } from '../contracts';
import { validateProject } from './schema';
import { thumbnailIds, type ThumbnailAssets } from './portable';

export class ProjectStorageError extends Error {
  constructor(message: string, readonly code: 'unavailable' | 'quota' | 'corrupt' | 'invalid' | 'missing-asset' | 'unknown' = 'unknown', options?: ErrorOptions) { super(message, options); this.name = 'ProjectStorageError'; }
}
export interface StoredProject { project: ProjectDocument; savedAt: string; assets: Map<EntityId, Blob>; }
export interface ProjectDatabase {
  read(id: EntityId): Promise<StoredProject | null>;
  write(record: StoredProject): Promise<void>;
}
export interface RecoverableProjectRepository extends ProjectRepository {
  saveWithAssets(project: ProjectDocument, assets?: ThumbnailAssets): Promise<{ savedAt: string }>;
  loadWithAssets(id: EntityId): Promise<{ project: ProjectDocument; assets: Map<EntityId, Blob>; recovered: boolean } | null>;
}

export function createProjectRepository(db: ProjectDatabase = createIndexedDbDatabase()): RecoverableProjectRepository {
  const saveWithAssets = async (project: ProjectDocument, incoming: ThumbnailAssets = new Map()) => {
      const result = validateProject(project);
      if (!result.ok) throw new ProjectStorageError(`Proyecto inválido: ${result.issues.map(i => `${i.path}: ${i.message}`).join('; ')}`, 'invalid');
      // Preserve existing assets when the caller saves only a project edit. Asset IDs are immutable.
      const existing = await db.read(project.id).catch(() => null);
      const assets = new Map(existing?.assets ?? []);
      for (const [id, blob] of incoming) assets.set(id, blob);
      const referenced = thumbnailIds(result.project);
      for (const id of referenced) if (!assets.has(id)) throw new ProjectStorageError(`Falta la miniatura referenciada ${id}.`, 'missing-asset');
      for (const id of [...assets.keys()]) if (!referenced.has(id)) assets.delete(id);
      const savedAt = new Date().toISOString();
      try { await db.write({ project: result.project, savedAt, assets }); }
      catch (error) { throw mapStorageError(error); }
      // Confirmation is emitted only after the database transaction's complete event.
      return { savedAt };
    };
  const loadWithAssets = async (id: EntityId) => {
      let record: StoredProject | null;
      try { record = await db.read(id); }
      catch (error) { throw mapStorageError(error); }
      if (!record) return null;
      const current = validateProject(record.project);
      const assetsValid = current.ok && [...thumbnailIds(current.project)].every(assetId => record!.assets.has(assetId));
      if (current.ok && assetsValid) return { project: current.project, assets: record.assets, recovered: false };
      // IndexedDB implementations may provide a prior valid transaction through readRecovery.
      const recoveryDb = db as ProjectDatabase & { readRecovery?: (id: EntityId) => Promise<StoredProject | null> };
      const backup = await recoveryDb.readRecovery?.(id);
      const backupResult = backup && validateProject(backup.project);
      if (backup && backupResult?.ok && [...thumbnailIds(backupResult.project)].every(assetId => backup.assets.has(assetId))) {
        return { project: backupResult.project, assets: backup.assets, recovered: true };
      }
      throw new ProjectStorageError('El proyecto guardado está corrupto y no hay una versión válida recuperable.', 'corrupt');
    };
  return {
    save: project => saveWithAssets(project),
    saveWithAssets,
    load: async id => (await loadWithAssets(id))?.project ?? null,
    loadWithAssets,
  };
}

function mapStorageError(error: unknown): ProjectStorageError {
  if (error instanceof ProjectStorageError) return error;
  const name = error instanceof DOMException ? error.name : (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return new ProjectStorageError('No hay cuota local suficiente; se conserva el último guardado válido.', 'quota', { cause: error });
  if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError') return new ProjectStorageError('El almacenamiento local está bloqueado o no disponible.', 'unavailable', { cause: error });
  if (error instanceof Error && error.message.includes('IndexedDB no está disponible')) return new ProjectStorageError(error.message, 'unavailable', { cause: error });
  return new ProjectStorageError('Falló el almacenamiento local; no se confirmó el guardado.', 'unknown', { cause: error });
}

export function createIndexedDbDatabase(name = 'cineoptics-local', factory: IDBFactory | undefined = globalThis.indexedDB): ProjectDatabase & { readRecovery(id: EntityId): Promise<StoredProject | null> } {
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    if (!factory) { reject(new Error('IndexedDB no está disponible en este entorno.')); return; }
    let request: IDBOpenDBRequest;
    try { request = factory.open(name, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'project.id' });
      if (!db.objectStoreNames.contains('recovery')) db.createObjectStore('recovery', { keyPath: 'project.id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
    request.onblocked = () => reject(new Error('Apertura de IndexedDB bloqueada por otra conexión.'));
  });
  const get = async (store: 'projects' | 'recovery', id: EntityId): Promise<StoredProject | null> => {
    const database = await open();
    try { return await new Promise((resolve, reject) => {
      const tx = database.transaction(store, 'readonly'); const request = tx.objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result ? hydrate(request.result) : null);
      request.onerror = () => reject(request.error ?? new Error('Lectura IndexedDB fallida.'));
      tx.onabort = () => reject(tx.error ?? new Error('Lectura IndexedDB abortada.'));
    }); } finally { database.close(); }
  };
  return {
    read: id => get('projects', id), readRecovery: id => get('recovery', id),
    async write(record) {
      const database = await open();
      try { await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(['projects', 'recovery'], 'readwrite');
        const projects = tx.objectStore('projects'); const recovery = tx.objectStore('recovery');
        const previous = projects.get(record.project.id);
        previous.onsuccess = () => {
          if (previous.result && validateProject(previous.result.project).ok) recovery.put(previous.result);
          projects.put(dehydrate(record));
        };
        previous.onerror = () => tx.abort();
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('Transacción IndexedDB abortada.'));
        tx.onerror = () => reject(tx.error ?? new Error('Transacción IndexedDB fallida.'));
      }); } finally { database.close(); }
    },
  };
}
function dehydrate(record: StoredProject): StoredProject { return { ...record, assets: new Map(record.assets) }; }
function hydrate(record: StoredProject): StoredProject { return { ...record, assets: new Map(record.assets) }; }

/** Small deterministic database for fixtures and non-browser integration tests. */
export class MemoryProjectDatabase implements ProjectDatabase {
  private current = new Map<EntityId, StoredProject>(); private recovery = new Map<EntityId, StoredProject>();
  failNextWrite: Error | null = null;
  corruptNextRead = false;
  async read(id: EntityId): Promise<StoredProject | null> {
    if (this.corruptNextRead) { this.corruptNextRead = false; return { project: '{' as unknown as ProjectDocument, savedAt: '', assets: new Map() }; }
    const row = this.current.get(id); return row ? cloneStored(row) : null;
  }
  async readRecovery(id: EntityId): Promise<StoredProject | null> { const row = this.recovery.get(id); return row ? cloneStored(row) : null; }
  async write(record: StoredProject): Promise<void> {
    if (this.failNextWrite) { const error = this.failNextWrite; this.failNextWrite = null; throw error; }
    const previous = this.current.get(record.project.id);
    if (previous && validateProject(previous.project).ok) this.recovery.set(record.project.id, cloneStored(previous));
    this.current.set(record.project.id, cloneStored(record));
  }
}
function cloneStored(record: StoredProject): StoredProject { return { ...record, project: structuredClone(record.project), assets: new Map(record.assets) }; }

export const projectRepository: RecoverableProjectRepository = createProjectRepository();
