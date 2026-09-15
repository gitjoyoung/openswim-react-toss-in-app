# 오늘 자유수영 — 기획서 및 현재 아키텍처

> 전국 수영장의 **자유수영 시간·정보**를 찾는 앱인토스 미니앱.
> 로그인 없이 시작, 위치 기반 정렬, 즐겨찾기(로컬 저장).

> **현재 기준 (2026-09):** 런타임 백엔드는 **Neon(Postgres + Neon Data API/Auth)** 단일 기준이다. 프론트는 `VITE_NEON_DATA_API_URL`과 `VITE_NEON_AUTH_URL`로 익명 토큰을 발급받아 `GET /pools`를 조회하고(`src/pool.ts`), 원격 조회에 실패하면 폴백 없이 오류 화면을 띄운다(번들 JSON 폴백은 2026-09-10 폐기). 데이터 원본은 Neon `public.pools` 테이블 하나뿐이며, 중간 JSON 원본과 동기화 스크립트는 두지 않는다. Neon 스키마 변경은 `database/migrations/`에 둔다. `database/legacy-supabase/`는 Neon 이전 전의 보관용 이력이며 런타임·배포·데이터 운영에 사용하지 않는다.

---

## 1. 한 줄 정의

> "지금 서울에서 자유수영 갈 만한 수영장을, 내 주변/지역구로 찾고 즐겨찾기해두는 앱."

---

## 2. 정보구조 (하단 탭 3개)

```
┌───────────────────────────────────────────┐
│                  (화면)                     │
├──────────────┬──────────────┬──────────────┤
│    🏠 홈      │  📍 내 주변   │  ⭐ 즐겨찾기   │
└──────────────┴──────────────┴──────────────┘
```

| 탭 | 목적 | 핵심 요소 |
|----|------|-----------|
| **홈** | 진입·검색 | 소개 멘트 + 지역구(자치구) 기반 검색·목록 |
| **내 주변** | 근처 탐색 | 지도 SDK 임베드 + 현재위치(권한 없으면 기본 위치) |
| **즐겨찾기** | 재방문 | 로컬 저장된 수영장 목록 |

---

## 3. 화면별 상세

### 3.1 홈
- 상단: 짧은 소개 멘트 (TDS `Top`)
- **지역 검색**: 시·도/구 검색 → 선택 시 해당 지역 수영장 목록
- 목록 아이템: 수영장명 · 구 · (오늘 자유수영 시간 요약) · ⭐토글
- 아이템 탭 → **수영장 상세**

### 3.2 내 주변
- 지도 임베드(카카오맵 JS SDK 권장), 수영장 마커 표시
- 진입 시 위치 권한 요청
  - **허용** → 현재위치 중심, 반경 내 수영장
  - **거부/미응답** → 기본 위치로 표시
- 지도 이동 후 "이 위치에서 다시 검색" → 지도 중심 기준 재조회
- 마커/하단 카드 탭 → **수영장 상세**

### 3.3 즐겨찾기
- 로컬(localStorage)에 저장된 수영장 id 목록 → 상세 정보 렌더
- 비어 있으면 안내 문구 + 홈으로 유도

### 3.4 수영장 상세 (공통)
수집·표시 항목:
- **자유수영 시간표** (요일별 시간대) — 핵심
- **요금** (1회 이용료 / 자유수영가)
- **위치·전화·링크** (주소, 전화번호, 홈페이지, 길찾기, 주소 복사)
- **시설 정보** (레인 수, 수심, 샤워·주차 등)
- ⭐ 즐겨찾기 토글
- **쇼핑** (토스쇼핑 쉐어링크 수영용품, 맨 아래)

섹션 순서: 히어로 → 이름·주소 → 시간표 → **배너 광고** → 요금 → 시설 → 쇼핑

- 화면 안에 **자체 뒤로가기 버튼을 두지 않는다.** 토스 네비게이션 바 뒤로가기와
  동시에 보이면 검수 위반이다. 닫기는 `backEvent`·탭바로 처리한다.
- 상세가 열리면 홈 배너 광고를 언마운트한다 (`showAd={!selected}`).

자세한 제약은 `docs/skills/apps-in-toss-rules.md`.

---

## 4. 데이터 모델 (Neon)

> 배포 없이 데이터 수정 가능해야 하므로 관리형 Postgres(Neon)를 채택. 앱은 Neon Data API(REST)를 `fetch`로 조회한다(`src/pool.ts`).

