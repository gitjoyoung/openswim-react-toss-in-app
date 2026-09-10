-- 신림체육센터: 첨벙 10원 오타(3,410) → 관할 실요금 3,400 (평일). 주말 4,400 유지.
update public.pools
set price_free_swim = 3400,
    prices = '[{"label":"평일","amount":3400},{"label":"주말","amount":4400}]'::jsonb
where name = '신림체육센터';
