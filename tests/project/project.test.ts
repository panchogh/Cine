import { describe, expect, it, vi } from 'vitest';
import { entityId } from '../../src/data/defaults';
import { fixtureProject } from '../fixtures/project';
import type { ProjectDocument } from '../../src/contracts';
import { captureShot, deleteShot, duplicateShot, moveShot, restoreShot, setShotNotes, validateThumbnailBlob } from '../../src/shotlist/catalog';
import { createObjectUrlLease, exportShotCsv, parseCsv } from '../../src/shotlist/csv';
import { deserializePortableProject, serializePortableProject } from '../../src/project/portable';
import { MemoryProjectDatabase, createProjectRepository, ProjectStorageError } from '../../src/project/storage';
import { isIndependentSnapshot, validateProject } from '../../src/project/schema';

function sixActors(): ProjectDocument {
  const actors = Array.from({ length: 6 }, (_, i) => ({ ...fixtureProject.scene.actors[0], id: entityId(`v21-actor-${i}`), name: `Actor ${i}, "${i}"\nÑ` }));
  return { ...fixtureProject, scene: { ...fixtureProject.scene, actors }, camera: { ...fixtureProject.camera, focus: { kind: 'actor', actorId: actors[0].id } }, shots: [] };
}
function captured(project: ProjectDocument, seed: string, time: number, name = seed) {
  let n = 0;
  return captureShot(project, { camera: { ...project.camera, focalLengthMm: 25 + time }, capturedAtS: time, name }, () => entityId(`${seed}-${n++}`));
}

