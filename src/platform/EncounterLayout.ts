import type { PlatformEncounterTheme } from "./PlatformRoutePlanner";

const routes: Record<PlatformEncounterTheme, readonly number[]> = {
  "run-up": [-2.4, -2.1, -1.1, 1.8, 2.6, .8],
  breather: [-.6, .3, .8, -.2],
  climax: [1.8, -1.8, .8, -1.2],
  bait: [1.8, -.6, -1.8, .8],
  chaos: [-1.8, 1.5, -.3, 2.1, -1.1, .7],
  trap: [2.2, -1.8, 1.55, -2.2, .2, 2.1],
  deception: [-1.9, -.2, 2, -1.3, 1.3],
  "rich-lane": [-2.1, -.5, 1.7, 2.15, .2, -1.5],
  "danger-lane": [1.8, .6, -1.6, -2.05, 1.15],
  "death-tunnel": [-.8, .85, 1.7, .2, -1.5],
  "break-run": [-1.6, -.7, .7, 1.9, .3],
};
const rhythms: Record<PlatformEncounterTheme, readonly number[]> = {
  "run-up": [.9, 1, .8, 1.1, .85, 1.2],
  breather: [1.8, 2.1, 1.6],
  climax: [.85, 1.1, .7, 1.35],
  bait: [1.4, .8, 1.2, .9],
  chaos: [.75, 1.6, .95, 1.25, .65, 1.45],
  trap: [.85, 1.35, .7, 1.15, 1.65, .8],
  deception: [1.3, .75, 1.55, .9, 1.1],
  "rich-lane": [1.2, .85, .75, 1.55, .95],
  "danger-lane": [1.1, .7, 1.4, .9, 1.65],
  "death-tunnel": [1.2, .85, 1.1, .75, 1.4],
  "break-run": [.7, .85, 1.25, .65, 1.65],
};

export interface EncounterLayout {
  readonly passage: Readonly<{ x: number; width: number }>;
  readonly rhythm: number;
  readonly islands: readonly Readonly<{ x: number; width: number; depthFraction: number }>[];
}

/** A clear flight corridor through separate islands, never a full-width tiled wall. */
export function createEncounterLayout(
  theme: PlatformEncounterTheme, step: number, variant: number, count: number,
  halfWidth: number, radius: number, margin: number,
  tuning = { passageExtra: 0, routeScale: 1, movingAmplitude: 0 },
): EncounterLayout {
  const route = routes[theme], rhythm = rhythms[theme];
  const mirror = variant % 2 === 0 ? 1 : -1;
  const width = Math.max(radius * 2 + .7,
    theme === "rich-lane" || theme === "break-run" || theme === "run-up" || theme === "breather" ? 2.6 : theme === "death-tunnel" || theme === "danger-lane" ? 1.8 : 2.2) + tuning.passageExtra + tuning.movingAmplitude * 2;
  const edge = halfWidth - margin - tuning.movingAmplitude;
  const maximumCenter = Math.max(0, edge - width / 2 - 1.05);
  const x = Math.max(-maximumCenter, Math.min(maximumCenter, (route[step % route.length] ?? 0) * mirror * tuning.routeScale));
  const leftSpan = x - width / 2 + edge;
  const rightSpan = edge - x - width / 2;
  const broadGroup = theme === "run-up" || (step + variant) % 4 !== 1;
  const leftCount = count === 4 && broadGroup && Math.min(leftSpan, rightSpan) >= 1.6 ? 2
    : count === 1 ? (x > 0 ? 1 : 0)
    : Math.max(1, Math.min(count - 1, Math.round(count * leftSpan / (leftSpan + rightSpan))));
  const islands: { x: number; width: number; depthFraction: number }[] = [];
  for (const [side, start, span, amount] of [[-1, -edge, leftSpan, leftCount], [1, x + width / 2, rightSpan, count - leftCount]]) {
    if (side === undefined || start === undefined || span === undefined || amount === undefined || amount <= 0) continue;
    // Give one side a long ledge regularly, while its neighbours remain short.
    // A viewport change still never affects the width of a generated island.
    const broadSide = x === 0 ? (variant % 2 === 0 ? -1 : 1) : x > 0 ? -1 : 1;
    const broadIndex = side === broadSide && span >= (amount > 1 ? Math.max(3.2, (amount + 2.6) * .8) : 3.2) && broadGroup
      ? (step + variant) % amount : -1;
    const totalWeight = amount + (broadIndex >= 0 ? 2.6 : 0);
    let offset = 0;
    for (let i = 0; i < amount; i++) {
      const broad = i === broadIndex;
      const cell = span * (broad ? 3.6 : 1) / totalWeight;
      const index = islands.length;
      const variation = .5 + .5 * Math.sin(step * 2.13 + variant * 1.7 + index * 3.71);
      const islandWidth = Math.min(broad ? 5.4 : 2.25, Math.max(.8, cell * (broad ? .9 : .52 + .23 * variation)), cell - .12);
      // Alternating edge baffles close cell seams, without filling the corridor.
      const edgeBaffle = side < 0 ? i === 0 && (step + variant) % 3 !== 1
        : i === amount - 1 && (step + variant) % 3 !== 0;
      const center = edgeBaffle ? side * (halfWidth - .12 - tuning.movingAmplitude - islandWidth / 2) : start + offset + cell / 2;
      islands.push({
        x: center, width: islandWidth,
        depthFraction: ((index + step + variant) % 3) * .45,
      });
      offset += cell;
    }
  }
  return { passage: { x, width: width - tuning.movingAmplitude * 2 }, rhythm: rhythm[step % rhythm.length] ?? 1, islands };
}
