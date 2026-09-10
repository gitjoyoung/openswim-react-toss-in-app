-- 수영장 이미지 버킷 (공개 읽기). 시딩 동안만 익명 업로드 허용 → 이후 잠금.
insert into storage.buckets (id, name, public)
values ('pool-images', 'pool-images', true)
on conflict (id) do update set public = true;

-- 공개 읽기
drop policy if exists "pool-images public read" on storage.objects;
create policy "pool-images public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'pool-images');

-- 시딩용 임시 업로드(익명) — 시딩 후 20260706090000 에서 제거
drop policy if exists "pool-images seed insert" on storage.objects;
create policy "pool-images seed insert"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'pool-images');
