-- gu 값 오류 정규화 (부산진구·제주시는 정상이므로 제외).
update public.pools set gu = '미추홀구' where gu = '미추홀' and sido = '인천광역시';
update public.pools set gu = '중구'     where gu = '인천중구' and sido = '인천광역시';
update public.pools set gu = '동구'     where gu = '인천동구' and sido = '인천광역시';
