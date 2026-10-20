import { advanceMission, currentMission, MISSION_REWARD, type MissionEvent, type MissionState } from "../run/Missions";
import type { GameConfig } from "../config/gameConfig";
import type { RunResult } from "../run/RunHistory";
import { migrateMissionBoard, parseMissionBoard, type MissionBoard } from "../run/MissionBoard";

export type ShopCategory = "upgrade" | "ball" | "world" | "props" | "vfx";
export interface ShopItem {
  readonly id: string;
  readonly category: ShopCategory;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly maxLevel?: number;
  readonly preview: string;
}
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: "combo-charge", category: "upgrade", name: "Заряд BOOST", description: "Серия для заряда: 6 → 5 → 4 пробития. Ошибка по-прежнему сбрасывает прогресс.", price: 100, maxLevel: 2, preview: "×ϟ" },
  { id: "energy", category: "upgrade", name: "Запас энергии", description: "+5 стартовой энергии за уровень.", price: 25, maxLevel: 5, preview: "ϟ" },
  { id: "coin-energy", category: "upgrade", name: "Энергия монет", description: "+1 энергии за монету за уровень.", price: 40, maxLevel: 3, preview: "★ϟ" },
  { id: "ball-classic", category: "ball", name: "Классический", description: "Белый шар с голубыми деталями.", price: 0, preview: "●" },
  { id: "ball-gold", category: "ball", name: "Золотой", description: "Тёплое золотое свечение шара.", price: 50, preview: "●" },
  { id: "ball-mint", category: "ball", name: "Мятный", description: "Бирюзовый шар с прохладным свечением.", price: 50, preview: "●" },
  { id: "world-sky", category: "world", name: "Ясное небо", description: "Знакомое голубое небо.", price: 0, preview: "☁" },
  { id: "world-sunset", category: "world", name: "Закат", description: "Персиковый горизонт и фиолетовое небо.", price: 80, preview: "☀" },
  { id: "world-night", category: "world", name: "Лунная ночь", description: "Тёмное звёздное небо.", price: 80, preview: "☾" },
  { id: "props-none", category: "props", name: "Без дополнений", description: "Базовые декорации мира.", price: 0, preview: "—" },
  { id: "props-lanterns", category: "props", name: "Небесные фонарики", description: "Светящиеся фонарики на фоне.", price: 60, preview: "◈" },
  { id: "vfx-none", category: "vfx", name: "Без искр", description: "Обычные эффекты скорости.", price: 0, preview: "—" },
  { id: "vfx-sparkles", category: "vfx", name: "Золотые искры", description: "Мягкие золотые частицы.", price: 60, preview: "✦" },
];

type Equipment = Record<Exclude<ShopCategory, "upgrade">, string>;
interface ProfileState {
  coins: number;
  owned: string[];
  levels: Record<string, number>;
  equipped: Equipment;
  creditedRuns: string[];
  firstSuccessAt: string | null;
  mission: MissionState;
  missionBoard: MissionBoard;
}
export const PROFILE_KEY = "speed-fall-ball.profile.v1";
const defaults = (): ProfileState => ({
  coins: 0,
  owned: SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id),
  levels: { energy: 0, "coin-energy": 0, "combo-charge": 0 },
  equipped: { ball: "ball-classic", world: "world-sky", props: "props-none", vfx: "vfx-none" },
  creditedRuns: [],
  firstSuccessAt: null,
  mission: { index: 0, progress: 0 },
  missionBoard: migrateMissionBoard({ index: 0, progress: 0 }),
});

