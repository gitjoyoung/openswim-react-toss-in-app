<div align="center">

# 🏊 오늘 자유수영 (Openswim)

**공공 수영장 자유수영 시간을 한눈에** — 오늘 어디서 수영할지 지역·내 위치 기반으로 찾는 [AppsInToss](https://apps-in-toss.toss.im/) 미니앱

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
- 💬 **제보·후기** — 빠진 시간표·요금 정보나 방문 후기를 로그인 없이 익명 등록
- ⭐ **즐겨찾기**, 상세 요금 참고표(접이식) 등

## 기술 스택

| 구분 | 사용 |
|------|------|
| 프론트 | React 18 · TypeScript · Vite |
| 플랫폼 | AppsInToss `@apps-in-toss/web-framework` (Granite/AIT) · TDS `@toss/tds-mobile` |
| 데이터 | Supabase (PostgREST) — `pools` / `pool_reviews` |
| 지도 | Kakao Maps JS SDK |

## 시작하기

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 — .env 생성 (.env.example 참고)
#    VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_KAKAO_JS_KEY

# 3) 개발 서버
npm run dev

# 4) 빌드 (AIT 아티팩트 openswim.ait 생성)
npm run build
```

> 카카오맵은 사용 도메인을 카카오 콘솔 `[플랫폼 > Web]` 에 등록해야 표시됩니다. (`localhost:5173`, 배포 도메인 등)

## 프로젝트 구조

```
src/
  screens/     홈 · 내 주변(지도) · 즐겨찾기 · 상세
  components/  SearchBox · PoolList · PoolMap · PoolReviews · FavStar …
  lib/         pools(운영·공휴일 상태) · search(지역 검색) · geo · holidays · reviews …
  design/      tokens · primitives (토스풍 디자인 시스템)
supabase/      마이그레이션 · 시드
docs/          앱인토스·TDS 참고 문서, preview 이미지
```

## 링크

- [앱인토스 콘솔](https://apps-in-toss.toss.im/) · [개발자센터](https://developers-apps-in-toss.toss.im/) · [개발자 커뮤니티](https://techchat-apps-in-toss.toss.im/)
