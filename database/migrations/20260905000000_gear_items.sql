-- 수영용품 추천(토스쇼핑 쉐어링크) 목록.
--
-- 운영 방식: 이 테이블에 url 한 줄만 넣으면 된다.
-- name/image_url/product_id 는 `pnpm gear:sync` 가 각 링크의 og 태그를 읽어 채운다.
-- 앱은 name/image_url 이 채워지고 is_active 인 행만 보여준다.
--
-- 권한은 public.pools 와 같은 형태로 맞춘다: RLS 켜고 anonymous 읽기 전용.
-- 쓰기는 neondb_owner(동기화 스크립트)만 한다.
create table if not exists public.gear_items (
  id uuid primary key default gen_random_uuid(),

  -- 토스 앱 상품 상세 > 공유 > '쉐어링크 공유하기' 로 발급한 추적 링크.
  -- 일반 공유 링크는 수익이 집계되지 않아서 형식을 제약한다.
  url text not null unique check (url like 'https://toss.im/_m/%'),

  -- 화면에 상품명 아래 붙는 한 줄 설명. 비워도 된다.
  note text,

  -- 아래 세 컬럼은 동기화 스크립트가 채운다. 손으로 넣지 않는다.
  name text,
  image_url text,
  product_id text,

  -- 목록은 created_at 내림차순(최신 등록순)으로 보여준다.
  -- sort_order 는 같은 시각에 여러 건을 넣었을 때 순서를 고정하는 보조 키다.
  sort_order integer not null default 0,
  is_active boolean not null default true,

  synced_at timestamptz,
  -- 링크가 죽었을 때 이유를 남긴다. 조용히 사라지면 수익만 없어지고 알아채기 어렵다.
  sync_error text,

  created_at timestamptz not null default now()
);

comment on table public.gear_items is '토스쇼핑 쉐어링크 수영용품 추천 목록. url만 넣고 sync 스크립트가 og 정보를 채운다.';
comment on column public.gear_items.url is '쉐어링크 추적 링크. 일반 공유 링크를 넣으면 수익이 집계되지 않는다.';
comment on column public.gear_items.sync_error is 'og 조회 실패 사유. 값이 있으면 링크 점검이 필요하다.';

-- 앱 조회 경로: is_active 이고 og 동기화가 끝난 행만, 최신 등록순으로.
create index if not exists gear_items_visible_idx
  on public.gear_items (created_at desc, sort_order)
  where is_active and name is not null and image_url is not null;

alter table public.gear_items enable row level security;

drop policy if exists gear_items_public_read on public.gear_items;
create policy gear_items_public_read
  on public.gear_items for select
  to anonymous, authenticated
  using (true);

grant select on public.gear_items to anonymous;