### `pools`
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | |
| name | text | 수영장명 |
| gu | text | 자치구 (홈 검색 키) |
| address | text | |
| lat, lng | float8 | 지도·거리 계산 |
| phone | text | |
| homepage_url | text | nullable |
| price_free_swim | int | 자유수영 1회 요금(원), nullable |
| price_note | text | 요금 부가설명 nullable |
| facilities | jsonb | `{lanes, depth, shower, parking, ...}` |
| free_swim | jsonb | 요일별 시간표 (아래 구조) |
| updated_at | timestamptz | |

`free_swim` 구조 (요일 0=일 … 6=토):
```json
[
  { "day": 1, "sessions": [{ "start": "06:00", "end": "08:00" }, { "start": "12:00", "end": "13:30" }] },
  { "day": 6, "sessions": [{ "start": "09:00", "end": "18:00" }] }
]
```
> ponytail: 시간표를 별도 테이블 대신 jsonb로. "지금 열린 곳만 필터" 같은 서버쿼리가 필요해지면 그때 `pool_schedules` 테이블로 정규화.

- **RLS**: `pools`는 익명(anon) **읽기 전용** 정책만. 쓰기는 없음(운영자가 대시보드/CLI로 입력).
- 인덱스: `sido, gu`, `name`. 근처 검색은 앱에서 위·경도 기반으로 계산한다.

### `gear_items` (쇼핑)

토스쇼핑 쉐어링크. **URL만 넣고** `pnpm gear:sync`가 OG 제목·이미지를 채운다.

```sql
insert into public.gear_items (url, note, sort_order)
values ('https://toss.im/_m/새링크', '메모', 4);
```

- 정렬: `created_at desc, sort_order asc` (최신 등록순). 앱·폴백 동일.
- 앱 조회는 `src/gear.ts`, 실패 시 `src/data/gear.generated.json` 폴백.
- 스키마: `database/migrations/20260905000000_gear_items.sql`.
- 스키마를 바꾸면 Neon Data API 캐시를 갱신한다: `notify pgrst, 'reload schema';`

### 즐겨찾기 (서버 아님)
- `localStorage["fav_pool_ids"] = ["uuid", ...]`
- 즐겨찾기 탭/토글은 이 배열만 조작 → 로그인 불필요.
- ponytail: 기기 종속·초기화 가능성 있음. 기기 간 동기화가 필요해지면 그때 토스 로그인 + 서버 저장.

---

## 5. 기술 스택 / SDK

| 영역 | 선택 | 근거 |
|------|------|------|
| 프레임워크 | 앱인토스 web-framework 3.x + React 18 + Vite 6 | `package.json` 기준 |
| UI | TDS Mobile (`@toss/tds-mobile`) | 미니앱 심사 필수 |
| 위치 | `useGeolocation` 훅 + `geolocation` 권한 | 앱인토스 제공 |
| 광고 | `TossAds.attachBanner` (`variant: "card"`) | 인앱 광고(IAA) |
| 클립보드 | `Clipboard.setText` + `clipboard/write` 권한 | 상세 주소 복사 |
| 지도 | 카카오맵 JS SDK 임베드 | WebView 표준 Web API 허용 |
| 백엔드 | Neon (Postgres + Neon Data API/Auth, REST `fetch`) | 무배포 데이터 수정 |
| 라우팅 | 하단 탭 상태 (탭 3개뿐 → 라우터 대신 `useState` 탭 스위칭) | ponytail: 라우터 불필요 |

**설정 변경 필요**
- `apps-in-toss.config.ts` → `permissions`: `geolocation/access`, `clipboard/write` 반영 완료, `brand.icon` 지정
- Neon Data API/Auth URL → 환경변수(`import.meta.env.VITE_NEON_*`), 익명 토큰은 `VITE_NEON_AUTH_URL`에서 발급

---

## 6. 데이터 수집·운영

- 전국 수영장 데이터는 Neon `public.pools` 를 기준으로 관리한다. 중간 JSON 원본은 두지 않는다.
- 소스: 각 구민체육센터/수영장 홈페이지의 자유수영 시간표·요금.
- 입력: 공식 출처에서 근거를 수집(`pnpm evidence:collect`)하고 근거 대조(`pnpm evidence:coverage`)·게이트(`pnpm evidence:verify`)를 통과한 값만 `scripts/insert-new-pools.mjs`(신규) 또는 대상 행을 명시한 수정 스크립트로 Neon 에 직접 쓴다.
- 시간표는 시즌마다 바뀌므로 `updated_at`으로 갱신일 표기.

---

## 7. 구현 마일스톤

