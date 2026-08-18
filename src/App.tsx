import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Text } from "@toss/tds-mobile";
import { fetchPools, type Pool } from "./pool";
import homeIcon from "./assets/icons/home.webp";
import nearbyIcon from "./assets/icons/nearby.webp";
import favIcon from "./assets/icons/fav.webp";
import { loadFavs, saveFavs } from "./lib/favorites";
import { Screen, APP_MAX_WIDTH, EmptyState, Loading } from "./design/primitives";
import { brand, color, radius, SAFE_BOTTOM, TAB_BAR_HEIGHT } from "./design/tokens";
import HomeScreen from "./screens/HomeScreen"; // 첫 화면이라 즉시 로드
import SplashVideo from "./components/SplashVideo";

// 나머지 화면은 코드 스플릿(초기 번들 축소). 카카오맵 쓰는 내주변이 특히 무거움.
const NearbyScreen = lazy(() => import("./screens/NearbyScreen"));
const FavoritesScreen = lazy(() => import("./screens/FavoritesScreen"));
const PoolDetail = lazy(() => import("./screens/PoolDetail"));

type Tab = "home" | "nearby" | "fav";

// 앱 로드 시 보여줄 인트로 영상 (public/intro.mp4). 끄려면 "" 로.
const INTRO_SRC = `${import.meta.env.BASE_URL}intro.mp4`;

function App() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [selected, setSelected] = useState<Pool | null>(null);
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const detailOpenLockedRef = useRef(false);
  // 인트로 영상은 최초 1회만 (매번 6초 대기 방지). localStorage 지우면 다시 재생.
  // WebView 스토리지 차단 시 localStorage 접근이 throw할 수 있어 try/catch (미보호면 흰 화면).
  const [showSplash, setShowSplash] = useState(() => {
    if (!INTRO_SRC) return false;
    try {
      return !localStorage.getItem("introSeen");
    } catch {
      return true;
    }
  });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchPools()
      .then(setPools)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    events.forEach((n) => document.addEventListener(n, block, { passive: false }));
    return () => events.forEach((n) => document.removeEventListener(n, block));
  }, []);

  // 탭 이동 시 항상 상단부터. (상세는 모달이라 밑 화면 스크롤은 그대로 유지)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  // 상세 모달 열린 동안 배경(탭 화면) 스크롤 잠금 + 위치 정확히 보존.
  // position:fixed + top:-y 로 현재 스크롤을 고정하고, 닫을 때 그 위치로 복원.
  useEffect(() => {
    if (!selected) return;
    const y = window.scrollY;
    const b = document.body.style;
    b.position = "fixed";
    b.top = `-${y}px`;
    b.left = "0";
    b.right = "0";
    return () => {
      b.position = "";
      b.top = "";
      b.left = "";
      b.right = "";
      window.scrollTo(0, y);
    };
  }, [selected]);

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveFavs(next);
      return next;
    });
  }

  // 첫 탭은 즉시 열고, 더블클릭·연속 탭으로 들어오는 후속 이벤트만 잠시 무시한다.
  const openPoolDetail = useCallback((pool: Pool) => {
    if (detailOpenLockedRef.current) return;
    detailOpenLockedRef.current = true;
    setSelected(pool);
    window.setTimeout(() => {
      detailOpenLockedRef.current = false;
    }, 400);
  }, []);

  // 상세도 탭 셸 안에서 렌더 → 하단 탭바 항상 노출. 탭을 누르면 상세를 닫고 이동.
  return (
    <>
      {showSplash && (
        <SplashVideo
          src={INTRO_SRC}
          onDone={() => {
            setShowSplash(false);
            try {
              localStorage.setItem("introSeen", "1");
            } catch {
              /* 스토리지 차단 시 무시 (다음에 또 재생될 뿐) */
            }
          }}
        />
      )}
      <Screen>
      {/* lazy 화면 로딩 중 폴백. 탭바는 밖에 둬서 항상 노출. */}
      <Suspense fallback={<Loading />}>
      {loadError && !pools.length ? (
        <EmptyState
          emoji="⚠️"
          text={
            <>
              정보를 불러오지 못했어요.
              <br />
              <button
                onClick={load}
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
            />
          )}
          {tab === "nearby" && <NearbyScreen pools={pools} onSelect={openPoolDetail} />}
          {tab === "fav" && (
            <FavoritesScreen pools={pools} favs={favs} onToggleFav={toggleFav} onSelect={openPoolDetail} />
          )}
        </>
      )}
      </Suspense>
      <TabBar
        tab={tab}
        onChange={(t) => {
          setSelected(null);
          setTab(t);
        }}
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
          onClick={() => setSelected(null)} // 데스크톱 사이드 여백 클릭 시 닫기
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
                onBack={() => setSelected(null)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabImg = (src: string) => (
    <img src={src} alt="" style={{ width: 26, height: 26, objectFit: "contain", display: "block" }} />
  );
  const items: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "home", label: "홈", icon: tabImg(homeIcon) },
    { key: "nearby", label: "내 주변", icon: tabImg(nearbyIcon) },
    { key: "fav", label: "즐겨찾기", icon: tabImg(favIcon) },
  ];
  // 앱인토스 브랜딩 가이드: 탭바는 토스 앱 하단 탭과 형태가 겹치지 않도록 플로팅(캡슐)로 둔다.
  // 그래서 화면 폭을 채우는 바가 아니라, 탭 개수만큼만 폭을 차지하는 알약 모양으로 띄운다.
  return (
    <nav
      style={{
        position: "fixed",
        bottom: SAFE_BOTTOM, // TDS BottomCTA와 동일한 세이프에어리어 공식 (토스 웹뷰 UA 값 우선)
        left: "50%",
        transform: "translateX(-50%)",
        display: "inline-flex", // 폭은 내용만큼만 — 꽉 찬 바로 보이면 토스 기본 탭과 겹친다
        maxWidth: "calc(100% - 40px)",
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
              flex: "0 0 auto", // 폭을 나눠 갖지 않고 각자 고정 — 캡슐이 내용만큼만 넓어진다
              width: 72, // 탭 3개 기준 약 236px. 탭 타겟(44) 여유 있게 확보
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
