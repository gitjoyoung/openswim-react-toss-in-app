-- 미사용 메타 컬럼 제거.
alter table public.pools drop column if exists data_confidence;
