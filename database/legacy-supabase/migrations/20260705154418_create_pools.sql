-- 수영장 정보 (서울 전역 자유수영)
create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gu text not null,                 -- 자치구 (홈 검색 키)
  address text,
  lat double precision,
  lng double precision,
  phone text,
  homepage_url text,
  price_free_swim integer,          -- 자유수영 1회 요금(원)
  price_note text,
  facilities jsonb not null default '{}'::jsonb,   -- {lanes, depth, shower, parking, ...}
  free_swim jsonb not null default '[]'::jsonb,     -- [{day:0-6, sessions:[{start,end}]}]
  updated_at timestamptz not null default now()
);

create index pools_gu_idx on public.pools (gu);

-- RLS: 익명(anon) 읽기 전용. 쓰기 정책 없음 -> 운영자가 service_role로만 입력.
alter table public.pools enable row level security;

create policy "pools are public readable"
  on public.pools for select
  to anon, authenticated
  using (true);
