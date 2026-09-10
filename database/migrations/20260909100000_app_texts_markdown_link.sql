-- 근거 문구의 링크를 문장 안 마크다운으로 옮긴다.
--
-- 앞선 마이그레이션은 링크가 걸릴 부분을 pool_notice_link_label 행에 따로 뒀는데,
-- 문구를 고치다 그 문자열이 사라지면 링크가 조용히 없어진다. 문구만 보고는 알 수 없다.
-- 이제 앱이 마크다운 링크를 파싱하므로 문장 하나만 관리하면 된다.
--
--   [보일 글자]({source})   →  링크. {source} 는 pools.free_swim_source 로 치환된다.
--   {date}                 →  pools.free_swim_verified_at 로 치환된다.
--
-- 근거 URL 이 없는 수영장은 {source} 가 빈 문자열이 되고, 앱은 링크 없이 글자만 보여준다.
-- http(s) 가 아닌 주소는 앱이 링크로 만들지 않는다.
update public.app_texts
   set value = '[해당 수영장 정보]({source})를 {date} 확인하였습니다.',
       description = '수영장 상세 시간표 아래 첫 줄. {date}=확인 날짜, {source}=근거 페이지 주소. [글자](주소) 는 링크가 된다.',
       updated_at = now()
 where key = 'pool_notice_verified';

delete from public.app_texts where key = 'pool_notice_link_label';
