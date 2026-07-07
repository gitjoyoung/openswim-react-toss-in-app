-- 이미지 webp 최적화: 참조 중인 이미지 URL 확장자를 .jpg -> .webp 로 교체 (591곳)
-- 무관 이미지 189곳은 이미 images = '{}' 라 대상 아님. webp 파일 업로드 후 적용.
update public.pools
set images = array[replace(images[1], '.jpg', '.webp')]
where array_length(images, 1) >= 1
  and images[1] like '%.jpg';