function parseProfile(raw: string | null): ProfileState {
  if (raw === null) return defaults();
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null) throw new Error("Invalid profile");
  const data = value as Record<string, unknown>;
  const state = defaults();
  if (typeof data.coins !== "number" || !Number.isSafeInteger(data.coins) || data.coins < 0 ||
    !Array.isArray(data.owned) || !Array.isArray(data.creditedRuns)) throw new Error("Invalid profile balance");
  state.firstSuccessAt = typeof data.firstSuccessAt === "string" && Number.isFinite(Date.parse(data.firstSuccessAt)) ? data.firstSuccessAt : null;
  // Existing players already received the legacy first reward; continue at mission two.
  state.mission = { index: state.firstSuccessAt === null ? 0 : 1, progress: 0 };
  if (typeof data.mission === "object" && data.mission !== null) {
    const mission = data.mission as Record<string, unknown>;
    if (typeof mission.index === "number" && Number.isSafeInteger(mission.index) && mission.index >= 0 && mission.index < Number.MAX_SAFE_INTEGER &&
      typeof mission.progress === "number" && Number.isSafeInteger(mission.progress) && mission.progress >= 0) {
      const candidate = { index: mission.index, progress: mission.progress };
      if (candidate.progress < currentMission(candidate).target) state.mission = candidate;
    }
  }
  state.missionBoard = parseMissionBoard(data.missionBoard, state.mission);
  state.coins = data.coins;
  state.owned = [...new Set([...state.owned, ...data.owned.filter((id): id is string =>
    typeof id === "string" && SHOP_ITEMS.some((item) => item.id === id && item.category !== "upgrade"))])];
  state.creditedRuns = data.creditedRuns.filter((id): id is string => typeof id === "string");
  if (typeof data.levels === "object" && data.levels !== null) {
    const levels = data.levels as Record<string, unknown>;
    for (const item of SHOP_ITEMS) {
      const level = levels[item.id];
      if (item.maxLevel !== undefined && typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= item.maxLevel) state.levels[item.id] = level;
    }
  }
  if (typeof data.equipped === "object" && data.equipped !== null) {
    const equipment = data.equipped as Record<string, unknown>;
    for (const slot of Object.keys(state.equipped) as (keyof Equipment)[]) {
      const id = equipment[slot];
      if (typeof id === "string" && state.owned.includes(id) && SHOP_ITEMS.some((item) => item.id === id && item.category === slot)) state.equipped[slot] = id;
    }
  }
  return state;
}

export class PlayerProfile {
  readonly #storage: () => Pick<Storage, "getItem" | "setItem">;
  #state: ProfileState = defaults();
  #storageAvailable = true;
  #readFailed = false;

