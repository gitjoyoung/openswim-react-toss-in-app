import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import { useHomeSearch } from "./useHomeSearch";

const pool = (overrides: Partial<Pool>): Pool => ({
  id: "pool-1",
  name: "역삼청소년수련관 수영장",
  sido: "서울특별시",
  gu: "강남구",
  address: "서울 강남구 역삼동 1",
  lat: 37.5,
  lng: 127,
  phone: null,
  homepage_url: null,
  subway: null,
  price_free_swim: null,
  price_note: null,
  prices: [],
  facilities: [],
  free_swim: [],
  images: [],
  ...overrides,
});

describe("useHomeSearch", () => {
  it("debounces suggestions while keeping list search committed until submit", async () => {
    vi.useFakeTimers();
    const pools = [
      pool({}),
      pool({ id: "other", name: "다른 수영장", gu: "금천구", address: "서울 금천구 독산동 1" }),
    ];
    const { result } = renderHook(() => useHomeSearch(pools));

    act(() => result.current.setQuery("역삼동"));
    expect(result.current.filteredPools.map((item) => item.id)).toEqual(["other", "pool-1"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(result.current.suggestions.map((item) => item.id)).toContain("pool-1");

    act(() => result.current.submitSearch("역삼동"));
    expect(result.current.filteredPools.map((item) => item.id)).toEqual(["pool-1"]);
    vi.useRealTimers();
  });
});
