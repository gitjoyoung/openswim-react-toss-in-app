import { useCallback, useMemo, useState } from "react";
import type { Suggestion } from "../components/SearchBox";
import type { Pool } from "../pool";
import {
  buildPoolSearchIndex,
  distinctRegions,
  findRegionMatches,
  findPoolSuggestions,
  inRegion,
  matchPool,
  regionLabel,
  type Region,
} from "../lib/search";

export type NearbyCamera = "default" | "fit" | "skip";

// Nearby keeps its input live for suggestions, but moves the map only after a search is committed.
export function useNearbySearch(pools: Pool[]) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<Region | null>(null);
  const [appliedText, setAppliedText] = useState("");
  const [camera, setCamera] = useState<NearbyCamera>("default");
  const regions = useMemo(() => distinctRegions(pools), [pools]);
  const poolIndex = useMemo(() => buildPoolSearchIndex(pools), [pools]);

  const submitSearch = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query) {
        setRegion(null);
        setAppliedText("");
        setQ("");
        setCamera("default");
        return;
      }
      const matchingRegions = findRegionMatches(regions, query);
      setCamera("fit");
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

  const clearForLocation = useCallback(() => {
    setRegion(null);
    setAppliedText("");
    setQ("");
    setCamera("skip");
  }, []);

  const visiblePools = useMemo(() => {
    if (region) return pools.filter((item) => inRegion(item, region));
    if (appliedText.trim()) return pools.filter((item) => matchPool(item, appliedText));
    return pools;
  }, [pools, region, appliedText]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const query = q.trim();
    if (!query) return [];
    const regionSuggestions = findRegionMatches(regions, query)
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
            setCamera("fit");
          },
        };
      });
    const namedSuggestions = findPoolSuggestions(poolIndex, query).map((item) => ({
      id: item.id,
      icon: "🏊",
      label: item.name,
      hint: item.gu,
      onPick: () => {
        setRegion(null);
        setAppliedText(item.name);
        setQ(item.name);
        setCamera("fit");
      },
    }));
    return [...regionSuggestions, ...namedSuggestions];
  }, [poolIndex, q, regions]);

  const markCameraHandled = useCallback(() => setCamera("skip"), []);

  return {
    q,
    region,
    appliedText,
    camera,
    suggestions,
    visiblePools,
    setQuery: setQ,
    submitSearch,
    clearForLocation,
    markCameraHandled,
  };
}
