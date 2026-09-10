import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Suggestion } from "../components/SearchBox";
import type { Pool } from "../pool";
import {
  filterAndSortPools,
  hasSchedule,
  nowRowStatus,
  operatingDaysLabel,
  todayDayIndex,
  todayRowStatus,
  type PoolFilterKey,
  type RowStatus,
} from "../lib/pools";
import {
  buildPoolSearchIndex,
  distinctRegions,
  findRegionMatches,
  findPoolSuggestions,
  regionLabel,
  type Region,
} from "../lib/search";
import type { LatLng } from "../lib/geo";

const homeSearchCache: {
  q: string;
  region: Region | null;
  appliedText: string;
  filter: PoolFilterKey;
} = { q: "", region: null, appliedText: "", filter: "all" };

// 위치 훅이 처음의 조용한 위치 조회를 생략해야 하는 기존 검색 상태인지 판별한다.
export function hasCachedHomeSearch(): boolean {
  return Boolean(homeSearchCache.region || homeSearchCache.appliedText);
}

export function useHomeSearch(pools: Pool[], location: LatLng | null = null) {
  const [q, setQ] = useState(homeSearchCache.q);
  const [region, setRegion] = useState<Region | null>(homeSearchCache.region);
  const [appliedText, setAppliedText] = useState(homeSearchCache.appliedText);
  const [filter, setFilter] = useState<PoolFilterKey>(homeSearchCache.filter);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    homeSearchCache.q = q;
    homeSearchCache.region = region;
    homeSearchCache.appliedText = appliedText;
    homeSearchCache.filter = filter;
  }, [q, region, appliedText, filter]);

  const regions = useMemo(() => distinctRegions(pools), [pools]);
  const poolIndex = useMemo(() => buildPoolSearchIndex(pools), [pools]);

  const submitSearch = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query) {
        setRegion(null);
        setAppliedText("");
        setQ("");
        return;
      }
      const matchingRegions = findRegionMatches(regions, query);
      if (matchingRegions.length === 1) {
        setRegion(matchingRegions[0]);
        setAppliedText("");
        setQ(regionLabel(matchingRegions[0]));
      } else {
        setRegion(null);
        setAppliedText(query);
        setQ(query);
      }
    },
    [regions],
  );

  const clearSearch = useCallback(() => {
    setRegion(null);
    setAppliedText("");
    setQ("");
  }, []);

  const computeSuggestions = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (!query) {
        setSuggestions([]);
        return;
      }
      const regionSuggestions: Suggestion[] = findRegionMatches(regions, query)
        .slice(0, 8)
        .map((item) => {
          const label = regionLabel(item);
          return {
            id: `r:${label}`,
            icon: "📍",
            label,
            hint: "지역",
            onPick: () => {
              setRegion(item);
              setAppliedText("");
              setQ(label);
            },
          };
        });
      const namedSuggestions: Suggestion[] = findPoolSuggestions(poolIndex, query).map((pool) => ({
        id: pool.id,
        icon: "🏊",
        label: pool.name,
        hint: pool.gu,
        onPick: () => {
          setRegion(null);
          setAppliedText(pool.name);
          setQ(pool.name);
        },
      }));
      setSuggestions([...regionSuggestions, ...namedSuggestions]);
    },
    [regions, poolIndex],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => computeSuggestions(q), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, computeSuggestions]);

  const filteredPools = useMemo(
    () =>
      filterAndSortPools({
        pools,
        region,
        appliedText,
        filter,
        location,
        day: todayDayIndex(),
        now: new Date(),
      }),
    [pools, region, appliedText, filter, location],
  );

  const statusOf = useCallback(
    (pool: Pool): RowStatus => {
      if (!hasSchedule(pool)) return { text: "", tone: "muted" };
      if (filter === "today") return todayRowStatus(pool);
      if (filter === "now") return nowRowStatus(pool);
      return { text: operatingDaysLabel(pool), tone: "muted" };
    },
    [filter],
  );

  return {
    q,
    region,
    appliedText,
    filter,
    suggestions,
    filteredPools,
    setQuery: setQ,
    setFilter,
    submitSearch,
    clearSearch,
    statusOf,
  };
}
