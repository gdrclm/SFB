export interface RunResult {
  readonly id: string;
  readonly finishedAt: string;
  readonly depth: number;
  readonly coins: number;
  readonly platforms: number;
  readonly score: number;
  readonly maxSpeed?: number;
  readonly stage?: number;
  readonly bestCombo?: number;
  readonly comboBonus?: number;
  readonly outcome: "completed" | "interrupted";
}

export const RUN_HISTORY_KEY = "speed-fall-ball.run-history.v1";

export function calculateScore(depth: number, coins: number, platforms: number, comboBonus = 0): number {
  return Math.floor(depth) + coins * 10 + platforms * 25 + comboBonus;
}

function isRunResult(value: unknown): value is RunResult {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && row.id.length > 0 &&
    typeof row.finishedAt === "string" && Number.isFinite(Date.parse(row.finishedAt)) &&
    [row.depth, row.coins, row.platforms, row.score].every(
      (number) => typeof number === "number" && Number.isSafeInteger(number) && number >= 0,
    ) && (row.maxSpeed === undefined || typeof row.maxSpeed === "number" && Number.isFinite(row.maxSpeed) && row.maxSpeed >= 0) && [row.bestCombo, row.comboBonus, row.stage].every((number) => number === undefined || typeof number === "number" && Number.isSafeInteger(number) && number >= 0) && (row.outcome === "completed" || row.outcome === "interrupted");
}

export class RunHistory {
  readonly #getStorage: () => Pick<Storage, "getItem" | "setItem">;
  #records: RunResult[] = [];
  #storageAvailable = true;

  public constructor(getStorage: () => Pick<Storage, "getItem" | "setItem">) {
    this.#getStorage = getStorage;
    try {
      const raw = getStorage().getItem(RUN_HISTORY_KEY);
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      if (Array.isArray(parsed)) this.#records = parsed.filter(isRunResult);
    } catch {
      this.#storageAvailable = false;
    }
  }

  public get storageAvailable(): boolean { return this.#storageAvailable; }

  public all(): readonly RunResult[] { return [...this.#records]; }

  public personalBests(): { depth: number; maxSpeed: number; stage: number } {
    return this.#records.reduce((best, run) => ({ depth: Math.max(best.depth, run.depth),
      maxSpeed: Math.max(best.maxSpeed, run.maxSpeed ?? 0), stage: Math.max(best.stage, run.stage ?? 0) }),
      { depth: 0, maxSpeed: 0, stage: 0 });
  }

  public top(limit = 10): readonly RunResult[] {
    return [...this.#records].sort((a, b) =>
      b.score - a.score || b.depth - a.depth || b.finishedAt.localeCompare(a.finishedAt),
    ).slice(0, limit);
  }

  public save(result: RunResult): void {
    if (this.#records.some((row) => row.id === result.id)) return;
    this.#records.push(result);
    try {
      this.#getStorage().setItem(RUN_HISTORY_KEY, JSON.stringify(this.#records));
      this.#storageAvailable = true;
    } catch {
      this.#storageAvailable = false;
    }
  }
}

export class RunProgress {
  #maximumDepth = 0;
  #maximumSpeed = 0;
  #bestStage = 1;
  #result: RunResult | null = null;

  public get depth(): number { return Math.floor(this.#maximumDepth); }

  public observeDepth(depth: number): void {
    if (this.#result === null && Number.isFinite(depth)) {
      this.#maximumDepth = Math.max(this.#maximumDepth, depth);
    }
  }

  public observeStage(stage: number): void {
    if (this.#result === null && Number.isSafeInteger(stage) && stage > 0) this.#bestStage = Math.max(this.#bestStage, stage);
  }

  public observeSpeed(speed: number): void {
    if (this.#result === null && Number.isFinite(speed)) this.#maximumSpeed = Math.max(this.#maximumSpeed, speed);
  }

  public finish(
    history: RunHistory,
    coins: number,
    platforms: number,
    outcome: RunResult["outcome"],
    combo: { readonly best: number; readonly bonus: number } = { best: 0, bonus: 0 },
  ): RunResult {
    if (this.#result === null) {
      this.#result = {
        id: crypto.randomUUID(),
        finishedAt: new Date().toISOString(),
        depth: this.depth,
        stage: this.#bestStage,
        maxSpeed: Math.round(this.#maximumSpeed * 10) / 10,
        coins,
        platforms,
        score: calculateScore(this.depth, coins, platforms, combo.bonus),
        bestCombo: combo.best,
        comboBonus: combo.bonus,
        outcome,
      };
      history.save(this.#result);
    }
    return this.#result;
  }
}

let browserHistory: RunHistory | null = null;

export function getBrowserRunHistory(): RunHistory {
  return browserHistory ??= new RunHistory(() => window.localStorage);
}
