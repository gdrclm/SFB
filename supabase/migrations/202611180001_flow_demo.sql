begin;
insert into public.sfb_demo_versions(id,active)
values ('demo-2026-11-18-flow',true)
on conflict (id) do nothing;
commit;
