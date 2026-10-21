\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.register_player('Метеор');
select public.start_ranked_run('10000000-0000-4000-8000-000000000001','demo-2026-10-21');
reset role;
update public.sfb_attempts set started_at=clock_timestamp()-interval '15 seconds';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.register_player('Комета');
do $$begin
 begin perform public.submit_ranked_score('10000000-0000-4000-8000-000000000001',100,2,5,50,5,40,1,10000);raise exception 'Ownership failed';exception when no_data_found then null;end;
 begin insert into public.leaderboard_scores(player_id,demo_version,score,depth,coins,platforms,combo_bonus,best_combo,max_speed,stage,duration_ms,run_id)values(auth.uid(),'demo-2026-10-21',999,0,0,0,0,0,0,0,0,gen_random_uuid());raise exception 'Direct write allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.submit_ranked_score('10000000-0000-4000-8000-000000000001',100,2,5,50,5,40,1,10000);
select public.submit_ranked_score('10000000-0000-4000-8000-000000000001',9999999,999,5,50,5,40,1,10000);
do $$declare board jsonb;begin
 board:=public.get_demo_leaderboard('demo-2026-10-21');
 assert jsonb_array_length(board->'top')=1;
 assert (board->'self'->>'score')::int=295;
 assert (board->'self'->>'rank')::int=1;
end $$;
select public.start_ranked_run('10000000-0000-4000-8000-000000000002','demo-2026-10-21');
reset role;
update public.sfb_attempts set started_at=clock_timestamp()-interval '15 seconds';
set local role authenticated;
select public.submit_ranked_score('10000000-0000-4000-8000-000000000002',100,0,5,50,5,40,1,10000);
do $$declare board jsonb;begin
 board:=public.get_demo_leaderboard('demo-2026-10-21');assert jsonb_array_length(board->'top')=1;assert(board->'self'->>'score')::int=295;
 begin perform public.register_player('<script>');raise exception 'Invalid name accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
rollback;
