import { useEffect, useMemo, useState } from "react";
import { Top, Loader } from "@toss/tds-mobile";
import type { Pool } from "../pool";
import PoolList from "../components/PoolList";
import SearchBox, { type Suggestion } from "../components/SearchBox";
import CrosshairIcon from "../components/CrosshairIcon";
import { Chip, EmptyState, Loading } from "../design/primitives";
import { space, color, radius, brand } from "../design/tokens";
import { matchPool, distinctRegions, matchRegion, regionLabel, inRegion, DEFAULT_GU, type Region } from "../lib/search";
import {
  isOpenToday,
  openOnDay,
  openWeekday,
  openWeekend,
  operatingDaysLabel,
  hasSchedule,
  markerState,
  todayRowStatus,
} from "../lib/pools";
import { getMyLocation, getMyLocationSilent, haversineKm, formatKm, type LatLng } from "../lib/geo";
import logo from "../assets/logo.webp"; // 우리가 누끼 뜬 투명 로고 (번들). 매니페스트 앱 아이콘과는 별개.

type Props = {
  pools: Pool[];
  loading: boolean;
  favs: string[];
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
};

// 가용성 필터 — 앱이 '오늘 자유수영'이라 기본은 '오늘'. 토/일은 주말 미리 계획, 전체는 브라우징.
type FilterKey = "today" | "sat" | "sun" | "all";
const DAY_FILTERS: { key: FilterKey; label: string; accent?: string }[] = [
  { key: "all", label: "전체" },
  { key: "sat", label: "토요일", accent: "#3182f6" },
  { key: "sun", label: "일요일", accent: "#f04452" },
  { key: "today", label: "오늘", accent: brand.main },
];

// 요일 탭은 '해당일 운영 + 정보없음(혹시 몰라 포함)'만 노출. 정보 있으나 그날 안 여는 곳은 제외.
function passFilter(p: Pool, key: FilterKey): boolean {
  switch (key) {
    case "today":
      // 공휴일이면 공휴일 스케줄 기준. 휴무만 빼고 운영·정보없음은 노출.
      return markerState(p) !== "closed";
    case "sat":
      return openOnDay(p, 6) || !hasSchedule(p);
    case "sun":
      return openOnDay(p, 0) || !hasSchedule(p);
    default:
      return true;
  }
}

// 상세로 갔다 돌아와도(HomeScreen 언마운트) 검색·필터·위치가 초기화되지 않게 세션 동안 보존.
// ponytail: 모듈 스코프 캐시 — 앱 새로고침이면 어차피 리셋되니 이 정도면 충분.
const homeCache: {
  q: string;
  region: Region | null;
  appliedText: string;
  filter: FilterKey;
  myLoc: LatLng | null;
} = { q: "", region: null, appliedText: "", filter: "all", myLoc: null };

