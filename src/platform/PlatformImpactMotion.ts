export const PLATFORM_IMPACT_SECONDS = .45;
const REST = Object.freeze({ y: 0, rotation: 0 });

/** Shared contact kick for rock, cloud and bubble artwork; collision bodies stay fixed. */
export function platformImpactMotion(age: number, force: number, reduced = false): Readonly<{ y: number; rotation: number }> {
  if (reduced || !Number.isFinite(age) || age < 0 || age >= PLATFORM_IMPACT_SECONDS) return REST;
  const weight = Number.isFinite(force) ? Math.max(.7, Math.min(1.8, force)) : 1;
  return {
    y: -.25 * weight * Math.exp(-9 * age) * Math.sin(age * 27),
    rotation: .025 * weight * Math.exp(-11 * age) * Math.sin(age * 23),
  };
}
