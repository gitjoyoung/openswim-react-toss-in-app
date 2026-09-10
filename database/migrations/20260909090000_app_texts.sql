-- 앱 화면에 나가는 공통 문구. 배포 없이 문구만 바꾸기 위해 DB로 뺀다.
--
-- 지금 담는 것은 수영장 상세 시간표 아래 근거 문구다.
-- 값(확인 날짜·근거 링크·경고 여부)은 public.pools 의 free_swim_* 컬럼에서 오고,
-- 문장 표현만 여기서 관리한다. 이 테이블을 update 하면 다음 앱 실행부터 바로 반영된다.
--
-- 앱은 조회 실패 시 번들에 박힌 기본 문구로 폴백하므로, 행이 없어도 화면이 비지는 않는다.
-- 권한은 public.pools 와 같은 형태다: RLS 켜고 anonymous 읽기 전용, 쓰기는 neondb_owner.
create table if not exists public.app_texts (
  key text primary key,
  value text not null,
  -- 운영자가 나중에 이 행이 어디에 쓰이는지 알 수 있게 남긴다.
  description text,
  updated_at timestamptz not null default now()
);

comment on table public.app_texts is '앱 공통 문구. 배포 없이 문구를 바꾸기 위한 테이블.';
comment on column public.app_texts.key is '앱 코드가 참조하는 키. 임의로 바꾸면 폴백 문구가 나간다.';

-- {date} 는 앱이 pools.free_swim_verified_at 값으로 치환한다. 다른 치환자는 없다.
-- pool_notice_link_label 은 pool_notice_verified 문장 안에서 링크로 바뀌는 부분이다.
-- 문장에 그 문자열이 없으면 링크 없이 문장만 나간다.
insert into public.app_texts (key, value, description) values
  (
    'pool_notice_verified',
    '해당 수영장 정보를 {date} 확인하였습니다.',
    '수영장 상세 시간표 아래 첫 줄. {date} 는 확인 날짜로 치환된다.'
  ),
  (
    'pool_notice_link_label',
    '해당 수영장 정보',
    'pool_notice_verified 안에서 근거 페이지 링크가 걸리는 부분.'
  ),
  (
    'pool_notice_unverified',
    '시간표 정보를 확인하지 못했습니다.',
    '확인 날짜가 없는 수영장에서 첫 줄 대신 나가는 문장.'
  ),
  (
    'pool_notice_caution',
    '방문 전 확인이 필요합니다.',
    '공식 페이지에서 확인하지 못한 수영장의 둘째 줄.'
  )
on conflict (key) do nothing;

alter table public.app_texts enable row level security;

drop policy if exists app_texts_public_read on public.app_texts;
create policy app_texts_public_read
  on public.app_texts for select
  to anonymous, authenticated
  using (true);

grant select on public.app_texts to anonymous;

-- 새 테이블은 PostgREST 스키마 캐시를 깨워야 조회된다.
notify pgrst, 'reload schema';
