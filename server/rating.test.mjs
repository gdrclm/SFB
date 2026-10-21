import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRatingServer,DEMO_VERSION} from './rating.mjs';
test('two anonymous players, authoritative scoring, version isolation, best-only and ownership',async()=>{
 let clock=Date.now();const server=createRatingServer({now:()=>clock,versions:[DEMO_VERSION,'other'],origins:['http://game.test']});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
 const request=async(path,body,token)=>{const response=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'http://game.test',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
 const rpc=async(token,name,args)=>request('/rpc',{name,args},token);
 try{
  const a=(await request('/auth',{})).data,b=(await request('/auth',{})).data;assert.notEqual(a.id,b.id);
  assert.equal((await request('/identity',undefined,a.token)).data.id,a.id);
  assert.equal((await request('/identity',undefined,'invalid')).status,401);
  for(const [player,name] of [[a,'Метеор'],[b,'Комета']])assert.equal((await rpc(player.token,'register_player',{p_nickname:name})).status,200);
  const run=async(player,version=DEMO_VERSION)=>{const id=randomUUID();assert.equal((await rpc(player.token,'start_ranked_run',{p_run_id:id,p_demo_version:version})).status,200);clock+=10000;return id;};
  const payload=id=>({p_run_id:id,p_depth:100,p_coins:2,p_platforms:5,p_combo_bonus:50,p_best_combo:5,p_max_speed:40,p_stage:1,p_duration_ms:10000,score:9999999,player_id:b.id});
  const first=await run(a);
  assert.equal((await rpc(b.token,'submit_ranked_score',payload(first))).status,404);
  assert.equal((await rpc(a.token,'submit_ranked_score',payload(first))).data.accepted,true);
  assert.equal((await rpc(a.token,'submit_ranked_score',{...payload(first),p_depth:99999})).data.duplicate,true);
  const worse=await run(a);await rpc(a.token,'submit_ranked_score',{...payload(worse),p_coins:0});
  let board=(await rpc(a.token,'get_demo_leaderboard',{p_demo_version:DEMO_VERSION})).data;
  assert.equal(board.top.length,1);assert.equal(board.self.score,295);assert.equal(board.self.player_id,a.id);
  const second=await run(b);await rpc(b.token,'submit_ranked_score',{...payload(second),p_coins:10});
  board=(await rpc(a.token,'get_demo_leaderboard',{p_demo_version:DEMO_VERSION})).data;
  assert.equal(board.self.rank,2);assert.equal(board.top[0].nickname,'Комета');
  const better=await run(a);await rpc(a.token,'submit_ranked_score',{...payload(better),p_coins:50});
  board=(await rpc(a.token,'get_demo_leaderboard',{p_demo_version:DEMO_VERSION})).data;assert.equal(board.top.length,2);assert.equal(board.self.rank,1);
  const other=await run(a,'other');await rpc(a.token,'submit_ranked_score',payload(other));
  assert.equal((await rpc(a.token,'get_demo_leaderboard',{p_demo_version:'other'})).data.top.length,1);
  const bad=await run(a);assert.equal((await rpc(a.token,'submit_ranked_score',{...payload(bad),p_depth:1e9})).status,400);
  assert.equal((await rpc(a.token,'submit_ranked_score',{...payload(bad),p_max_speed:NaN})).status,400);
  assert.equal((await rpc(a.token,'register_player',{p_nickname:'<img src=x>'})).status,400);
  const blocked=await fetch(url+'/health',{headers:{Origin:'https://evil.example'}});assert.equal(blocked.status,403);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
