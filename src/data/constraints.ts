export const LIMITS = {
  actors: { min: 1, max: 6 },
  focalLengthMm: { min: 12, max: 250 },
  focusDistanceM: { min: 0.35, max: 30 },
  actorHeightM: { min: 1.45, max: 2.02 },
  sceneCoordinateM: { min: -50, max: 50 },
  fNumber: { min: 0.7, max: 32 },
  circleOfConfusionMm: { min: 0.008, max: 0.05 },
  outputAspect: { min: 0.25, max: 4 },
  squeeze: { min: 1, max: 2 },
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
