<div align="center">

# 🏊 오늘 자유수영 (Openswim)

**오늘 자유수영이 가능한 공공 수영장을 한눈에** — 오늘 어디서 수영할지 지역과 내 위치를 바탕으로 찾는 [AppsInToss](https://apps-in-toss.toss.im/) 미니앱

</div>

## 미리보기

<p align="center">
  <img src="docs/preview/home.png" width="30%" alt="홈" />&nbsp;
  <img src="docs/preview/nearby.png" width="30%" alt="내 주변" />&nbsp;
  <img src="docs/preview/detail.png" width="30%" alt="상세" />
</p>

> 위 이미지는 브랜드 미리보기예요. 실제 스크린샷을 `docs/preview/{home,nearby,detail}.png` 로 교체하면 자동으로 반영됩니다.

## 주요 기능

- 📍 **지역·내 위치 기반 검색** — 구 단위 지역 검색(엔터 시 지역 우선 매칭), 위치 권한이 있으면 가까운 순, 없으면 금천구 기본 정렬
- 🗓️ **오늘/토/일 · 공휴일 운영 판별** — 요일별 자유수영 시간표 + 공휴일 처리(운영 / 휴무 / 정보 없음)
- 🗺️ **지도** — 카카오맵에 전체 수영장 마커, 검색하면 해당 지역으로 이동, 카카오맵·네이버 길찾기
- ⭐ **즐겨찾기**, 상세 실제 요금표 등

## 기술 스택 (현재)

| 구분 | 사용 |
|------|------|
| 프론트 | React 18 · TypeScript · Vite |
| 플랫폼 | AppsInToss `@apps-in-toss/web-framework` 3.x (AIT) · TDS `@toss/tds-mobile` |
| 데이터 | Neon Postgres + Neon Data API/Auth(REST, 익명 토큰) 단일 원본. 폴백 없음 |
| 지도 | Kakao Maps JS SDK |

## 시작하기

```bash
# 1) 의존성 설치
pnpm install

# 2) 환경 변수 — .env 생성 (.env.example 참고)
#    VITE_KAKAO_JS_KEY / VITE_NEON_DATA_API_URL / VITE_NEON_AUTH_URL
#    (VITE_* 값은 클라이언트 번들에 포함되므로 공개 가능한 값만 넣는다.
#     DB 연결 문자열·관리자 API 키는 여기 넣지 않는다.)

# 3) 개발 서버
pnpm run dev

# 4) 빌드 (AIT 아티팩트 openswim.ait 생성)
pnpm run build
```

> 수영장 데이터는 **Neon 서버가 유일한 원본**입니다. 원격 조회가 실패하면 번들 데이터로 대체하지 않고 "정보를 불러오지 못했어요 + 다시 시도" 화면을 보입니다. 예전에는 `src/data/pools.json` 폴백이 있었으나 2026-09-10 에 폐기했습니다 — 폴백은 빌드 시점에 고정되어 반드시 낡는데, 사용자에겐 최신 데이터와 구분이 안 돼서 휴장한 수영장을 "오늘 열림"으로 보여주는 오답을 조용히 냅니다. `.manus/neon-migration/`은 초기 이관용 보조 스크립트입니다.

> 카카오맵은 사용 도메인을 카카오 콘솔 `[플랫폼 > Web]` 에 등록해야 표시됩니다. (`localhost:5173`, 배포 도메인 등)
> 그래서 `vite.config.ts`에서 dev/preview 서버를 `localhost:5173`으로 고정(`strictPort: true`)해 뒀습니다.
> 포트를 바꿔 띄우면 지도만 조용히 안 나오므로, 다른 포트로 띄우지 마세요. 5173이 이미 쓰이는 중이면 서버가 시작되지 않고 바로 실패합니다.

## 프로젝트 구조

```
src/
  screens/     홈 · 내 주변(지도) · 즐겨찾기 · 상세
  components/  SearchBox · PoolList · PoolMap · FavStar …
  lib/         pools(운영·공휴일 상태) · search(지역 검색) · geo · holidays …
  design/      tokens · primitives (토스풍 디자인 시스템)
  data/        gear.generated.json 등 정적 보조 데이터 (수영장 데이터는 Neon 에만 있다)
scripts/       근거 수집·검증 및 라이브 DB 감사·정리
evidence/      시설별 근거 번들 (원본 HTML·줄번호 텍스트·스크린샷·OCR)
database/      Neon 스키마 마이그레이션 (database/migrations). Neon 이관 전 Supabase 이력은 database/legacy-supabase 에 보관 (상세: database/README.md)
docs/          앱인토스·TDS 참고 문서, 데이터 감사 리포트, preview 이미지
```

## 데이터 관리

수영장 데이터의 원본은 **Neon 의 `public.pools` 테이블 하나뿐**이다. 수영장 중간 JSON 원본은 없애서,
조사한 값을 근거와 함께 DB 에 직접 넣는 방식으로 바꿨다.

조사 · 등록 절차는 `.claude/skills/korean-pool-research/SKILL.md` 가 기준이다. 요약하면:

```bash
set -a; source .env; set +a

# 1) 근거 수집 — 원본 HTML + 줄번호 텍스트 + manifest(해시·TLS 상태)
pnpm evidence:collect

# 2) 근거 대조 — DB 에 쓰려는 시각이 저장된 근거 어딘가에 실제로 있는지
pnpm evidence:coverage
#    본문에 없는 값만 그 요소를 크롭해 스크린샷 + OCR (JS 렌더링·이미지 시간표)
node scripts/ocr-timetable-images.mjs
node scripts/ocr-evidence-screenshots.mjs

# 3) 게이트 — provenance·번들 구성·근거 대조를 검사. 위반 시 exit 1
pnpm evidence:verify

# 4) 신규 등록 (INSERT 전용, 중복 방어선 포함)
node scripts/insert-new-pools.mjs           # dry-run
node scripts/insert-new-pools.mjs --write

# 5) 라이브 DB 감사·정리
node scripts/audit-db-integrity.mjs         # 좌표·주소·요금·연락처 정합성
node scripts/scan-duplicates-live.mjs       # 중복 후보 스캔
node scripts/classify-duplicates.mjs        # 병합 / 판단필요 / 오탐 분류
node scripts/cleanup-db.mjs                 # dry-run 후 --write
```

확인된 "서로 다른 시설" 조합은 `docs/data/pool-duplicate-whitelist.json` 에 사유와 함께 넣어두면
중복 스캔이 다시 잡지 않는다. 시설관리공단 대표번호를 공유해서 엮이는 경우가 대부분이다.

`free_swim` 스키마는 `day` 가 `0=일 … 6=토`, `7=공휴일` 이고, 각 요일은 `sessions: [{ start, end }]` 를 갖는다. 세션이 빈 배열이면 “그날 휴무” 를 뜻한다.

## 링크

- [앱인토스 콘솔](https://apps-in-toss.toss.im/), [개발자센터](https://developers-apps-in-toss.toss.im/), [개발자 커뮤니티](https://techchat-apps-in-toss.toss.im/)

## 만든 사람

- [0rigin.space](https://0rigin.space)
