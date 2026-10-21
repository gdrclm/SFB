import { TemporaryBackend } from "./TemporaryBackend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadNetworkConfig } from "./config";
import { ScoreOutbox } from "./ScoreOutbox";
import { normalizeNickname, parseLeaderboard, record, type Leaderboard, type NetworkConfig, type PendingScore, type PlayerIdentity, type RunTicket } from "./types";
export class OnlineGame {
  #client: SupabaseClient | null = null;
  #temporary: TemporaryBackend | null = null;
  #config: NetworkConfig | null = null;
  #player: PlayerIdentity | null = null;
  #userId: string | null = null;
  #outbox: ScoreOutbox | null = null;
  #flushing = false;
  #retry: ReturnType<typeof setTimeout> | null = null;
  readonly #listeners = new Set<()=>void>();
  public status = "Подключение…";
  public get configured(): boolean { return this.#client !== null || this.#temporary !== null; }
  public get player(): PlayerIdentity | null { return this.#player; }
  public get userId(): string | null { return this.#userId; }
  public get version(): string { return this.#config?.demoVersion ?? ""; }
  public get pending(): number { return this.#userId === null ? 0 : this.#outbox?.all(this.#userId).length ?? 0; }
  public subscribe(listener:()=>void): void { this.#listeners.add(listener); }
  #notify(): void { for (const fn of this.#listeners) fn(); }
  public async initialize(): Promise<void> {
    try {
      this.#config = await loadNetworkConfig();
      if (this.#config === null) { this.status = "Общий рейтинг ещё не подключён"; return; }
      if (this.#config.temporaryApiUrl) this.#temporary = new TemporaryBackend(this.#config.temporaryApiUrl);
      else if (this.#config.supabaseUrl && this.#config.supabasePublishableKey) {
        const {createClient}=await import("@supabase/supabase-js");
        this.#client = createClient(this.#config.supabaseUrl, this.#config.supabasePublishableKey, {
        auth: { storageKey: "speed-fall-ball.network.auth.v1", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      }
      this.#outbox = new ScoreOutbox({ getItem: k=>localStorage.getItem(k), setItem:(k,v)=>{ localStorage.setItem(k,v); } });
      window.addEventListener("online", ()=>{ void this.reconnect(); });
      document.addEventListener("visibilitychange", ()=>{ if (!document.hidden) void this.reconnect(); });
      await this.connect();
    } catch { this.status = "Нет связи с рейтингом. Свободный забег доступен."; }
    finally { this.#notify(); }
  }
  public async connect(): Promise<void> {
    if (this.#temporary !== null) {
      const session = await this.#temporary.connect(); this.#userId=session.id; this.#player=session.player;
      this.status=this.#player===null?"Выбери имя игрока":"В сети · временный сервер";
      this.#notify(); void this.flush(); return;
    }
    const client = this.#client;
    if (client === null) throw new Error("Общий рейтинг ещё не подключён.");
    const session = await client.auth.getSession();
    if (session.error !== null) throw new Error("Не удалось восстановить профиль.");
    if (session.data.session === null) {
      const login = await client.auth.signInAnonymously();
      if (login.error !== null || login.data.user === null) throw new Error("Не удалось войти. Проверь сеть и Anonymous Sign-Ins в Supabase.");
      this.#userId = login.data.user.id;
    } else this.#userId = session.data.session.user.id;
    const value = await this.#rpc("get_player_identity", {});
    this.#player = this.#identity(value);
    this.status = this.#player === null ? "Выбери имя игрока" : "В сети";
    this.#notify(); void this.flush();
  }
  #identity(value: unknown): PlayerIdentity | null {
    return record(value) && typeof value.id === "string" && typeof value.nickname === "string" ? { id:value.id, nickname:value.nickname } : null;
  }
  async #rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this.#temporary !== null) return this.#temporary.rpc(name,args);
    if (this.#client === null) throw new Error("Общий рейтинг ещё не подключён.");
    const response = await this.#client.rpc(name, args).abortSignal(AbortSignal.timeout(8000));
    if (response.error !== null) throw Object.assign(new Error(response.error.message), { code: response.error.code });
    const value: unknown = response.data; return value;
  }
  public async rename(name: string): Promise<void> {
    if (this.#userId === null) await this.connect();
    this.#player = this.#identity(await this.#rpc("register_player", { p_nickname: normalizeNickname(name) }));
    if (this.#player === null) throw new Error("Не удалось сохранить имя.");
    this.status = "В сети"; this.#notify();
  }
  public async beginRun(): Promise<RunTicket> {
    if (this.#player === null) throw new Error("Сначала выбери имя игрока.");
    const runId = crypto.randomUUID();
    await this.#rpc("start_ranked_run", { p_run_id:runId, p_demo_version:this.version });
    return { runId, playerId:this.#player.id, demoVersion:this.version };
  }
  public enqueue(row: PendingScore): void {
    if (row.result.outcome !== "completed") return;
    this.#outbox?.add(row); this.status = "Результат ожидает отправки"; this.#notify(); void this.flush();
  }
  public async flush(): Promise<void> {
    if (this.#flushing || this.#userId === null || this.#outbox === null) return;
    this.#flushing = true;
    try {
      for (const row of this.#outbox.all(this.#userId)) {
        const r = row.result;
        try {
          await this.#rpc("submit_ranked_score", { p_run_id:row.ticket.runId, p_depth:r.depth, p_coins:r.coins, p_platforms:r.platforms,
            p_combo_bonus:r.comboBonus ?? 0, p_best_combo:r.bestCombo ?? 0, p_max_speed:r.maxSpeed ?? 0, p_stage:r.stage ?? 1, p_duration_ms:Math.round(row.durationMs) });
          this.#outbox.remove(row.ticket.runId); this.status = "Результат сохранён в рейтинге";
        } catch (error: unknown) {
          if (record(error) && typeof error.code === "string" && ["22023","P0002"].includes(error.code)) {
            this.#outbox.remove(row.ticket.runId); this.status = "Результат не принят рейтингом. Локальный рекорд сохранён.";
          } else { this.status = "Нет связи. Результат ждёт отправки"; this.#scheduleRetry(); break; }
        }
      }
    } finally { this.#flushing = false; if(this.pending>0)this.#scheduleRetry(); this.#notify(); }
  }
  #scheduleRetry(): void {
    if (this.#retry !== null) return;
    this.#retry = setTimeout(()=>{ this.#retry = null; if (!document.hidden) void this.flush(); }, 30_000);
  }
  public async leaderboard(): Promise<Leaderboard> { return parseLeaderboard(await this.#rpc("get_demo_leaderboard", { p_demo_version:this.version })); }
  async reconnect(): Promise<void> {
    try { if (this.#userId === null) await this.connect(); else await this.flush(); }
    catch { this.status = "Нет связи с рейтингом"; this.#notify(); }
  }
}
