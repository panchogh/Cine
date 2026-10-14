/** Stable phase-1 import path; implementation and recovery policy live in storage.ts. */
export { projectRepository, createProjectRepository, createIndexedDbDatabase, MemoryProjectDatabase, ProjectStorageError } from './storage';
export type { RecoverableProjectRepository, ProjectDatabase, StoredProject } from './storage';
