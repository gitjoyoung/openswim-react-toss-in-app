-- 부산강서체육공원 실내수영장: 죽은 링크 수정
-- http://www.busan.go.kr/health/stadiumgsswim01 → busan.go.kr/depart/index 로 리다이렉트(엉뚱한 페이지)
-- 부산시 체육시설관리사업소로 이관되며 경로 /health/ → /stadium/ 변경됨
update public.pools
set homepage_url = 'https://www.busan.go.kr/stadium/sfstadiumgsswim01'
where id = '664d1e0b-1831-4555-868d-b1a26fd62282';
