-- 수도권(서울/경기/인천) 지원: 시도 컬럼과 인근 지하철역 컬럼 추가.
-- gu 는 시군구(강남구/수원시/부평구)를 담는다.

alter table public.pools
  add column if not exists sido text,               -- 서울특별시 | 경기도 | 인천광역시
  add column if not exists subway text;             -- 인근 지하철역 (없으면 null)

comment on column public.pools.gu is '시군구 (서울: 자치구, 경기: 시/군, 인천: 자치구)';
comment on column public.pools.sido is '시도 (서울특별시/경기도/인천광역시)';

create index if not exists pools_sido_idx on public.pools (sido);
