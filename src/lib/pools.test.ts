import { describe, expect, it } from "vitest";
import type { Pool } from "../pool";
import { filterAndSortPools } from "./pools";

function pool(overrides: Partial<Pool>): Pool {
  return {
    id: "pool-1",
    name: "테스트 수영장",
    sido: "서울특별시",
    gu: "강남구",
    address: "서울 강남구 테스트로 1",
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
  };
}

const weekdayAndWeekend = [
  { day: 1, sessions: [{ start: "09:00", end: "10:00" }] },
  { day: 6, sessions: [{ start: "09:00", end: "10:00" }] },
];

describe("filterAndSortPools", () => {
  it("filters a selected district by both province and district", () => {
    const result = filterAndSortPools({
      pools: [
        pool({ id: "busan", sido: "부산광역시", gu: "서구" }),
        pool({ id: "incheon", sido: "인천광역시", gu: "서구" }),
      ],
      region: { sido: "부산광역시", gu: "서구" },
      appliedText: "",
      filter: "all",
      day: 1,
      now: new Date("2026-08-31T08:00:00"),
    });

    expect(result.map((item) => item.id)).toEqual(["busan"]);
  });

  it("filters committed text across the address", () => {
    const result = filterAndSortPools({
      pools: [
        pool({ id: "address", address: "서울 강남구 역삼동 1" }),
        pool({ id: "other", address: "서울 강남구 삼성동 1" }),
      ],
      region: null,
      appliedText: "역삼동",
      filter: "all",
      day: 1,
      now: new Date("2026-08-31T08:00:00"),
    });

    expect(result.map((item) => item.id)).toEqual(["address"]);
  });

  it("prioritizes Geumcheon pools before schedule coverage without a location or region", () => {
    const result = filterAndSortPools({
      pools: [
        pool({ id: "complete", gu: "강남구", free_swim: weekdayAndWeekend }),
        pool({ id: "geumcheon", gu: "금천구", free_swim: [] }),
      ],
      region: null,
      appliedText: "",
      filter: "all",
      day: 1,
      now: new Date("2026-08-31T08:00:00"),
    });

    expect(result.map((item) => item.id)).toEqual(["geumcheon", "complete"]);
  });

  it("prioritizes the nearest location before the default district and schedule coverage", () => {
    const result = filterAndSortPools({
      pools: [
        pool({ id: "geumcheon", gu: "금천구", lat: 37.8, lng: 127.4, free_swim: weekdayAndWeekend }),
        pool({ id: "nearest", gu: "강남구", lat: 37.501, lng: 127.001, free_swim: [] }),
      ],
      region: null,
      appliedText: "",
      filter: "all",
      location: { lat: 37.5, lng: 127 },
      day: 1,
      now: new Date("2026-08-31T08:00:00"),
    });

    expect(result.map((item) => item.id)).toEqual(["nearest", "geumcheon"]);
  });

  it("orders all-pools results by full weekly coverage, partial coverage, then missing schedules", () => {
    const result = filterAndSortPools({
      pools: [
        pool({ id: "unknown", free_swim: [] }),
        pool({ id: "partial", free_swim: [{ day: 1, sessions: [{ start: "09:00", end: "10:00" }] }] }),
        pool({ id: "complete", free_swim: weekdayAndWeekend }),
      ],
      region: { sido: "서울특별시", gu: "강남구" },
      appliedText: "",
      filter: "all",
      day: 1,
      now: new Date("2026-08-31T08:00:00"),
    });

    expect(result.map((item) => item.id)).toEqual(["complete", "partial", "unknown"]);
  });

  it("keeps source order for empty-query pools with equal rank", () => {
    const result = filterAndSortPools({
      pools: [
        pool({ id: "first", free_swim: weekdayAndWeekend }),
        pool({ id: "second", free_swim: weekdayAndWeekend }),
      ],
      region: { sido: "서울특별시", gu: "강남구" },
      appliedText: "",
      filter: "all",
      day: 1,
      now: new Date("2026-08-31T08:00:00"),
    });

    expect(result.map((item) => item.id)).toEqual(["first", "second"]);
  });
});