  public constructor(storage: () => Pick<Storage, "getItem" | "setItem">) {
    this.#storage = storage;
    try { this.#state = parseProfile(storage().getItem(PROFILE_KEY)); }
    catch { this.#storageAvailable = false; this.#readFailed = true; }
  }
  public get coins(): number { return this.#state.coins; }
  public get storageAvailable(): boolean { return this.#storageAvailable; }
  public get equipment(): Readonly<Equipment> { return { ...this.#state.equipped }; }
  public level(id: string): number { return this.#state.levels[id] ?? 0; }
  public owns(id: string): boolean { return this.#state.owned.includes(id); }
  public price(item: ShopItem): number { return item.price * (this.level(item.id) + 1); }

  #commit(next: ProfileState): boolean {
    if (this.#readFailed) return false;
    try {
      this.#storage().setItem(PROFILE_KEY, JSON.stringify(next));
      this.#state = next;
      this.#storageAvailable = true;
      return true;
    } catch { this.#storageAvailable = false; return false; }
  }

  public creditRuns(runs: readonly RunResult[]): boolean {
    const credited = new Set(this.#state.creditedRuns);
    let coins = this.#state.coins;
    for (const run of runs) {
      if (credited.has(run.id) || !Number.isSafeInteger(run.coins) || run.coins < 0) continue;
      credited.add(run.id);
      coins += run.coins;
    }
    if (credited.size === this.#state.creditedRuns.length) return true;
    if (!Number.isSafeInteger(coins)) return false;
    return this.#commit({ ...this.#state, coins, creditedRuns: [...credited] });
  }

  public get missionBoard(): MissionBoard {
    const board = this.#state.missionBoard;
    return { ...board, progress: [...board.progress], completed: [...board.completed] };
  }

  public get activeMission(): MissionState | null {
    const board = this.#state.missionBoard;
    return board.selected === null ? null : { index: board.start + board.selected, progress: board.progress[board.selected] ?? 0 };
  }

  public get mission(): MissionState { return this.activeMission ?? { ...this.#state.mission }; }

  public selectMission(index: number): boolean {
    const board = this.#state.missionBoard;
    const offset = index - board.start;
    if (!Number.isInteger(offset) || offset < 0 || offset >= 5 || board.completed[offset]) return false;
    const mission = { index, progress: board.progress[offset] ?? 0 };
    return this.#commit({ ...this.#state, mission, missionBoard: { ...board, selected: offset } });
  }

  public nextMissionBoard(): boolean {
    const board = this.#state.missionBoard;
    if (!board.completed.every(Boolean) || board.start > Number.MAX_SAFE_INTEGER - 15) return false;
    const mission = { index: board.start + 5, progress: 0 };
    return this.#commit({ ...this.#state, mission,
      missionBoard: { ...migrateMissionBoard(mission), selected: null } });
  }

  public applyMissionEvent(event: MissionEvent): { saved: boolean; rewarded: boolean } {
    const mission = this.activeMission;
    if (mission === null) return { saved: true, rewarded: false };
    const next = advanceMission(mission, event);
    if (next.state.index === mission.index && next.state.progress === mission.progress) return { saved: true, rewarded: false };
    const coins = this.coins + (next.completed ? MISSION_REWARD : 0);
    if (!Number.isSafeInteger(coins) || !Number.isSafeInteger(next.state.index)) return { saved: false, rewarded: false };
    const board = this.#state.missionBoard;
    const offset = mission.index - board.start;
    const missionBoard: MissionBoard = { ...board, selected: next.completed ? null : offset,
      progress: board.progress.map((value, i) => i === offset ? next.state.progress : value),
      completed: board.completed.map((value, i) => value || i === offset && next.completed) };
    const saved = this.#commit({ ...this.#state, coins, mission: next.state, missionBoard,
      firstSuccessAt: this.#state.firstSuccessAt ?? (next.completed ? new Date().toISOString() : null) });
    return { saved, rewarded: saved && next.completed };
  }

  public buy(id: string): boolean {
    const item = SHOP_ITEMS.find((entry) => entry.id === id);
    if (item === undefined || item.maxLevel === undefined && this.owns(id)) return false;
    if (item.maxLevel !== undefined && this.level(id) >= item.maxLevel) return false;
    const price = this.price(item);
    if (this.coins < price) return false;
    return this.#commit({ ...this.#state, coins: this.coins - price,
      owned: item.category === "upgrade" ? [...this.#state.owned] : [...this.#state.owned, id],
      levels: item.category === "upgrade" ? { ...this.#state.levels, [id]: this.level(id) + 1 } : { ...this.#state.levels },
    });
  }

  public equip(id: string): boolean {
    const item = SHOP_ITEMS.find((entry) => entry.id === id);
    if (item === undefined || item.category === "upgrade" || !this.owns(id)) return false;
    return this.#commit({ ...this.#state, equipped: { ...this.#state.equipped, [item.category]: id } });
  }
}

export function createPlayerConfig(config: GameConfig, profile: PlayerProfile): GameConfig {
  const color = profile.equipment.ball === "ball-gold" ? { r: 1, g: 0.72, b: 0.18 }
    : profile.equipment.ball === "ball-mint" ? { r: 0.22, g: 1, b: 0.68 } : null;
  return { ...config,
    boost: { ...config.boost, comboHitsRequired: Math.max(4, config.boost.comboHitsRequired - profile.level("combo-charge")) },
    economy: { ...config.economy,
      initialEnergy: config.economy.initialEnergy + profile.level("energy") * 5,
      energyPerCoin: config.economy.energyPerCoin + profile.level("coin-energy"),
    },
    ballVisual: { ...config.ballVisual, ...(color === null ? {} : { baseColor: color, speedColor: color }) },
  };
}
let browserProfile: PlayerProfile | null = null;
export function getPlayerProfile(): PlayerProfile {
  return browserProfile ??= new PlayerProfile(() => window.localStorage);
}
