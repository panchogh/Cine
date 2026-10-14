import type { Vec2 } from '../contracts/types';

/** Generic active gates, not manufacturer calibration claims. */
export const SENSOR_GATES_MM: Readonly<Record<string, Vec2>> = {
  'full-frame': { x: 36, y: 24 },
  'super-35': { x: 24.89, y: 18.66 },
  'super-16': { x: 12.52, y: 7.41 },
};
