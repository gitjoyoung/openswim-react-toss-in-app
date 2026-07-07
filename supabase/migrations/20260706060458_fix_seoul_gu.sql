-- gu='서울시'(구 정보 누락) → 주소에서 확인한 실제 자치구로 교정.
update public.pools set gu = '강남구' where id = 'fd29cedf-9da8-43f2-b2b4-75b3244fa073';
update public.pools set gu = '서초구' where id = 'd0a1caa6-5d9e-4f8f-9112-a0b253cc395e';
update public.pools set gu = '금천구' where id = '1366f298-fb08-47f0-8ee6-f36bb0b9d92c';
update public.pools set gu = '용산구' where id = '19aa467f-1aaa-461e-a10e-aa4553e36a05';
update public.pools set gu = '마포구' where id = '06742806-281e-4847-80f4-6ad91cab70f9';
