import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Text } from "@toss/tds-mobile";
import homeIcon from "./assets/icons/home.webp";
import nearbyIcon from "./assets/icons/nearby.webp";
import favIcon from "./assets/icons/fav.webp";
import { loadFavs, saveFavs } from "./lib/favorites";
import { migrateFromPreviousOrigin } from "./lib/storageMigration";
import { usePools } from "./hooks/usePools";
import { useHolidays } from "./hooks/useHolidays";
import { useAppNavigation, type Tab } from "./hooks/useAppNavigation";
import { useDetailScrollLock } from "./hooks/useDetailScrollLock";
import { useHideOnScroll } from "./hooks/useHideOnScroll";
import {
  Screen,
  APP_MAX_WIDTH,
  EmptyState,
  Loading,
} from "./design/primitives";
import PoolListSkeleton from "./components/PoolListSkeleton";
import {
  brand,
  color,
  radius,
  SAFE_BOTTOM,
  TAB_BAR_HEIGHT,
  TAB_BAR_SIDE_MARGIN,
} from "./design/tokens";
import HomeScreen from "./screens/HomeScreen"; // 첫 화면이라 즉시 로드

// 나머지 화면은 코드 스플릿(초기 번들 축소). 카카오맵 쓰는 내주변이 특히 무거움.
const NearbyScreen = lazy(() => import("./screens/NearbyScreen"));
const FavoritesScreen = lazy(() => import("./screens/FavoritesScreen"));
const PoolDetail = lazy(() => import("./screens/PoolDetail"));

