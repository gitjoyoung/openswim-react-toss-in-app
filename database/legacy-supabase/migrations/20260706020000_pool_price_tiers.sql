-- 요금 티어: 비할인(일반) + 할인(회원/지역주민 등). label 자유 텍스트, amount 원.
alter table public.pools add column prices jsonb not null default '[]'::jsonb;

-- 샘플: 기존 price_free_swim을 '일반'으로, 회원/지역 할인가를 파생 생성.
update public.pools set prices = jsonb_build_array(
  jsonb_build_object('label', '일반',     'amount', price_free_swim),
  jsonb_build_object('label', '회원',     'amount', greatest(price_free_swim - 1000, 0)),
  jsonb_build_object('label', '지역주민', 'amount', greatest(price_free_swim - 500, 0))
) where price_free_swim is not null;
