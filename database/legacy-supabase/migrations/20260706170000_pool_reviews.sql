-- 수영장별 제보·후기 (미비 정보 사용자 제보 수집). 익명 작성 허용.
create table if not exists public.pool_reviews (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid not null references public.pools(id) on delete cascade,
  nickname   text check (nickname is null or char_length(nickname) <= 20),
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists pool_reviews_pool_created_idx
  on public.pool_reviews (pool_id, created_at desc);

alter table public.pool_reviews enable row level security;

-- 누구나 읽기
create policy "pool_reviews read"
  on public.pool_reviews for select to anon, authenticated using (true);

-- 누구나 작성(본문 1~1000자, 닉네임 20자 이하). 수정·삭제는 서비스롤(운영)만.
create policy "pool_reviews insert"
  on public.pool_reviews for insert to anon, authenticated
  with check (
    char_length(btrim(body)) between 1 and 1000
    and (nickname is null or char_length(nickname) <= 20)
  );