function App() {
  const { pools, loading, loadError, retry } = usePools();
  // 공휴일 표는 DB에서 받는다. 임시공휴일이 지정되면 배포 없이 반영돼야 한다.
  // 값 자체는 모듈 캐시에 들어가고, 이 훅은 도착 시 화면을 다시 그리는 역할만 한다.
  useHolidays();
  const { tab, selected, openPoolDetail, closeDetail, changeTab } =
    useAppNavigation();
  const [favs, setFavs] = useState<string[]>(loadFavs);
  // 검색 키보드가 열린 동안은 웹뷰가 플로팅 탭바를 함께 끌어올리므로 탭바만 숨긴다.
  const [searchFocused, setSearchFocused] = useState(false);

  useDetailScrollLock(selected !== null);

  // Origin 변경(2026-08-25) 대응: 이전 Origin의 즐겨찾기를 한 번 합친다.
  useEffect(() => {
    migrateFromPreviousOrigin().then((merged) => {
      if (merged) setFavs(merged);
    });
  }, []);

  // iOS 웹뷰는 viewport의 user-scalable=no를 무시해서 핀치 확대가 그대로 된다.
  // 토스 웹뷰에도 핀치 줌을 막는 설정이 없어(개발자센터 문서) 웹에서 직접 막는다.
  // 지도처럼 확대가 꼭 필요한 영역은 data-allow-zoom 으로 예외 처리한다.
  useEffect(() => {
    const block = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-allow-zoom]")) return;
      e.preventDefault();
    };
    const events = ["gesturestart", "gesturechange", "gestureend"];
    events.forEach((n) =>
      document.addEventListener(n, block, { passive: false }),
    );
    return () => events.forEach((n) => document.removeEventListener(n, block));
  }, []);

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      saveFavs(next);
      return next;
    });
  }

  // 상세도 탭 셸 안에서 렌더 → 하단 탭바 항상 노출. 탭을 누르면 상세를 닫고 이동.
  return (
    <>
      <Screen>
        {/* lazy 화면 로딩 중 폴백. 탭바는 밖에 둬서 항상 노출. */}
        {/* 목록 화면(즐겨찾기)은 같은 골격의 스켈레톤, 지도(내 주변)는 로더를 보인다.
          홈은 lazy 가 아니라 여기 안 걸리고 HomeScreen 안에서 직접 스켈레톤을 그린다. */}
        <Suspense fallback={tab === "fav" ? <PoolListSkeleton /> : <Loading />}>
          {loadError && !pools.length ? (
            <EmptyState
              emoji="⚠️"
              text={
                <>
                  정보를 불러오지 못했어요.
                  <br />
                  <button
                    onClick={retry}
                    style={{
                      marginTop: 14,
                      padding: "8px 18px",
                      border: "none",
                      borderRadius: 10,
                      background: brand.main,
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    다시 시도
                  </button>
                </>
              }
            />
          ) : (
            <>
              {tab === "home" && (
                <HomeScreen
                  pools={pools}
                  loading={loading}
                  favs={favs}
                  onToggleFav={toggleFav}
                  onSelect={openPoolDetail}
                  // 상세 시트가 덮고 있는 동안에는 홈 배너를 내린다.
                  // 안 내리면 (1) 가려진 광고가 계속 노출로 잡히고 (2) 상세 배너와 겹쳐
                  // '동일 화면 동일 포맷 2개' / '광고 은닉·겹침'에 걸린다.
                  showAd={!selected}
                  onSearchFocusChange={setSearchFocused}
                />
              )}
              {tab === "nearby" && (
                <NearbyScreen
                  pools={pools}
                  onSelect={openPoolDetail}
                  onSearchFocusChange={setSearchFocused}
                />
              )}
              {tab === "fav" && (
                <FavoritesScreen
                  pools={pools}
                  favs={favs}
                  onToggleFav={toggleFav}
                  onSelect={openPoolDetail}
                  loading={loading}
                />
              )}
            </>
          )}
        </Suspense>
        <TabBar
          tab={tab}
          onChange={(nextTab) => {
            setSearchFocused(false);
            changeTab(nextTab);
          }}
          searchFocused={searchFocused}
        />
      </Screen>

      {/* 상세는 페이지 교체가 아니라 위로 올라오는 모달 — 밑 화면(홈/지도)은 그대로 유지 */}
      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            display: "flex",
            justifyContent: "center",
            background: "rgba(0,0,0,0.25)",
          }}
          onClick={closeDetail} // 데스크톱 사이드 여백 클릭 시 닫기
        >
          <div
            className="detail-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: APP_MAX_WIDTH,
              height: "100%",
              overflowY: "auto",
              background: color.bg,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Suspense fallback={<Loading />}>
              <PoolDetail
                pool={selected}
                isFav={favs.includes(selected.id)}
                onToggleFav={() => toggleFav(selected.id)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}

function TabBar({
  tab,
  onChange,
  searchFocused,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  searchFocused: boolean;
}) {
  // 아래로 드래그했을 때 또는 검색 키보드가 열린 동안 숨긴다.
  const hidden = useHideOnScroll() || searchFocused;
  const tabImg = (src: string) => (
    <img
      src={src}
      alt=""
      style={{ width: 26, height: 26, objectFit: "contain", display: "block" }}
    />
  );
  const items: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "home", label: "홈", icon: tabImg(homeIcon) },
    { key: "nearby", label: "내 주변", icon: tabImg(nearbyIcon) },
    { key: "fav", label: "즐겨찾기", icon: tabImg(favIcon) },
  ];
  // 앱인토스 브랜딩 가이드: 탭바는 토스 앱 하단 탭과 형태가 겹치지 않도록 플로팅으로 둔다.
  // 폭은 넓게 쓰되 좌우 여백(TAB_BAR_SIDE_MARGIN)과 완전 라운드를 유지해
  // '화면에 붙은 바'가 아니라 '떠 있는 알약'으로 읽히게 한다. (겹치면 현재 위치를 헷갈린다는 게 가이드 취지)
  return (
    <nav
      style={{
        position: "fixed",
        bottom: SAFE_BOTTOM, // TDS BottomCTA와 동일한 세이프에어리어 공식 (토스 웹뷰 UA 값 우선)
        left: "50%",
        // 숨길 땐 아래로 밀어낸다. 세이프에어리어까지 포함해 완전히 화면 밖으로.
        transform: `translateX(-50%) translateY(${hidden ? `calc(${TAB_BAR_HEIGHT}px + ${SAFE_BOTTOM})` : "0px"})`,
        opacity: hidden ? 0 : 1,
        transition:
          "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease",
        pointerEvents: hidden ? "none" : "auto",
        display: "flex",
        width: `calc(100% - ${TAB_BAR_SIDE_MARGIN * 2}px)`, // 좌우 여백은 남긴다 (꽉 채우면 토스 기본 탭과 형태가 겹침)
        maxWidth: APP_MAX_WIDTH - TAB_BAR_SIDE_MARGIN * 2,
        height: TAB_BAR_HEIGHT,
        boxSizing: "border-box",
        borderRadius: radius.pill,
        background: color.bg,
        // 떠 있는 느낌은 그림자로만. 배경 위에서 경계가 흐려지지 않게 얇은 테두리를 함께 둔다.
        boxShadow: "0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)",
        border: `1px solid ${color.divider}`,
        padding: "0 10px",
        zIndex: 900,
      }}
    >
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            style={{
              flex: "1 1 0", // 넓어진 폭을 탭들이 고르게 나눠 갖는다
              minWidth: 0, // 라벨이 길어져도 줄어들 수 있게
              border: "none",
              outline: "none", // 포커스 시 웹뷰 기본 테두리 방지 (전역 CSS + 인라인 이중 보장)
              background: "none",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "0 2px",
            }}
          >
            <span
              style={{
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                lineHeight: 1,
                filter: active ? "none" : "grayscale(1) opacity(0.7)",
              }}
            >
              {it.icon}
            </span>
            <Text
              typography="t7"
              fontWeight={active ? "bold" : "medium"}
              color={active ? brand.main : color.textMuted}
              ellipsisAfterLines={1}
              style={{ maxWidth: "100%" }}
            >
              {it.label}
            </Text>
          </button>
        );
      })}
    </nav>
  );
}

export default App;
