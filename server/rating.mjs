import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
export const DEMO_VERSION = 'demo-2026-10-21';
const fail=(message,code='22023',status=400)=>{throw Object.assign(new Error(message),{code,status});};
const hash=token=>createHash('sha256').update(token).digest('hex');
export function createRatingServer({filename=':memory:',origins=['https://gdrclm.github.io'],now=()=>Date.now(),versions=[DEMO_VERSION]}={}) {
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,nickname TEXT,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),demo_version TEXT NOT NULL REFERENCES versions(id),started_at INTEGER NOT NULL,finished_at INTEGER);
    CREATE INDEX IF NOT EXISTS attempts_player_time ON attempts(player_id,started_at);
    CREATE TABLE IF NOT EXISTS scores(player_id TEXT NOT NULL REFERENCES players(id),demo_version TEXT NOT NULL REFERENCES versions(id),score INTEGER NOT NULL,depth INTEGER NOT NULL,coins INTEGER NOT NULL,platforms INTEGER NOT NULL,combo_bonus INTEGER NOT NULL,best_combo INTEGER NOT NULL,max_speed REAL NOT NULL,stage INTEGER NOT NULL,duration_ms INTEGER NOT NULL,run_id TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(player_id,demo_version));
    CREATE INDEX IF NOT EXISTS score_ranking ON scores(demo_version,score DESC,depth DESC,max_speed DESC,updated_at,player_id);`);
  for(const version of versions)db.prepare('INSERT OR IGNORE INTO versions(id) VALUES (?)').run(version);
  const rates=new Map();
  const limited=(key,limit,windowMs)=>{
    let item=rates.get(key);if(!item||item.until<=now()){item={count:0,until:now()+windowMs};rates.set(key,item);}
    if(++item.count>limit)fail('Слишком много запросов. Попробуй немного позже.','RATE_LIMIT',429);
    if(rates.size>10000)for(const [k,v] of rates)if(v.until<=now())rates.delete(k);
  };
  const validVersion=id=>{if(!db.prepare('SELECT id FROM versions WHERE id=? AND active=1').get(id))fail('Эта версия демо недоступна.');};
  const integer=(value,max,name)=>{if(!Number.isSafeInteger(value)||value<0||value>max)fail(`Некорректный показатель: ${name}`);return value;};
  const leaderboard=(player,version)=>{
    validVersion(version);
    const cte=`WITH ranked AS (SELECT row_number() OVER(ORDER BY s.score DESC,s.depth DESC,s.max_speed DESC,s.updated_at,s.player_id) AS rank,s.player_id,p.nickname,s.score,s.depth,s.max_speed,s.stage FROM scores s JOIN players p ON p.id=s.player_id WHERE demo_version=?) `;
    return {top:db.prepare(cte+'SELECT * FROM ranked WHERE rank<=20 ORDER BY rank').all(version),self:db.prepare(cte+'SELECT * FROM ranked WHERE player_id=?').get(version,player.id)??null};
  };
  const rpc=(player,name,a)=>{
    switch(name){
      case 'get_player_identity':return player.nickname?{id:player.id,nickname:player.nickname}:null;
      case 'register_player':{
        if(typeof a.p_nickname!=='string')fail('Нужно имя игрока.');
        const nickname=a.p_nickname.normalize('NFKC').trim().replace(/ +/g,' ');
        if(!/^[\p{L}\p{N}_ -]{2,16}$/u.test(nickname))fail('Имя: 2–16 букв, цифр, пробелов, _ или -.');
        limited(`name:${player.id}`,10,60000);db.prepare('UPDATE players SET nickname=? WHERE id=?').run(nickname,player.id);
        return {id:player.id,nickname};
      }
      case 'start_ranked_run':{
        validVersion(a.p_demo_version);if(!player.nickname)fail('Сначала выбери имя игрока.');
        if(typeof a.p_run_id!=='string'||!/^[-a-f0-9]{36}$/i.test(a.p_run_id))fail('Некорректная попытка.');
        const existing=db.prepare('SELECT * FROM attempts WHERE id=?').get(a.p_run_id);
        if(existing){if(existing.player_id!==player.id||existing.demo_version!==a.p_demo_version)fail('Попытка недоступна.','P0002',404);return {run_id:existing.id};}
        limited(`start:${player.id}`,60,60000);
        db.prepare('DELETE FROM attempts WHERE player_id=? AND started_at<?').run(player.id,now()-2*86400000);
        db.prepare('INSERT INTO attempts(id,player_id,demo_version,started_at) VALUES(?,?,?,?)').run(a.p_run_id,player.id,a.p_demo_version,now());
        return {run_id:a.p_run_id};
      }
      case 'submit_ranked_score':{
        const run=db.prepare('SELECT * FROM attempts WHERE id=? AND player_id=?').get(a.p_run_id,player.id);
        if(!run)fail('Попытка не найдена или истекла.','P0002',404);
        if(run.finished_at!==null)return {accepted:true,duplicate:true};
        validVersion(run.demo_version);
        const depth=integer(a.p_depth,2_000_000,'глубина'),coins=integer(a.p_coins,20000,'монеты'),platforms=integer(a.p_platforms,12000,'платформы');
        const combo=integer(a.p_combo_bonus,platforms*10000,'комбо'),best=integer(a.p_best_combo,platforms,'серия');
        const duration=integer(a.p_duration_ms,120250,'время'),stage=integer(a.p_stage,10,'этап'),speed=a.p_max_speed;
        if(duration<1000||duration>now()-run.started_at+2000||now()-run.started_at>2*86400000||typeof speed!=='number'||!Number.isFinite(speed)||speed<0||speed>100000||depth>speed/3*duration/1000+50)fail('Некорректная длительность или скорость забега.');
        const score=depth+coins*10+platforms*25+combo;
        db.exec('BEGIN IMMEDIATE');
        try{
          const result=db.prepare(`INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,demo_version) DO UPDATE SET score=excluded.score,depth=excluded.depth,coins=excluded.coins,platforms=excluded.platforms,combo_bonus=excluded.combo_bonus,best_combo=excluded.best_combo,max_speed=excluded.max_speed,stage=excluded.stage,duration_ms=excluded.duration_ms,run_id=excluded.run_id,updated_at=excluded.updated_at WHERE (excluded.score,excluded.depth,excluded.max_speed)>(scores.score,scores.depth,scores.max_speed)`).run(player.id,run.demo_version,score,depth,coins,platforms,combo,best,speed,stage,duration,a.p_run_id,now());
          db.prepare('UPDATE attempts SET finished_at=? WHERE id=?').run(now(),run.id);db.exec('COMMIT');return {accepted:true,improved:result.changes>0};
        }catch(error){db.exec('ROLLBACK');throw error;}
      }
      case 'get_demo_leaderboard':return leaderboard(player,a.p_demo_version);
      default:fail('Неизвестный запрос.','P0002',404);
    }
  };
  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(origin&&!origins.includes(origin)){res.writeHead(403);res.end();return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    try{
      if(req.url==='/health'&&req.method==='GET'){send({ok:true,temporary:true,version:DEMO_VERSION});return;}
      const ip=req.headers['cf-connecting-ip']??req.socket.remoteAddress??'unknown';limited(`http:${ip}`,240,60000);
      if(req.method==='POST'&&req.url==='/auth'){
        limited(`auth:${ip}`,20,3600000);const id=randomUUID(),token=randomBytes(32).toString('base64url');
        db.prepare('INSERT INTO players(id,token_hash,created_at) VALUES(?,?,?)').run(id,hash(token),now());send({id,token,nickname:null});return;
      }
      const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      const player=token?db.prepare('SELECT id,nickname FROM players WHERE token_hash=?').get(hash(token)):null;
      if(!player)fail('Нужен вход игрока.','AUTH',401);
      if(req.url==='/identity'&&req.method==='GET'){send(player);return;}
      if(req.url!=='/rpc'||req.method!=='POST')fail('Не найдено.','P0002',404);
      let body='',bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)fail('Запрос слишком большой.','22023',413);body+=chunk.toString();}
      let data;try{data=JSON.parse(body);}catch{fail('Некорректный запрос.');}
      if(!data||typeof data.name!=='string'||!data.args||typeof data.args!=='object'||Array.isArray(data.args))fail('Некорректный запрос.');
      limited(`rpc:${player.id}`,180,60000);send(rpc(player,data.name,data.args));
    }catch(error){send({error:error.status?error.message:'Сервис временно недоступен.',code:error.code??'INTERNAL'},error.status??500);}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  server.on('close',()=>db.close());return server;
}
