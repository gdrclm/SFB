import { expect, it } from "vitest";
import { normalizeNickname,parseLeaderboard } from "./types";
import { parseNetworkConfig } from "./config";
import { ScoreOutbox } from "./ScoreOutbox";
import type { PendingScore } from "./types";
it("normalizes names and rejects markup/control characters",()=>{
 expect(normalizeNickname('  Метеор  7  ')).toBe('Метеор 7');expect(()=>normalizeNickname('<script>')).toThrow();expect(()=>normalizeNickname('а\nб')).toThrow();expect(()=>normalizeNickname('x')).toThrow();
});
it("supports a temporary HTTPS backend and rejects secret Supabase keys",()=>{
 expect(parseNetworkConfig({temporaryApiUrl:'https://sfb.example',demoVersion:'test'})?.temporaryApiUrl).toBe('https://sfb.example');
 expect(parseNetworkConfig({temporaryApiUrl:'http://127.0.0.1:8787'})?.demoVersion).toBeTruthy();
 expect(()=>parseNetworkConfig({temporaryApiUrl:'http://remote.example'})).toThrow();
 expect(()=>parseNetworkConfig({supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_secret_bad'})).toThrow();
 expect(parseNetworkConfig({supabaseUrl:'',supabasePublishableKey:''})).toBeNull();
});
it("keeps authenticated player queues separate, retains the best pending scores and survives storage failure",()=>{
 const storage={getItem:()=>null,setItem:()=>{throw new Error('quota');}};
 const outbox=new ScoreOutbox(storage);
 const row=(id:string,player:string,score:number):PendingScore=>({ticket:{runId:id,playerId:player,demoVersion:'test'},result:{id,depth:1,score,coins:0,platforms:0,finishedAt:new Date().toISOString(),outcome:'completed'},durationMs:1000});
 outbox.add(row('first','a',999));outbox.add(row('first','a',999));expect(outbox.all('a')).toHaveLength(1);
 outbox.add(row('b','b',1));expect(outbox.all('a')).toHaveLength(1);expect(outbox.storageAvailable).toBe(false);
 for(let i=0;i<30;i++)outbox.add(row(String(i),'a',i));
 expect(outbox.all('a').some(v=>v.ticket.runId==='first')).toBe(true);
 outbox.remove('first');expect(outbox.all('a').some(v=>v.ticket.runId==='first')).toBe(false);
});
it("rejects invalid leaderboard responses",()=>{
 expect(parseLeaderboard({top:[],self:null})).toEqual({top:[],self:null});expect(()=>parseLeaderboard({top:[{nickname:'x'}],self:null})).toThrow();
});
