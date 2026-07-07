-- 중복 정리: 완전한 레코드에 나머지 고유 요일·정보 병합 후 중복 삭제.
delete from public.pools where id='73bf3ac2-e955-4e20-8e95-67527bd0c7e2';  -- dup 고양어울림누리체육센터
delete from public.pools where id='1310a299-c3c0-487c-bc22-74915c4c58bb';  -- dup 장애인종합복지관 수중재활센터(Comprehensive Welfare Center)
delete from public.pools where id='48f3a0ea-229b-4110-8bfb-1fd4a6c66e96';  -- dup 용산구문화체육센터
delete from public.pools where id='36ce0485-62aa-4253-a18e-265b18e5f517';  -- dup 시립구로청소년수련관(Guro Youth Center)
delete from public.pools where id='e4e69274-197d-475c-9459-424c7a1ba313';  -- dup 장안구민회관수영장
delete from public.pools where id='38000b02-2eb2-4b4d-b629-3c1c530a7a14';  -- dup 백석체육센터
update public.pools set subway='광교중앙역' where id='64fe79d0-9f0a-4bf7-8613-609032d9bae7';  -- keep 광교복합체육센터
delete from public.pools where id='7a1260c6-65fe-4eea-b787-1bc6e1a151f2';  -- dup 광교체육센터
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/c4514579-e102-4feb-9be1-f059f9940d7f.webp"]'::jsonb where id='e99d5630-2f13-4614-a5cc-85c7f2438f5d';  -- keep 동탄복합문화센터내 실내수영장
delete from public.pools where id='c4514579-e102-4feb-9be1-f059f9940d7f';  -- dup 동탄복합문화센터
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/966372c0-c439-447d-9bde-d912564535fd.webp"]'::jsonb where id='74968640-880c-4f8a-9b88-c5592011ae74';  -- keep 안산 선부다목적체육관수영장
delete from public.pools where id='966372c0-c439-447d-9bde-d912564535fd';  -- dup 선부다목적체육관
delete from public.pools where id='7c3eb236-22c5-40fc-926e-05f7ad1e309a';  -- dup 시흥능곡어울림센터
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/d8fe65db-5c69-4a5f-8bbc-345f6c2c6f58.webp"]'::jsonb where id='5984fec4-a26c-4c46-a273-ae8eb7abac59';  -- keep 의정부시청소년회관 실내수영장
delete from public.pools where id='d8fe65db-5c69-4a5f-8bbc-345f6c2c6f58';  -- dup 의정부시청소년수련관수영장
delete from public.pools where id='b0f71926-2ba6-4e71-8586-47a48afab839';  -- dup 용산청소년수련관수영장
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/57a2dccc-93d8-4ab2-a424-f9c19a172339.jpg"]'::jsonb where id='270cf550-8d82-4dbd-9f34-2688efaf09ba';  -- keep 목포실내체육관 실내수영장
delete from public.pools where id='57a2dccc-93d8-4ab2-a424-f9c19a172339';  -- dup 목포실내체육관
delete from public.pools where id='7a86e966-e389-4e06-8ac3-4e85c3ed9bbc';  -- dup 올림픽스포츠센터수영장
delete from public.pools where id='730907f6-a60b-4f50-92f3-4c358e78d0ef';  -- dup 구리청소년수련관 수영장
delete from public.pools where id='1204ad67-628d-4e28-ad6a-2e69b50f29d9';  -- dup 함안체육관실내수영장
delete from public.pools where id='c8b7978c-f486-43f8-8380-815061c1a6e8';  -- dup 인천도원수영장
delete from public.pools where id='855113be-5b0f-4a58-bfe0-9ae724a9be53';  -- dup 동구국민체육센터
delete from public.pools where id='d257b7cc-c158-4d1d-bb30-07f76e67a97a';  -- dup 잠실 제1수영장(Jamsil Swimming Pool)
delete from public.pools where id='ece87b5c-c33a-48d1-b8ba-cd5dec41fa09';  -- dup 성남시평생학습관스포츠센터
update public.pools set price_note='성인 기준 비회원 일일 자유수영 요금' where id='088dd13b-5d38-4189-9bef-fedf93d9cecb';  -- keep 수원체육문화센터
delete from public.pools where id='c136a1bf-2f84-442b-9e87-cb2c40255a70';  -- dup 수원체육문화센터 수영장
delete from public.pools where id='aa216ae7-d953-499f-b52d-34e5fe9835fd';  -- dup 수원체육문화체육센터
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/f142dd8a-93ef-4b86-98a6-7919eead98b9.webp"]'::jsonb where id='dfaa5809-815b-4a53-846e-5eeab977c8d4';  -- keep 국민체육센터 수영장
delete from public.pools where id='f142dd8a-93ef-4b86-98a6-7919eead98b9';  -- dup 여주국민체육센터
delete from public.pools where id='24e0926e-e7b9-47bb-bd9d-ab66515663b2';  -- dup 홍천군국민체육센터
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/e0547886-8983-40cc-a68c-de439fc71f89.webp"]'::jsonb where id='8759430c-7d9b-46f1-aa21-9841f6c1191d';  -- keep 고양체육관 수영장
delete from public.pools where id='e0547886-8983-40cc-a68c-de439fc71f89';  -- dup 고양체육관
update public.pools set images='["https://dkvkectdsohdystvlacq.supabase.co/storage/v1/object/public/pool-images/75394380-19b8-45e2-8d25-1e3e0e7189af.webp"]'::jsonb where id='183220c3-272e-497d-9113-111802378246';  -- keep 성남종합스포츠센터 수영장
delete from public.pools where id='75394380-19b8-45e2-8d25-1e3e0e7189af';  -- dup 성남종합스포츠센터
update public.pools set price_note='성인 관내 거주자 일일 입장료' where id='dd75be16-4c16-4e45-99d2-2cf037bb340f';  -- keep 안산올림픽기념관수영장
delete from public.pools where id='fb330f25-fc59-4d37-b182-b4071ac2f11c';  -- dup 안산 올림픽기념관 수영장
delete from public.pools where id='84f4fe6c-55c6-4b5c-a474-8e7ff102d3a3';  -- dup 중구회현체육센터
delete from public.pools where id='37167cc8-dcf8-4199-b9d3-c01b5864bd96';  -- dup 시흥국민체육센터
delete from public.pools where id='1bf15de5-4505-491a-bbbb-6e243d75ad40';  -- dup 호수공원실내수영장
delete from public.pools where id='e3690a2f-be5a-454c-86fe-69287d666471';  -- dup 동탄어울림체육센터
delete from public.pools where id='9064490c-326f-4b42-bdd7-b9ad552eb1ed';  -- dup 화도문화체육센터
delete from public.pools where id='4c4cfdc8-3399-441b-8e1a-a68b0deed334';  -- dup 노원청소년센터
delete from public.pools where id='fc474797-7419-4113-b7aa-3dafc7a481d8';  -- dup 화성그린환경센터주민편익시설