export default function HomeScreen({ pools, loading, favs, onToggleFav, onSelect }: Props) {
  const [q, setQ] = useState(homeCache.q); // 입력창 표시 + 추천용 (라이브)
  const [region, setRegion] = useState<Region | null>(homeCache.region); // 확정된 지역 필터
  const [appliedText, setAppliedText] = useState(homeCache.appliedText); // 확정된 텍스트 검색
  const [filter, setFilter] = useState<FilterKey>(homeCache.filter); // 기본 = 전체
  const [myLoc, setMyLoc] = useState<LatLng | null>(homeCache.myLoc);
  const [locating, setLocating] = useState(false);
  const [showLocLoader, setShowLocLoader] = useState(false); // 오버레이는 지연 표시 (빠르면 안 띄움)

  // 상태 바뀔 때마다 캐시에 저장 → 다음 마운트 때 복원. (locating은 일시적이라 제외)
  useEffect(() => {
    homeCache.q = q;
    homeCache.region = region;
    homeCache.appliedText = appliedText;
    homeCache.filter = filter;
    homeCache.myLoc = myLoc;
  }, [q, region, appliedText, filter, myLoc]);

  // 최초 진입: 위치 권한이 이미 있으면 조용히 내 위치 기준(거리순)으로. 없으면 금천구 우선(폴백).
  // 권한창은 절대 안 띄움 — 사용자가 표적 버튼을 눌러야 물어봄.
  useEffect(() => {
    if (homeCache.myLoc || homeCache.region || homeCache.appliedText) return; // 이미 뭔가 있으면 스킵
    let live = true;
    getMyLocationSilent().then((loc) => {
      if (live && loc) setMyLoc(loc);
    });
    return () => {
      live = false;
    };
  }, []);

  // 타이핑 중엔 추천만 갱신 (목록은 그대로). 실제 필터는 커밋(엔터/추천/지우기) 때만.
  const onQueryChange = (v: string) => setQ(v);

  // 확정: 지역 우선 → 없으면 체육관(텍스트) 검색. 내 위치(거리순)와는 배타.
  const onSearchSubmit = (text: string) => {
    const s = text.trim();
    setMyLoc(null);
    if (!s) {
      setRegion(null);
      setAppliedText("");
      setQ("");
      return;
    }
    const r = distinctRegions(pools).find((rg) => matchRegion(rg, s)); // 지역 먼저
    if (r) {
      setRegion(r);
      setAppliedText("");
      setQ(regionLabel(r));
    } else {
      setRegion(null);
      setAppliedText(s); // 지역 없으면 체육관 이름 등 텍스트 검색
      setQ(s);
    }
  };

  // 전국 800여 곳이라 매 렌더마다 거르고 정렬하면 타이핑 한 글자에도 목록 전체를 다시 계산한다.
  // 결과가 달라지는 입력(목록·지역·검색어·필터·내 위치)이 바뀔 때만 계산한다.
  const filtered = useMemo(() => {
  const distKm = (p: Pool) =>
    myLoc && p.lat != null && p.lng != null ? haversineKm(myLoc, { lat: p.lat, lng: p.lng }) : Infinity;

  // 지역을 골랐으면 (시도·구) 완전일치, 아니면 자유 텍스트 검색.
  const base = pools
    .filter((p) => (region ? inRegion(p, region) : matchPool(p, appliedText)))
    .filter((p) => passFilter(p, filter));
  // 정렬: 위치 있으면 거리순, 없으면 '금천구 우선' → 그다음 커버리지/요일.
  return [...base].sort((a, b) => {
    // 위치·검색 없을 땐 기본 지역(금천구)을 맨 위로. (위치 있으면 거리순이 우선이라 스킵)
    if (!myLoc && !region) {
      const g = (p: Pool) => (p.gu === DEFAULT_GU ? 0 : 1);
      if (g(a) !== g(b)) return g(a) - g(b);
    }
    if (filter === "all") {
      if (myLoc) return distKm(a) - distKm(b); // 위치 있으면 거리순
      // 없으면 평일·주말 모두 → 한쪽만 → 정보없음
      const rank = (p: Pool) => (!hasSchedule(p) ? 2 : openWeekday(p) && openWeekend(p) ? 0 : 1);
      return rank(a) - rank(b);
    }
    // 토/일/오늘: 해당일 운영 우선, 정보없음은 맨 뒤 (그 안에서 위치 있으면 거리순)
    const hit = (p: Pool) =>
      filter === "today" ? isOpenToday(p) : filter === "sat" ? openOnDay(p, 6) : openOnDay(p, 0);
    const rank = (p: Pool) => (hit(p) ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (myLoc) return distKm(a) - distKm(b);
    return 0;
  });
  }, [pools, region, appliedText, filter, myLoc]);

  const distanceText = useMemo(() => {
    const loc = myLoc;
    if (!loc) return undefined;
    return (p: Pool) =>
      p.lat != null && p.lng != null ? formatKm(haversineKm(loc, { lat: p.lat, lng: p.lng })) : null;
  }, [myLoc]);

  // 추천: 지역("부산 서구"로 시도까지 표기해 중복 구 구분) → 이름 매치 수영장.
  const suggestions = useMemo<Suggestion[]>(() => {
    const s = q.trim();
    if (!s) return []; // 전국이라 지역이 너무 많음 → 입력 시에만 추천
    const regions = distinctRegions(pools)
      .filter((r) => matchRegion(r, s))
      .slice(0, 8)
      .map((r) => {
        const label = regionLabel(r);
        return {
          id: `r:${label}`,
          icon: "📍",
          label,
          hint: "지역",
          onPick: () => {
            setMyLoc(null); // 지역 선택도 검색 → 내 위치 해제
            setRegion(r); // 정확 필터
            setAppliedText(""); // 텍스트 검색 해제
            setQ(label); // 입력창엔 라벨 표시
          },
        };
      });
    const named = pools
      .filter((p) => p.name.includes(s))
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        icon: "🏊",
        label: p.name,
        hint: p.gu,
        onPick: () => {
          setMyLoc(null);
          setRegion(null);
          setAppliedText(p.name);
          setQ(p.name);
        },
      }));
    return [...regions, ...named];
  }, [pools, q]);

  async function toggleLocate() {
    if (myLoc) {
      setMyLoc(null);
      return;
    }
    setLocating(true);
    // 300ms 넘게 걸릴 때만 오버레이 (빠르면 빈 박스 번쩍임 방지).
    const t = setTimeout(() => setShowLocLoader(true), 300);
    try {
      // 구로 좁히지 않고 전국을 거리순 정렬 (경계 너머 더 가까운 곳도 보이게).
      setMyLoc(await getMyLocation());
      setRegion(null); // 내 위치로 조회하면 검색 해제 (둘 중 하나만)
      setAppliedText("");
      setQ("");
    } catch {
      // 위치 실패는 조용히 무시 (권한 거부 등)
    } finally {
      clearTimeout(t);
      setShowLocLoader(false);
      setLocating(false);
    }
  }

  return (
    <>
      {/* 위치 조회가 300ms↑ 걸릴 때만 딤 로딩 오버레이 (빠르면 안 띄워 번쩍임 없음). */}
      {showLocLoader && (
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
            <img src={logo} alt="오늘 수영" style={{ height: 34, display: "block", flexShrink: 0 }} />
            <Top.TitleParagraph size={28}>오늘 자유수영</Top.TitleParagraph>
          </div>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>자유수영 오늘은 어디서 할까?</Top.SubtitleParagraph>
        }
      />

      <div style={{ display: "flex", gap: space.sm, padding: `0 ${space.lg}px ${space.md}px` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchBox value={q} onChange={onQueryChange} onSubmit={onSearchSubmit} suggestions={suggestions} />
        </div>
        <button
          onClick={toggleLocate}
          disabled={locating}
          aria-label={myLoc ? "가까운 순 정렬 끄기" : "내 위치로 가까운 순"}
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: radius.md,
            border: "none",
            cursor: "pointer",
            background: myLoc ? brand.main : color.fill,
            color: myLoc ? "#fff" : color.textSub,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: locating ? 0.6 : 1,
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
          padding: `${space.xs}px ${space.lg}px`,
          marginBottom: space.xs,
        }}
      >
        {DAY_FILTERS.map((f) => (
          <Chip key={f.key} active={f.key === filter} onClick={() => setFilter(f.key)} accent={f.accent}>
            {f.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length ? (
        <>
          <PoolList
            pools={filtered}
            favs={favs}
            onToggleFav={onToggleFav}
            onSelect={onSelect}
            statusOf={(p) => {
              if (!hasSchedule(p)) return { text: "자유수영 정보 없음", tone: "unknown" as const };
              // '오늘' 뷰에선 오늘 운영 시간까지, 그 외엔 운영 요일 요약.
              if (filter === "today") return todayRowStatus(p);
              return { text: operatingDaysLabel(p), tone: "muted" as const };
            }}
            distanceText={distanceText}
          />
        </>
      ) : (
        <EmptyState
          emoji="🔍"
          text={q.trim() ? `'${q.trim()}' 검색 결과가 없어요.` : "조건에 맞는 수영장이 없어요."}
        />
      )}
    </>
  );
}
