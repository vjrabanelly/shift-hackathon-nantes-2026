-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- events
-- ============================================================
create table events (
  id            uuid primary key default uuid_generate_v4(),
  admin_token   text not null unique,
  name          text not null,
  vibe_config   jsonb not null default '{}',
  -- vibe_config shape:
  -- {
  --   "context": "Birthday party for 30-year-olds...",
  --   "energy_profile": "chill_to_intense",
  --   "genre_allow": ["indie rock", "90s hip-hop"],
  --   "genre_block": ["country", "heavy metal"]
  -- }
  genre_rules   jsonb not null default '{"allow": [], "block": []}',
  seed_playlist jsonb not null default '[]',
  -- seed_playlist: array of { title, artist, youtube_id }
  created_at    timestamptz not null default now()
);

-- ============================================================
-- guests
-- ============================================================
create table guests (
  id           uuid primary key default uuid_generate_v4(),
  event_id     uuid not null references events(id) on delete cascade,
  display_name text not null,
  emoji        text not null default '🎵',
  joined_at    timestamptz not null default now()
);

create index idx_guests_event_id on guests(event_id);

-- ============================================================
-- tracks
-- ============================================================
create type track_status as enum ('queued', 'playing', 'played');

create table tracks (
  id                uuid primary key default uuid_generate_v4(),
  event_id          uuid not null references events(id) on delete cascade,
  title             text not null,
  artist            text not null,
  duration          integer,                    -- seconds, null until analyzed
  youtube_id        text,
  file_path         text,                        -- absolute path on API server disk
  cover_url         text,
  essentia_features jsonb,
  -- essentia_features shape:
  -- { "bpm": 128.0, "key": "C major", "energy": 0.75, "mood": "happy" }
  added_by          text not null,              -- guest UUID or 'ai'
  status            track_status not null default 'queued',
  position          integer not null default 0, -- lower = plays sooner
  started_at        timestamptz,                -- set when status transitions to 'playing'
  created_at        timestamptz not null default now()
);

create index idx_tracks_event_id_status on tracks(event_id, status);
create index idx_tracks_event_id_position on tracks(event_id, position);

-- ============================================================
-- joystick_positions
-- ============================================================
create table joystick_positions (
  id         uuid primary key default uuid_generate_v4(),
  event_id   uuid not null references events(id) on delete cascade,
  guest_id   uuid not null references guests(id) on delete cascade,
  valence    float not null default 0.0,   -- -1.0 (sad) to 1.0 (happy)
  energy     float not null default 0.0,   -- -1.0 (chill) to 1.0 (intense)
  updated_at timestamptz not null default now(),
  unique(event_id, guest_id)
);

create index idx_joystick_event_id on joystick_positions(event_id);

-- ============================================================
-- requests
-- ============================================================
create type request_status as enum ('pending', 'resolved', 'failed');

create table requests (
  id                 uuid primary key default uuid_generate_v4(),
  event_id           uuid not null references events(id) on delete cascade,
  guest_id           uuid not null references guests(id) on delete cascade,
  raw_text           text not null,
  resolved_track_id  uuid references tracks(id),
  status             request_status not null default 'pending',
  created_at         timestamptz not null default now()
);

create index idx_requests_event_id on requests(event_id);

-- ============================================================
-- Enable Row Level Security (permissive for hackathon)
-- ============================================================
alter table events enable row level security;
alter table guests enable row level security;
alter table tracks enable row level security;
alter table joystick_positions enable row level security;
alter table requests enable row level security;

-- Allow all operations for anon key (hackathon: no per-row auth)
create policy "anon_all_events" on events for all using (true) with check (true);
create policy "anon_all_guests" on guests for all using (true) with check (true);
create policy "anon_all_tracks" on tracks for all using (true) with check (true);
create policy "anon_all_joystick" on joystick_positions for all using (true) with check (true);
create policy "anon_all_requests" on requests for all using (true) with check (true);

-- ============================================================
-- Enable real-time on relevant tables
-- ============================================================
alter publication supabase_realtime add table tracks;
alter publication supabase_realtime add table joystick_positions;
alter publication supabase_realtime add table guests;
