import { record, type NetworkConfig } from "./types";
export const DEMO_VERSION = "demo-2026-10-21";
export function parseNetworkConfig(value: unknown): NetworkConfig | null {
  if (!record(value)) return null;
  const demoVersion = typeof value.demoVersion === "string" && value.demoVersion ? value.demoVersion : DEMO_VERSION;
  if (typeof value.temporaryApiUrl === "string" && value.temporaryApiUrl) {
    const api = new URL(value.temporaryApiUrl);
    if (api.protocol !== "https:" && !(api.protocol === "http:" && ["127.0.0.1","localhost"].includes(api.hostname))) throw new Error("Нужен HTTPS-адрес рейтинга.");
    if (api.username || api.password || api.search || api.hash) throw new Error("Некорректный адрес рейтинга.");
    return { temporaryApiUrl:api.href.replace(/\/$/,""),demoVersion };
  }
  const url = value.supabaseUrl, key = value.supabasePublishableKey;
  if (typeof url !== "string" || typeof key !== "string" || !url || !key) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) throw new Error("Укажи HTTPS URL проекта Supabase.");
  if (!key.startsWith("sb_publishable_")) {
    let role: unknown;
    try { const payload: unknown = JSON.parse(atob(key.split(".")[1]?.replace(/-/g,"+").replace(/_/g,"/") ?? "")); role = record(payload) ? payload.role : null; } catch { /* Invalid public key. */ }
    if (role !== "anon") throw new Error("Нужен публичный publishable/anon key Supabase.");
  }
  return { supabaseUrl: url.replace(/\/$/, ""), supabasePublishableKey: key,
    demoVersion: typeof value.demoVersion === "string" && value.demoVersion ? value.demoVersion : DEMO_VERSION };
}
export async function loadNetworkConfig(): Promise<NetworkConfig | null> {
  if (import.meta.env.VITE_TEMPORARY_API_URL) return parseNetworkConfig({temporaryApiUrl:import.meta.env.VITE_TEMPORARY_API_URL,demoVersion:import.meta.env.VITE_DEMO_VERSION});
  if (import.meta.env.VITE_SUPABASE_URL) return parseNetworkConfig({ supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, demoVersion: import.meta.env.VITE_DEMO_VERSION });
  const response = await fetch(new URL("network-config.json", document.baseURI), { signal: AbortSignal.timeout(5000), cache: "no-cache" });
  if (!response.ok) return null;
  const value: unknown = await response.json(); return parseNetworkConfig(value);
}
