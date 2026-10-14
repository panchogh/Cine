import type { EntityId, ProjectDocument, ProjectRepository } from '../contracts';

/** Serializes manual and automatic writes through one queue and snapshots the asset map per request. */
export function createProjectSaveQueue(repository: Pick<ProjectRepository, 'saveWithAssets'>): (project: ProjectDocument, assets: ReadonlyMap<EntityId, Blob>) => Promise<{ savedAt: string }> {
  let tail: Promise<void> = Promise.resolve();
  return (project, incomingAssets) => {
    const assets = new Map(incomingAssets);
    const write = tail.then(() => repository.saveWithAssets(project, assets));
    tail = write.then(() => undefined, () => undefined);
    return write;
  };
}
