-- 사설·대학 시설 제거 (공공 자유수영 목록 정합성). 시립/복컴/위탁공공은 유지.
delete from public.pools where name in (
  '스포타임(SPORTIME)',
  'ATB압구정점',
  '스윔핏성수점',
  '동서대학교글로벌스포츠센터',
  '울산대학교아산스포츠센터',
  '동의과학대학교스포츠센터',
  '서울YWCA스포츠센터',
  '용인YMCA스포츠센터',
  '서울YMCA고양국제청소년문화센터'
);
-- 카카오 POI 찌꺼기 이름 정리
update public.pools set name = '아름스포츠센터'
where name like '아름동아름스포츠센터%';
