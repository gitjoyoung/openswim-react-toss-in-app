-- 중복 재발 방지: 같은 지역(sido, gu)에 띄어쓰기·대소문자만 다른 같은 이름이 다시 들어오지 못하게 한다.
-- 출처가 다른 시드가 on conflict 없이 각각 insert 되면서 "안양종합운동장 실내수영장"과
-- "안양종합운동장실내수영장" 같은 쌍이 쌓였던 이력을 막기 위한 제약이다.
-- 지역이 다른 동명 시설(용인/안산 월드스포츠센터 등)은 그대로 허용된다.
create unique index if not exists pools_normalized_name_region_idx
  on public.pools (
    lower(regexp_replace(name, '\s', '', 'g')),
    coalesce(sido, ''),
    gu
  );