describe('D shot catalog, persistence, portable project and CSV', () => {
  it('V21 round-trips six actors, three independent shots, IDs, order, notes and thumbnail', async () => {
    const source = sixActors();
    const a = captured(source, 'v21-a', 0.5, 'Toma, uno');
    const b = captured(a.project, 'v21-b', 1.5, 'Toma "dos"');
    const c = captured(b.project, 'v21-c', 2.5, 'Toma tres');
    let project = setShotNotes(c.project, c.shot.id, 'línea 1\nlínea 2');
    project = moveShot(project, a.shot.id, 2);
    const thumbnail = new Blob([new Uint8Array([0, 1, 2, 255])], { type: 'image/png' });
    const thumbShot = captured(project, 'v21-thumb', 3.5);
    const withThumb = captureShot(thumbShot.project, { camera: thumbShot.shot.camera, capturedAtS: 4, thumbnail }, () => entityId('v21-thumb-asset'));
    const portable = await serializePortableProject(withThumb.project, new Map([[entityId('v21-thumb-asset'), thumbnail]]));
    const imported = await deserializePortableProject(portable);
    expect(imported.project.scene.actors).toHaveLength(6);
    expect(imported.project.shots.map(s => s.id)).toEqual(withThumb.project.shots.map(s => s.id));
    expect(imported.project.shots.map(s => s.name)).toEqual(withThumb.project.shots.map(s => s.name));
    expect(imported.project.shots.find(s => s.id === c.shot.id)?.notes).toBe('línea 1\nlínea 2');
    const importedLast = imported.project.shots.at(-1)!;
    expect(isIndependentSnapshot(importedLast) && importedLast.scene.actors).toHaveLength(6);
    expect([...imported.assets.values()][0].size).toBe(4);
  });

  it('V22 confirms only completed writes and recovers the last valid local version', async () => {
    const db = new MemoryProjectDatabase(); const repo = createProjectRepository(db); const p = sixActors();
    const first = await repo.save(p);
    expect((await repo.loadWithAssets(p.id))?.recovered).toBe(false);
    const updated = { ...p, name: 'saved second' };
    await repo.save(updated);
    db.corruptNextRead = true;
    const recovered = await repo.loadWithAssets(p.id);
    expect(recovered?.recovered).toBe(true);
    expect(recovered?.project.name).toBe(p.name);
    expect(first.savedAt).toBeTruthy();
    db.failNextWrite = Object.assign(new Error('disk full'), { name: 'QuotaExceededError' });
    await expect(repo.save({ ...p, name: 'not committed' })).rejects.toMatchObject({ code: 'quota' });
    expect((await repo.load(p.id))?.name).toBe('saved second');
  });

  it('V23 rejects future schemas, truncation, bad references and invalid ranges before save', async () => {
    const p = sixActors();
    expect(validateProject({ ...p, schemaVersion: 2 }).ok).toBe(false);
    await expect(deserializePortableProject('{"format":"cineoptics-project"')).rejects.toThrow(/corrupto o truncado/);
    await expect(deserializePortableProject({ format: 'cineoptics-project', formatVersion: 9, project: p, thumbnails: [] })).rejects.toThrow(/no soportada/);
    const brokenRef = { ...p, camera: { ...p.camera, focus: { kind: 'actor', actorId: entityId('missing') } } };
    expect(validateProject(brokenRef).ok).toBe(false);
    expect(validateProject({ ...p, camera: { ...p.camera, focalLengthMm: Number.NaN } }).ok).toBe(false);
    expect(validateProject({ ...p, camera: { ...p.camera, focalLengthMm: 500 } }).ok).toBe(false);
    const db = new MemoryProjectDatabase(); const repo = createProjectRepository(db); await repo.save(p);
    db.failNextWrite = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    await expect(repo.save({ ...p, name: 'bad' })).rejects.toBeInstanceOf(ProjectStorageError);
    expect((await repo.load(p.id))?.name).toBe(p.name);
  });

  it('V24 keeps literal text intact and exports quoted, formula-neutral CSV that parses back', async () => {
    const p = sixActors(); const input = captured(p, 'v24', 1, '=1+1');
    const project = setShotNotes(input.project, input.shot.id, 'coma, comillas " y salto\nacentos ñ');
    const text = await exportShotCsv(project).text();
    const parsed = parseCsv(text);
    expect(parsed[1][1]).toBe("'=1+1");
    expect(parsed[1][2]).toBe("coma, comillas \" y salto\nacentos ñ");
    expect(parsed[1]).toHaveLength(parsed[0].length);
    expect(project.shots[0].name).toBe('=1+1');
    expect(() => parseCsv('a,"trunc')).toThrow(/truncado/);
    expect(() => parseCsv('"quoted"suffix')).toThrow(/tras comilla/);
  });

  it('V25 capture snapshots do not alias scene or catalog; CRUD IDs stay stable and deletion prunes assets on save', async () => {
    const p = sixActors(); const thumbnail = new Blob(['png'], { type: 'image/png' }); let idCount = 0;
    const first = captureShot(p, { camera: p.camera, capturedAtS: 1, thumbnail }, () => entityId(`v25-${idCount++}`));
    const modified = { ...first.project, scene: { ...first.project.scene, actors: first.project.scene.actors.map(a => ({ ...a, name: 'changed' })) } };
    expect((first.shot.scene.actors[0].name)).not.toBe(modified.scene.actors[0].name);
    const duplicated = duplicateShot(first.project, first.shot.id, () => entityId(`v25-${idCount++}`));
    expect(duplicated.shots[1].id).not.toBe(first.shot.id);
    const restored = restoreShot(modified, first.shot.id);
    expect(restored.scene.actors[0].name).toBe(first.shot.scene.actors[0].name);
    const db = new MemoryProjectDatabase(); const repo = createProjectRepository(db);
    await repo.saveWithAssets(first.project, new Map([[first.thumbnail!.id, thumbnail]]));
    await repo.save(deleteShot(first.project, first.shot.id));
    expect((await repo.loadWithAssets(first.project.id))?.assets.size).toBe(0);
  });

  it('V26 limits thumbnail size and portable imports require every referenced asset', async () => {
    const large = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' });
    expect(() => captureShot(sixActors(), { camera: fixtureProject.camera, capturedAtS: 0, thumbnail: large })).toThrow(/2 MiB/);
    const decode = vi.fn(async () => ({ width: 1281, height: 720, close: vi.fn() } as unknown as ImageBitmap));
    vi.stubGlobal('createImageBitmap', decode);
    await expect(validateThumbnailBlob(new Blob(['x'], { type: 'image/png' }))).rejects.toThrow(/1280×720/);
    vi.unstubAllGlobals();
    const image = new Blob(['small'], { type: 'image/png' });
    const project = sixActors();
    const snap = captureShot(project, { camera: { ...project.camera, focus: { kind: 'actor', actorId: project.scene.actors[0].id } }, capturedAtS: 0, thumbnail: image }, () => entityId('v26-asset'));
    await expect(serializePortableProject(snap.project)).rejects.toThrow(/Falta la miniatura/);
    const revoked: string[] = []; let next = 0;
    const lease = createObjectUrlLease({ createObjectURL: () => `blob:${++next}`, revokeObjectURL: url => revoked.push(url) });
    lease.replace(image); lease.replace(image); lease.dispose(); lease.dispose();
    expect(revoked).toEqual(['blob:1', 'blob:2']);
  });
});
