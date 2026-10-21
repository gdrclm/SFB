begin;
create table public.sfb_demo_versions(id text primary key, active boolean not null default true);
insert into public.sfb_demo_versions values ('demo-2026-10-21',true);
create table public.sfb_players(id uuid primary key references auth.users(id) on delete cascade,nickname text not null check(char_length(nickname) between 2 and 16),created_at timestamptz not null default now());
create table public.sfb_attempts(id uuid primary key,player_id uuid not null references public.sfb_players(id) on delete cascade,demo_version text not null references public.sfb_demo_versions(id),started_at timestamptz not null default clock_timestamp(),finished_at timestamptz);
create index on public.sfb_attempts(player_id,started_at);
create table public.leaderboard_scores(player_id uuid not null references public.sfb_players(id) on delete cascade,demo_version text not null references public.sfb_demo_versions(id),score bigint not null,depth integer not null,coins integer not null,platforms integer not null,combo_bonus integer not null,best_combo integer not null,max_speed double precision not null,stage integer not null,duration_ms integer not null,run_id uuid not null,updated_at timestamptz not null default clock_timestamp(),primary key(player_id,demo_version));
create index on public.leaderboard_scores(demo_version,score desc,depth desc,max_speed desc,updated_at,player_id);
alter table public.sfb_demo_versions enable row level security;
alter table public.sfb_players enable row level security;
alter table public.sfb_attempts enable row level security;
alter table public.leaderboard_scores enable row level security;
revoke all on public.sfb_demo_versions,public.sfb_players,public.sfb_attempts,public.leaderboard_scores from anon,authenticated;

create function public.get_player_identity() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'nickname',p.nickname) from public.sfb_players p where p.id=auth.uid();
$$;
create function public.register_player(p_nickname text) returns jsonb language plpgsql security definer set search_path='' as $$
declare nickname text:=regexp_replace(btrim(normalize(p_nickname,NFKC)),' +',' ','g');
begin
 if auth.uid() is null then raise exception 'Нужен вход игрока' using errcode='42501'; end if;
 if nickname is null or char_length(nickname) not between 2 and 16 or nickname !~ '^[[:alpha:][:digit:]_ -]+$' then raise exception 'Некорректное имя' using errcode='22023'; end if;
 insert into public.sfb_players(id,nickname) values(auth.uid(),nickname) on conflict(id) do update set nickname=excluded.nickname;
 return public.get_player_identity();
end $$;
create function public.start_ranked_run(p_run_id uuid,p_demo_version text) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt public.sfb_attempts;
begin
 if auth.uid() is null or not exists(select 1 from public.sfb_players where id=auth.uid()) then raise exception 'Сначала выбери имя игрока' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if not exists(select 1 from public.sfb_demo_versions where id=p_demo_version and active) then raise exception 'Версия недоступна' using errcode='22023'; end if;
 select * into attempt from public.sfb_attempts where id=p_run_id;
 if found then
  if attempt.player_id<>auth.uid() or attempt.demo_version<>p_demo_version then raise exception 'Попытка недоступна' using errcode='P0002'; end if;
  return jsonb_build_object('run_id',attempt.id);
 end if;
 if (select count(*) from public.sfb_attempts where player_id=auth.uid() and started_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'Слишком много попыток' using errcode='P0001'; end if;
 delete from public.sfb_attempts where player_id=auth.uid() and started_at<clock_timestamp()-interval '2 days';
 insert into public.sfb_attempts(id,player_id,demo_version) values(p_run_id,auth.uid(),p_demo_version);
 return jsonb_build_object('run_id',p_run_id);
end $$;
create function public.submit_ranked_score(p_run_id uuid,p_depth integer,p_coins integer,p_platforms integer,p_combo_bonus integer,p_best_combo integer,p_max_speed double precision,p_stage integer,p_duration_ms integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt public.sfb_attempts; new_score bigint; changed integer;
begin
 if auth.uid() is null then raise exception 'Нужен вход игрока' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into attempt from public.sfb_attempts where id=p_run_id and player_id=auth.uid() for update;
 if not found then raise exception 'Попытка не найдена' using errcode='P0002'; end if;
 if attempt.finished_at is not null then return jsonb_build_object('accepted',true,'duplicate',true); end if;
 if not exists(select 1 from public.sfb_demo_versions where id=attempt.demo_version and active) then raise exception 'Версия недоступна' using errcode='22023'; end if;
 if array_position(array[p_depth,p_coins,p_platforms,p_combo_bonus,p_best_combo,p_stage,p_duration_ms],null) is not null
 or p_max_speed is null or p_max_speed::text in ('NaN','Infinity','-Infinity') or p_max_speed not between 0 and 100000
 or p_depth not between 0 and 2000000 or p_coins not between 0 and 20000 or p_platforms not between 0 and 12000
 or p_combo_bonus not between 0 and p_platforms*10000 or p_best_combo not between 0 and p_platforms or p_stage not between 0 and 10
 or p_duration_ms not between 1000 and 120250 or p_duration_ms>extract(epoch from(clock_timestamp()-attempt.started_at))*1000+2000
 or attempt.started_at<clock_timestamp()-interval '2 days' or p_depth>p_max_speed/3*p_duration_ms/1000+50 then raise exception 'Некорректный результат' using errcode='22023'; end if;
 new_score:=p_depth::bigint+p_coins::bigint*10+p_platforms::bigint*25+p_combo_bonus;
 insert into public.leaderboard_scores as current values(auth.uid(),attempt.demo_version,new_score,p_depth,p_coins,p_platforms,p_combo_bonus,p_best_combo,p_max_speed,p_stage,p_duration_ms,p_run_id,clock_timestamp())
 on conflict(player_id,demo_version) do update set score=excluded.score,depth=excluded.depth,coins=excluded.coins,platforms=excluded.platforms,combo_bonus=excluded.combo_bonus,best_combo=excluded.best_combo,max_speed=excluded.max_speed,stage=excluded.stage,duration_ms=excluded.duration_ms,run_id=excluded.run_id,updated_at=excluded.updated_at
 where(excluded.score,excluded.depth,excluded.max_speed)>(current.score,current.depth,current.max_speed);
 get diagnostics changed=row_count;
 update public.sfb_attempts set finished_at=clock_timestamp() where id=p_run_id;
 return jsonb_build_object('accepted',true,'improved',changed>0);
end $$;
create function public.get_demo_leaderboard(p_demo_version text) returns jsonb language sql stable security definer set search_path='' as $$
 with ranked as(select row_number() over(order by s.score desc,s.depth desc,s.max_speed desc,s.updated_at,s.player_id) as rank,s.player_id,p.nickname,s.score,s.depth,s.max_speed,s.stage from public.leaderboard_scores s join public.sfb_players p on p.id=s.player_id where s.demo_version=p_demo_version)
 select jsonb_build_object('top',coalesce((select jsonb_agg(to_jsonb(r) order by rank) from ranked r where rank<=20),'[]'::jsonb),'self',(select to_jsonb(r) from ranked r where player_id=auth.uid()));
$$;
revoke all on function public.get_player_identity(),public.register_player(text),public.start_ranked_run(uuid,text),public.submit_ranked_score(uuid,integer,integer,integer,integer,integer,double precision,integer,integer),public.get_demo_leaderboard(text) from public,anon;
grant execute on function public.get_player_identity(),public.register_player(text),public.start_ranked_run(uuid,text),public.submit_ranked_score(uuid,integer,integer,integer,integer,integer,double precision,integer,integer),public.get_demo_leaderboard(text) to authenticated;
commit;
