-- 폐관(운영종료) 시설 제거 — 죽은 데이터로 사용자 헛걸음 유발.
delete from public.pools where name ~ '운영종료|Permanent Closure';