**M1 — 데이터·기반** ✅ 완료 (Neon 기준)
1. Neon 프로젝트 + `pools` 테이블 + anonymous 읽기 전용 정책
2. 전국 시설 데이터 입력 및 중복 정리
3. 앱에서 Neon Data API 조회 확인, 실패 시 번들 JSON 폴백

**M2 — 홈 + 상세**
4. 하단 탭 셸(3탭, useState)
5. 홈: 자치구 선택 → 목록
6. 수영장 상세 화면 (시간표·요금·위치·시설)
7. 즐겨찾기 토글(localStorage) + 즐겨찾기 탭

**M3 — 내 주변**
8. `geolocation` 권한 + 위치 폴백
9. 카카오맵 임베드 + 마커
10. 지도 이동 후 재검색, 거리 정렬

**M4 — 마감**
11. 전국 수영장 데이터 채우기 — 진행 중
12. 아이콘·브랜딩, 심사 점검(TDS 준수), 배포

**M5 — 수익화** (2026-09)
13. 인앱 배너 광고 2자리 연결 (홈/상세)
14. 토스쇼핑 쉐어링크 쇼핑 섹션 (Neon `gear_items` 기반 자동 최신화)

> 배포는 `pnpm build`로 `.ait`를 만든 뒤 콘솔 MCP 또는 콘솔에서 직접 업로드한다.
> `ait deploy` CLI는 저장된 API 키 권한 문제(`4031`)로 현재 쓸 수 없다.

### 자유수영 시간표 확보 현황

전국 시설 기준. 자동 수집(helloswim·오늘수영·swimmingis)과 수동 검증을 병행한다.

확보 못한 곳은 두 종류로 나눈다.
- **자유수영 미운영 확정**: 강습 전용·회원 전용·휴장·선수 전용 시설. 더 찾을 필요가 없다.
- **시간표 확보 실패**: 공식 안내가 이미지/PDF이거나 온라인 자료 자체가 없는 경우. 전화 확인이 필요하다.

앞으로 시간표를 추가할 때는 `.claude/skills/korean-pool-research/SKILL.md` 절차를 따른다. 근거를 먼저 찾고, 근거 대조와 게이트를 통과한 값만 Neon 에 직접 쓴다 (README “데이터 관리” 참고).

---

## 8. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 카카오맵 SDK가 토스 WebView/도메인에서 로드 안 됨 | 내 주변 탭 불가 | M3에서 실기기 우선 검증. 안 되면 **목록+거리표시**로 폴백(이미 데이터에 lat/lng 있음) |
| 자유수영 시간표가 자주 바뀜 | 정보 신뢰도 | `updated_at` 노출 + 상세에 "홈페이지 확인" 링크 |
| 수동 데이터 수집 공수 | 출시 지연 | MVP는 인기 구 위주 소수부터, 점진 확대 |
| localStorage 초기화 | 즐겨찾기 유실 | MVP 허용, 필요 시 로그인+서버 |

---

## 8.5 수익화 (2026-09 추가)

| 수단 | 위치 | 구현 |
|------|------|------|
| 인앱 배너 광고 (IAA) | 홈 필터 칩 아래 / 상세 시간표 아래 | `src/components/BannerAd.tsx`, 광고 그룹 ID는 자리별로 분리 |
| 토스쇼핑 쉐어링크 | 상세 맨 아래 쇼핑 섹션 | `src/components/GearSection.tsx`, Neon `public.gear_items` |

- 광고 그룹: 홈 `VITE_TOSS_AD_GROUP_ID`, 상세 `VITE_TOSS_AD_GROUP_ID_DETAIL`.
- 쇼핑 상품은 DB에 **URL만** 넣고 `pnpm gear:sync`가 OG 제목·이미지를 채운다.
  가격은 자주 바뀌므로 앱에 넣지 않는다. 최신 등록순 정렬.
- 공정위 고지 문구(`GEAR_DISCLOSURE`)를 상품 목록 바로 위에 유지한다.
- 광고 배치 금지 사항(오클릭·중복 노출·가려진 광고)은
  `docs/skills/apps-in-toss-rules.md` 2절 참고.

---

## 9. MVP 범위 확정

- ✅ 3탭 전부(홈·내주변·즐겨찾기), 각 화면은 최소 기능
- ✅ 서울 전역(데이터는 점진 확대), 로그인 없음
- ✅ 위치 기반 정렬, 로컬 즐겨찾기
- ❌ 알림(푸시), 리뷰/평점, 예약 — 차기
