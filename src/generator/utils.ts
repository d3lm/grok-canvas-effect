import type { BlueRadialControl } from '../textureGen';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function pointStyle(px: number, py: number): React.CSSProperties {
  return {
    left: `${px * 100}%`,
    top: `${py * 100}%`,
  };
}

export function distanceToPoint(x0: number, y0: number, x1: number, y1: number): number {
  return Math.hypot(x0 - x1, y0 - y1);
}

export function radiusToUnitX(radius: number, width: number, height: number): number {
  const minDim = Math.max(1, Math.min(width, height));
  return (radius * minDim) / Math.max(1, width);
}

export function radiusToUnitY(radius: number, width: number, height: number): number {
  const minDim = Math.max(1, Math.min(width, height));
  return (radius * minDim) / Math.max(1, height);
}

export function radiusToPercent(radius: number, width: number, height: number): number {
  return radiusToUnitX(radius, width, height) * 100;
}

export function radiusToPercentY(radius: number, width: number, height: number): number {
  return radiusToUnitY(radius, width, height) * 100;
}

export function distanceToBlueCenter(
  px: number,
  py: number,
  radial: BlueRadialControl,
  width: number,
  height: number,
): number {
  const dx = (px - radial.centerX) * width;
  const dy = (py - radial.centerY) * height;
  const minDim = Math.max(1, Math.min(width, height));

  return Math.hypot(dx, dy) / minDim;
}
