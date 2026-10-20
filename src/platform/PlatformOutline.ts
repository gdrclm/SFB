import type { PlatformKind } from "../config/gameConfig";

interface PlatformOutlinePoint {
  readonly x: number;
  readonly y: number;
}

export function createPlatformOutline(
  kind: PlatformKind,
  width: number,
  height: number,
): readonly PlatformOutlinePoint[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  if (kind === "vitality") {
    return Array.from({ length: 20 }, (_, index) => {
      const angle = Math.PI / 2 - (index / 20) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      return {
        x:
          halfWidth *
          Math.sign(cosine) *
          Math.abs(cosine) ** 0.42,
        y:
          halfHeight *
          Math.sign(sine) *
          Math.abs(sine) ** 0.7,
      };
    });
  }

  if (kind === "time-slow") {
    return [
      { x: -halfWidth, y: 0 },
      { x: -halfWidth * 0.88, y: halfHeight * 0.58 },
      { x: -halfWidth * 0.6, y: halfHeight },
      { x: -halfWidth * 0.12, y: halfHeight * 0.86 },
      { x: halfWidth * 0.42, y: halfHeight },
      { x: halfWidth * 0.86, y: halfHeight * 0.54 },
      { x: halfWidth, y: 0 },
      { x: halfWidth * 0.84, y: -halfHeight * 0.56 },
      { x: halfWidth * 0.38, y: -halfHeight },
      { x: -halfWidth * 0.16, y: -halfHeight * 0.84 },
      { x: -halfWidth * 0.64, y: -halfHeight },
      { x: -halfWidth * 0.9, y: -halfHeight * 0.5 },
    ];
  }

  if (kind === "super-heavy") {
    return [
      { x: -halfWidth, y: halfHeight * 0.28 },
      { x: -halfWidth * 0.86, y: halfHeight * 0.78 },
      { x: -halfWidth * 0.62, y: halfHeight },
      { x: -halfWidth * 0.42, y: halfHeight * 0.76 },
      { x: -halfWidth * 0.12, y: halfHeight },
      { x: halfWidth * 0.1, y: halfHeight * 0.72 },
      { x: halfWidth * 0.46, y: halfHeight },
      { x: halfWidth * 0.72, y: halfHeight * 0.76 },
      { x: halfWidth, y: halfHeight * 0.22 },
      { x: halfWidth * 0.9, y: -halfHeight * 0.42 },
      { x: halfWidth * 0.66, y: -halfHeight },
      { x: halfWidth * 0.32, y: -halfHeight * 0.78 },
      { x: 0, y: -halfHeight },
      { x: -halfWidth * 0.3, y: -halfHeight * 0.76 },
      { x: -halfWidth * 0.7, y: -halfHeight },
      { x: -halfWidth * 0.92, y: -halfHeight * 0.38 },
    ];
  }

  return [
    { x: -halfWidth, y: halfHeight * 0.35 },
    { x: -halfWidth * 0.82, y: halfHeight },
    { x: -halfWidth * 0.42, y: halfHeight * 0.88 },
    { x: -halfWidth * 0.08, y: halfHeight },
    { x: halfWidth * 0.28, y: halfHeight * 0.9 },
    { x: halfWidth * 0.78, y: halfHeight },
    { x: halfWidth, y: halfHeight * 0.34 },
    { x: halfWidth * 0.95, y: -halfHeight * 0.38 },
    { x: halfWidth * 0.76, y: -halfHeight },
    { x: halfWidth * 0.3, y: -halfHeight * 0.88 },
    { x: -halfWidth * 0.06, y: -halfHeight },
    { x: -halfWidth * 0.48, y: -halfHeight * 0.86 },
    { x: -halfWidth * 0.84, y: -halfHeight },
    { x: -halfWidth, y: -halfHeight * 0.3 },
  ];
}
