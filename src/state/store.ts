import type { AppAction, AppState } from '../contracts';
import { reduceAppState } from './reducer';

export type Unsubscribe = () => void;
export interface Store {
  getState(): AppState;
  dispatch(action: AppAction): void;
  subscribe(listener: (state: AppState) => void): Unsubscribe;
}

export function createStore(initialState: AppState): Store {
  let state = initialState;
  const listeners = new Set<(state: AppState) => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduceAppState(state, action);
      if (next === state) return;
      state = next;
      listeners.forEach(listener => listener(state));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
