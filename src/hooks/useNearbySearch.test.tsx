import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Pool } from "../pool";
import { useNearbySearch } from "./useNearbySearch";

const pool = (overrides: Partial<Pool>): Pool => ({
  id: "gangnam",
  name: "역삼 수영장",
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

describe("useNearbySearch", () => {
  it("keeps visible pools unchanged while typing and filters them after a committed search", () => {
    const pools = [pool({}), pool({ id: "geumcheon", name: "금천 수영장", gu: "금천구", address: "서울 금천구 독산동 1" })];
    const { result } = renderHook(() => useNearbySearch(pools));

    act(() => result.current.setQuery("역삼동"));
    expect(result.current.visiblePools.map((item) => item.id)).toEqual(["gangnam", "geumcheon"]);

    act(() => result.current.submitSearch("역삼동"));
    expect(result.current.visiblePools.map((item) => item.id)).toEqual(["gangnam"]);
    expect(result.current.camera).toBe("fit");
  });

  it("commits a selected region and exposes its label as the live query", () => {
    const pools = [pool({}), pool({ id: "geumcheon", name: "금천 수영장", gu: "금천구" })];
    const { result } = renderHook(() => useNearbySearch(pools));

    act(() => result.current.setQuery("강남구"));
    const region = result.current.suggestions.find((item) => item.id === "r:서울 강남구");
    expect(region).toBeDefined();

    act(() => region!.onPick());
    expect(result.current.q).toBe("서울 강남구");
    expect(result.current.visiblePools.map((item) => item.id)).toEqual(["gangnam"]);
    expect(result.current.camera).toBe("fit");
  });

  it("prefers exact district names over districts that merely contain the query", () => {
    const pools = [
      pool({ id: "ulsan-dong", sido: "울산광역시", gu: "동구", address: "울산 동구 봉수로 1" }),
      pool({ id: "busan-dong", sido: "부산광역시", gu: "동구", address: "부산 동구 구청로 1" }),
      pool({ id: "gangdong", sido: "서울특별시", gu: "강동구", address: "서울 강동구 성내로 1" }),
    ];
    const { result } = renderHook(() => useNearbySearch(pools));

    act(() => result.current.setQuery("동구"));
    expect(
      result.current.suggestions
        .filter((item) => item.id.startsWith("r:"))
        .map((item) => item.id),
    ).toEqual(["r:울산 동구", "r:부산 동구"]);

    act(() => result.current.submitSearch("동구"));
    expect(result.current.visiblePools.map((item) => item.id)).toEqual([
      "ulsan-dong",
      "busan-dong",
    ]);
  });
});
