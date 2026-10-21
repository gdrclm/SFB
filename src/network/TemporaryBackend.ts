import { record, type PlayerIdentity } from "./types";
const KEY = "speed-fall-ball.network.temporary-session.v1";
export class TemporaryBackend {
  readonly #url: string;
  #token = "";
  public constructor(url: string) { this.#url = url; }
  async #request(path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(this.#url + path, { method:body === undefined ? "GET" : "POST", credentials:"omit",
      headers:{ "Content-Type":"application/json", ...(this.#token ? { Authorization:`Bearer ${this.#token}` } : {}) },
      ...(body === undefined ? {} : { body:JSON.stringify(body) }), signal:AbortSignal.timeout(8000) });
    const value: unknown = await response.json();
    if (!response.ok) throw Object.assign(new Error(record(value) && typeof value.error === "string" ? value.error : "Нет связи с рейтингом"), { code: record(value) ? value.code : "NETWORK" });
    return value;
  }
  public async connect(): Promise<{ id: string; player:PlayerIdentity|null }> {
    try { const value:unknown=JSON.parse(localStorage.getItem(KEY) ?? "null");if(record(value)&&typeof value.token==="string")this.#token=value.token; } catch { /* Memory-only session if storage is unavailable. */ }
    let value:unknown;
    if(this.#token){
      try { value=await this.#request("/identity"); }
      catch(error:unknown){if(!record(error)||error.code!=="AUTH")throw error;this.#token="";}
    }
    if(!this.#token){
      value=await this.#request("/auth",{});
      if(!record(value)||typeof value.token!=="string")throw new Error("Не удалось создать игрока.");
      this.#token=value.token;
      try { localStorage.setItem(KEY,JSON.stringify({token:this.#token})); } catch { /* Keep the current session usable. */ }
    }
    if(!record(value)||typeof value.id!=="string")throw new Error("Не удалось восстановить игрока.");
    return {id:value.id,player:typeof value.nickname==="string"?{id:value.id,nickname:value.nickname}:null};
  }
  public rpc(name:string,args:Record<string,unknown>):Promise<unknown>{return this.#request("/rpc",{name,args});}
}
