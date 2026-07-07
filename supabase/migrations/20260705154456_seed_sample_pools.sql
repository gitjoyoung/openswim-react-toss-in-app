-- 개발용 샘플 데이터 (강남권). 좌표는 근사값, 시간표/요금은 placeholder -> 실제 수집값으로 교체 필요.
insert into public.pools (name, gu, address, lat, lng, phone, homepage_url, price_free_swim, price_note, facilities, free_swim) values
('강남구민체육센터 수영장', '강남구', '서울 강남구 삼성동', 37.5145, 127.0495, '02-000-0000', null, 5000, '샘플 요금', '{"lanes":6,"depth":"1.2~1.4m","shower":true,"parking":true}',
  '[{"day":1,"sessions":[{"start":"06:00","end":"08:00"},{"start":"12:00","end":"13:30"}]},{"day":6,"sessions":[{"start":"09:00","end":"18:00"}]}]'),
('대치유수지 실내수영장', '강남구', '서울 강남구 대치동', 37.4939, 127.0668, '02-000-0000', null, 4500, '샘플 요금', '{"lanes":8,"depth":"1.3m","shower":true,"parking":true}',
  '[{"day":2,"sessions":[{"start":"06:00","end":"09:00"}]},{"day":4,"sessions":[{"start":"20:00","end":"22:00"}]}]'),
('논현정보도서관 수영장', '강남구', '서울 강남구 논현동', 37.5110, 127.0290, '02-000-0000', null, 5000, '샘플 요금', '{"lanes":5,"depth":"1.2m","shower":true,"parking":false}',
  '[{"day":0,"sessions":[{"start":"10:00","end":"17:00"}]},{"day":3,"sessions":[{"start":"12:00","end":"14:00"}]}]'),
('역삼실내수영장', '강남구', '서울 강남구 역삼동', 37.4995, 127.0365, '02-000-0000', null, 6000, '샘플 요금', '{"lanes":6,"depth":"1.4m","shower":true,"parking":true}',
  '[{"day":1,"sessions":[{"start":"19:00","end":"21:00"}]},{"day":5,"sessions":[{"start":"19:00","end":"21:00"}]}]'),
('세곡스포츠센터 수영장', '강남구', '서울 강남구 세곡동', 37.4665, 127.1015, '02-000-0000', null, 4000, '샘플 요금', '{"lanes":6,"depth":"1.2~1.5m","shower":true,"parking":true}',
  '[{"day":6,"sessions":[{"start":"08:00","end":"12:00"}]},{"day":0,"sessions":[{"start":"08:00","end":"12:00"}]}]'),
('일원에코스포츠센터 수영장', '강남구', '서울 강남구 일원동', 37.4885, 127.0855, '02-000-0000', null, 5500, '샘플 요금', '{"lanes":8,"depth":"1.3m","shower":true,"parking":true}',
  '[{"day":2,"sessions":[{"start":"06:00","end":"08:00"},{"start":"21:00","end":"22:00"}]},{"day":4,"sessions":[{"start":"06:00","end":"08:00"}]}]');
