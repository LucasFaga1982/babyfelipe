create extension if not exists pgcrypto;

create table if not exists public.game_state (
  id bigint primary key,
  phase text not null default 'waiting' check (phase in ('waiting', 'collecting', 'revealed')),
  current_round integer not null default 1,
  registration_open boolean not null default true,
  belly_actual numeric null,
  current_result jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sticker_id text not null,
  tie_break_guess numeric null,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guesses (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  round_number integer not null,
  guess_value numeric not null,
  signed_diff numeric null,
  absolute_diff numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guesses_unique_player_round unique(player_id, round_number)
);

insert into public.game_state (id, phase, current_round, registration_open)
values (1, 'waiting', 1, true)
on conflict (id) do nothing;

create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_game_state on public.game_state;
create trigger set_timestamp_game_state
before update on public.game_state
for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp_guesses on public.guesses;
create trigger set_timestamp_guesses
before update on public.guesses
for each row execute function public.set_timestamp();

alter table public.game_state enable row level security;
alter table public.players enable row level security;
alter table public.guesses enable row level security;

drop policy if exists "game_state_select" on public.game_state;
drop policy if exists "game_state_update" on public.game_state;
drop policy if exists "players_select" on public.players;
drop policy if exists "players_insert" on public.players;
drop policy if exists "players_update" on public.players;
drop policy if exists "players_delete" on public.players;
drop policy if exists "guesses_select" on public.guesses;
drop policy if exists "guesses_insert" on public.guesses;
drop policy if exists "guesses_update" on public.guesses;
drop policy if exists "guesses_delete" on public.guesses;

-- Políticas abiertas para un evento social simple.
-- Si después querés más seguridad, conviene pasar acciones sensibles a Edge Functions.
create policy "game_state_select" on public.game_state for select using (true);
create policy "game_state_update" on public.game_state for update using (true) with check (true);

create policy "players_select" on public.players for select using (true);
create policy "players_insert" on public.players for insert with check (true);
create policy "players_update" on public.players for update using (true) with check (true);
create policy "players_delete" on public.players for delete using (true);

create policy "guesses_select" on public.guesses for select using (true);
create policy "guesses_insert" on public.guesses for insert with check (true);
create policy "guesses_update" on public.guesses for update using (true) with check (true);
create policy "guesses_delete" on public.guesses for delete using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.game_state;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.guesses;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.game_state replica identity full;
alter table public.players replica identity full;
alter table public.guesses replica identity full;
