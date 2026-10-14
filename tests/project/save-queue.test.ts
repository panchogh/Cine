import { describe, expect, it, vi } from 'vitest';
import type { EntityId, ProjectRepository } from '../../src/contracts';
import { createProjectSaveQueue } from '../../src/project/save-queue';
import { entityId } from '../../src/data/defaults';
import { fixtureProject } from '../fixtures/project';

describe('central project save queue', () => {
  it('serializes writes and snapshots the asset map for each request', async () => {
    let releaseFirst!: () => void;
    let signalFirstStarted!: () => void;
    const firstWrite = new Promise<void>(resolve => { releaseFirst = resolve; });
    const firstStarted = new Promise<void>(resolve => { signalFirstStarted = resolve; });
    const seen: Array<{ name: string; assets: ReadonlyMap<EntityId, Blob> }> = [];
    const saveWithAssets: ProjectRepository['saveWithAssets'] = vi.fn(async (project, assets = new Map()) => {
      seen.push({ name: project.name, assets });
      if (seen.length === 1) { signalFirstStarted(); await firstWrite; }
      return { savedAt: 'saved' };
    });
    const queue = createProjectSaveQueue({ saveWithAssets });
    const id = entityId('save-queue-asset'); const blob = new Blob(['asset'], { type: 'image/png' });
    const mutableAssets = new Map([[id, blob]]);
    const first = queue(fixtureProject, mutableAssets);
    mutableAssets.clear();
    const second = queue({ ...fixtureProject, name: 'Manual save' }, new Map());
    await firstStarted;
    expect(seen.map(item => item.name)).toEqual([fixtureProject.name]);
    expect(seen[0]!.assets.get(id)).toBe(blob);
    releaseFirst();
    await Promise.all([first, second]);
    expect(seen.map(item => item.name)).toEqual([fixtureProject.name, 'Manual save']);
  });

  it('continues after one failed write', async () => {
    const saveWithAssets: ProjectRepository['saveWithAssets'] = vi.fn()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce({ savedAt: 'saved' });
    const queue = createProjectSaveQueue({ saveWithAssets });
    await expect(queue(fixtureProject, new Map())).rejects.toThrow('blocked');
    await expect(queue(fixtureProject, new Map())).resolves.toEqual({ savedAt: 'saved' });
  });
});
