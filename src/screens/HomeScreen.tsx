import { Top, Loader } from "@toss/tds-mobile";
import type { Pool } from "../pool";
import PoolList from "../components/PoolList";
import PoolListSkeleton from "../components/PoolListSkeleton";
import SearchBox from "../components/SearchBox";
import CrosshairIcon from "../components/CrosshairIcon";
import BannerAd from "../components/BannerAd";
import { Chip, EmptyState } from "../design/primitives";
import { space, color, radius, brand } from "../design/tokens";
import type { PoolFilterKey } from "../lib/pools";
import { useHomeLocation } from "../hooks/useHomeLocation";
import { useHomeSearch } from "../hooks/useHomeSearch";
import logo from "../assets/swim-logo.png";

type Props = {
  pools: Pool[];
  loading: boolean;
  favs: string[];
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
  // 상세 시트가 열려 있는 동안처럼, 홈이 가려질 때는 false로 내려온다.
  showAd?: boolean;
  onSearchFocusChange?: (focused: boolean) => void;
};

// 가용성 필터 — 앱이 '오늘 자유수영'이라 기본은 '오늘'. 토/일은 주말 미리 계획, 전체는 브라우징.
const DAY_FILTERS: { key: PoolFilterKey; label: string; accent?: string }[] = [
  { key: "all", label: "전체" },
  { key: "sat", label: "토요일", accent: "#3182f6" },
  { key: "sun", label: "일요일", accent: "#f04452" },
  { key: "today", label: "오늘", accent: brand.main },
  { key: "now", label: "지금", accent: "#f5a623" },
];

export default function HomeScreen({
  pools,
  loading,
  favs,
  onToggleFav,
  onSelect,
  showAd = true,
  onSearchFocusChange,
}: Props) {
  const homeLocation = useHomeLocation();
  const homeSearch = useHomeSearch(pools, homeLocation.location);
  const suggestions = homeSearch.suggestions.map((suggestion) => ({
    ...suggestion,
    onPick: () => {
      homeLocation.clearLocation();
      suggestion.onPick();
    },
  }));

  async function toggleLocate() {
    if (await homeLocation.toggleLocation()) homeSearch.clearSearch();
  }

  return (
    <>
      {/* 위치 조회가 300ms↑ 걸릴 때만 딤 로딩 오버레이 (빠르면 안 띄워 번쩍임 없음). */}
      {homeLocation.showLocLoader && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: color.bg,
              borderRadius: radius.lg,
              padding: "28px 32px",
              boxShadow: "0 8px 30px rgba(0,0,0,.2)",
            }}
          >
            <Loader size="medium" label="내 위치 확인 중" />
          </div>
        </div>
      )}

      <Top
        title={
          <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
            <img
              src={logo}
              alt="오늘 수영"
              style={{ height: 38, display: "block", flexShrink: 0 }}
            />
            <Top.TitleParagraph size={28}>오늘 자유수영</Top.TitleParagraph>
          </div>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            오늘 자유수영이 가능한 수영장을 한눈에!
          </Top.SubtitleParagraph>
        }
      />

      <div
        style={{
          display: "flex",
          gap: space.sm,
          padding: `0 ${space.xl}px ${space.md}px`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchBox
            value={homeSearch.q}
            onChange={homeSearch.setQuery}
            onSubmit={(text) => {
              homeLocation.clearLocation();
              homeSearch.submitSearch(text);
            }}
            suggestions={suggestions}
            onFocusChange={onSearchFocusChange}
          />
        </div>
        <button
          onClick={() => void toggleLocate()}
          disabled={homeLocation.locating}
          aria-label={
            homeLocation.location
              ? "가까운 순 정렬 끄기"
              : "내 위치로 가까운 순"
          }
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: radius.md,
            border: "none",
            cursor: "pointer",
            background: homeLocation.location ? brand.main : color.fill,
            color: homeLocation.location ? "#fff" : color.textSub,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: homeLocation.locating ? 0.6 : 1,
          }}
        >
          <CrosshairIcon />
        </button>
      </div>

      {/* 필터 칩: 전체(기본) · 토 · 일 · 오늘. 좁아지면 가로 스와이프(스크롤바 숨김). */}
      <div
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: space.sm,
          overflowX: "auto",
          padding: `${space.xs}px ${space.xl}px`,
          marginBottom: space.xs,
        }}
      >
        {DAY_FILTERS.map((f) => (
          <Chip
            key={f.key}
            active={f.key === homeSearch.filter}
            onClick={() => homeSearch.setFilter(f.key)}
            accent={f.accent}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      {/* 배너는 화면 상단(필터 칩 아래, 리스트 위)에만. 로딩 중에는 띄우지 않는다 (일시 화면 노출 금지 규칙). */}
      {!loading && showAd && <BannerAd />}

      {loading ? (
        // 가운데 로더 대신 목록 골격을 깐다. 도착 시 레이아웃이 튀지 않는다.
        <PoolListSkeleton />
      ) : homeSearch.filteredPools.length ? (
        <PoolList
          pools={homeSearch.filteredPools}
          favs={favs}
          onToggleFav={onToggleFav}
          onSelect={onSelect}
          statusOf={homeSearch.statusOf}
          distanceText={homeLocation.distanceText}
        />
      ) : (
        <EmptyState
          emoji="🔍"
          text={
            homeSearch.q.trim()
              ? `'${homeSearch.q.trim()}' 검색 결과가 없어요.`
              : "조건에 맞는 수영장이 없어요."
          }
        />
      )}
    </>
  );
}
