import type { RunResult } from "../run/RunHistory";
export interface NetworkConfig { supabaseUrl?: string; supabasePublishableKey?: string; temporaryApiUrl?: string; demoVersion: string; }
export interface PlayerIdentity { id: string; nickname: string; }
export interface RunTicket { runId: string; playerId: string; demoVersion: string; }
export interface PendingScore { ticket: RunTicket; result: RunResult; durationMs: number; }
export interface LeaderboardEntry { rank: number; player_id: string; nickname: string; score: number; depth: number; max_speed: number; stage: number; }
export interface Leaderboard { top: LeaderboardEntry[]; self: LeaderboardEntry | null; }
export function normalizeNickname(value: string): string {
  const name = value.normalize("NFKC").trim().replace(/ +/g, " ");
  if (!/^[\p{L}\p{N}_ -]{2,16}$/u.test(name)) throw new Error("Имя: 2–16 букв, цифр, пробелов, _ или -.");
  return name;
}
export function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
export function parseLeaderboard(value: unknown): Leaderboard {
  const entry = (v: unknown): v is LeaderboardEntry => record(v) && typeof v.player_id === "string" && typeof v.nickname === "string" &&
    [v.rank, v.score, v.depth, v.max_speed, v.stage].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
  if (!record(value) || !Array.isArray(value.top) || !value.top.every(entry) || value.self !== null && !entry(value.self)) throw new Error("Не удалось прочитать рейтинг.");
  return { top: value.top, self: value.self };
}
