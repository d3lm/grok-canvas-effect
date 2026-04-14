export const LOGO_RATIO = 2.08;

export const LOGO_LAYOUT = {
  heightRatio: 0.5,
  edgePadding: 263,
  maxOffset: 0.3,
} as const;

export const QUALITY_ADAPTATION = {
  minScale: 0.5,
  maxScale: 1,
  step: 0.1,
  lowFpsThreshold: 30,
  highFpsThreshold: 55,
  updateIntervalMs: 2000,
} as const;
