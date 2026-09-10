-- 여주국민체육센터가 제네릭명으로 남음 → 정정.
update public.pools set name = '여주국민체육센터'
where name = '국민체육센터 수영장' and gu = '여주시';
