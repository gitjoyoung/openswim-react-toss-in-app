-- 수영장 이용 대상 제한(여성 전용, 어린이 입장 불가, 일부 시간 회원 전용 등).
--
-- 왜 컬럼 두 개인가:
--   access_label 은 목록 카드와 상세 상단 배지에 들어간다. 레이아웃이 깨지지 않게 짧게 쓴다.
--   access_note 는 상세에서 배지 옆에 붙는 한 줄 설명이다. 비워도 된다.
--
-- 왜 분류(enum)를 두지 않는가:
--   '여성 전용', '유소년 중심', '회원 전용'처럼 유형이 계속 늘어난다.
--   코드에 분류를 두면 유형 하나 추가할 때마다 앱을 다시 배포해야 한다.
--   자유 텍스트로 두면 이 컬럼만 update 하면 끝난다.
--
-- 값이 비어 있으면 화면에 아무것도 나오지 않는다.
-- 확인되지 않은 수영장은 비워 둔다. 틀린 배지보다 없는 게 낫다.
alter table public.pools add column if not exists access_label text;
alter table public.pools add column if not exists access_note  text;

comment on column public.pools.access_label is '이용 대상 제한 배지 문구. 짧게 쓴다(예: 여성 전용). 비면 표시하지 않는다.';
comment on column public.pools.access_note is '배지 옆에 붙는 한 줄 설명. 선택.';

-- 아래 4건은 새로 조사한 값이 아니다.
-- 이미 price_note / free_swim_note 에 문장으로 들어 있던 제한을 배지로 쓸 수 있게 옮긴 것이다.
-- 원문은 그 컬럼에 그대로 둔다.
update public.pools
   set access_label = '유소년 중심',
       access_note  = '성인 자유수영은 허용 시간대를 미리 확인해 주세요.'
 where name = '강동유소년스포츠센터 수영장';

update public.pools
   set access_label = '어린이 입장 제한',
       access_note  = '토요일 06:00~10:50은 어린이가 입장할 수 없습니다.'
 where name = '언북문화체육센터';

update public.pools
   set access_label = '일부 시간 회원 전용',
       access_note  = '평일 08:00 타임은 월정기권 회원만 이용할 수 있습니다.'
 where name = '용산문화체육센터';

update public.pools
   set access_label = '주말만 자유수영',
       access_note  = '평일 수영장은 강습 등록 회원 전용이라 일일 자유수영이 없습니다.'
 where name = '감일복합커뮤니티센터 수영장';

-- 넣지 않은 것들:
--   · 방역·수질정화로 특정 시간 입장 불가(구미시선산청소년수련관, 순천문화건강센터)
--     → 사람 기준 제한이 아니라 시간대 운영이다. 시간표에서 다룰 값이다.
--   · 이름에 '(여성전용)', '(장애인전용)', '(회원제)'가 붙은 수영장
--     → 그 표기가 시설의 공식 안내인지 우리 조사 메모인지 확인되지 않았다.
--       공식 페이지에서 확인한 뒤에 넣는다.
