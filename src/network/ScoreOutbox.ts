import { record, type PendingScore } from "./types";
const KEY = "speed-fall-ball.network.outbox.v1";
export class ScoreOutbox {
  readonly #storage: Pick<Storage,"getItem"|"setItem">;
  #rows: PendingScore[] = [];
  public storageAvailable = true;
  public constructor(storage: Pick<Storage,"getItem"|"setItem">) {
    this.#storage = storage;
    try {
      const raw: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
      if (Array.isArray(raw)) this.#rows = raw.filter((v): v is PendingScore => record(v) && record(v.ticket) && typeof v.ticket.runId === "string" && typeof v.ticket.playerId === "string" && typeof v.ticket.demoVersion === "string" && record(v.result) && v.result.outcome === "completed" && typeof v.result.score === "number" && typeof v.durationMs === "number").slice(-20);
    } catch { this.storageAvailable = false; }
  }
  public all(playerId: string): PendingScore[] { return this.#rows.filter(v => v.ticket.playerId === playerId); }
  public add(row: PendingScore): void {
    if (this.#rows.some(v=>v.ticket.runId === row.ticket.runId)) return;
    this.#rows.push(row); this.#rows = this.#rows.sort((a,b)=>b.result.score-a.result.score).slice(0,20); this.#save();
  }
  public remove(runId: string): void { this.#rows = this.#rows.filter(v=>v.ticket.runId !== runId); this.#save(); }
  #save(): void { try { this.#storage.setItem(KEY, JSON.stringify(this.#rows)); this.storageAvailable = true; } catch { this.storageAvailable = false; } }
}
