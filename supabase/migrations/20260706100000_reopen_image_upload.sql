-- 잔여 이미지 시딩 위해 익명 업로드 임시 재개.
drop policy if exists "pool-images seed insert" on storage.objects;
create policy "pool-images seed insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'pool-images');
