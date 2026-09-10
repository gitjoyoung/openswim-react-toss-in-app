-- 시딩 완료 → 익명 업로드 정책 제거.
drop policy if exists "pool-images seed insert" on storage.objects;
