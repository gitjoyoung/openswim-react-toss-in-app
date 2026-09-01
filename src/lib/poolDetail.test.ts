import { describe, expect, it } from "vitest";
import type { Pool } from "../pool";
import { buildPoolDetailModel } from "./poolDetail";

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: "pool-1",
    name: "테스트 수영장",
    sido: "서울특별시",
    gu: "금천구",
    address: "서울 금천구 테스트로 1",
    lat: 37.5,
    lng: 127,
    phone: "02-1234-5678",
    homepage_url: "https://pool.example.com",
    subway: null,
    price_free_swim: 5000,
    price_note: "수건은 별도입니다.",
    prices: [
      { label: "성인", amount: 5000 },
      { label: "청소년", amount: 3500 },
    ],
    facilities: { lanes: 6, lane_length_m: 25, depth_min: 1.2, depth_max: 1.4 },
    free_swim: [
      { day: "평일", sessions: [{ start: "09:00", end: "10:00" }] },
      { day: "토요일", sessions: [{ start: "11:00", end: "12:00" }] },
    ],
    images: ["https://pool.example.com/1.jpg"],
    ...overrides,
  };
}

describe("buildPoolDetailModel", () => {
  it("derives literal detail display data from a complete pool", () => {
    const model = buildPoolDetailModel(pool());

    expect(model.schedule).toEqual([
      {
        days: [1, 2, 3, 4, 5],
        label: "평일",
        sessions: [{ start: "09:00", end: "10:00" }],
      },
      {
        days: [6],
        label: "토요일",
        sessions: [{ start: "11:00", end: "12:00" }],
      },
    ]);
    expect(model.priceRows).toEqual([
      { label: "성인", amount: 5000 },
      { label: "청소년", amount: 3500 },
    ]);
    expect(model.facilityPills).toEqual(["레인 6", "25M", "수심 1.2~1.4m"]);
    expect(model.contact).toEqual({
      phone: "02-1234-5678",
      homepageUrl: "https://pool.example.com",
    });
    expect(model.images).toEqual(["https://pool.example.com/1.jpg"]);
  });

  it("uses the established fallback labels when schedule, prices, facilities, and images are absent", () => {
    const model = buildPool({
      free_swim: [],
      prices: [],
      facilities: {},
      price_free_swim: null,
      images: [],
    });

    expect(model.schedule).toEqual([]);
    expect(model.priceRows).toEqual([{ label: "자유수영", amount: null }]);
    expect(model.facilityPills).toEqual([]);
    expect(model.images).toEqual([]);
  });

  it("ignores malformed optional JSON without exposing malformed display rows", () => {
    const model = buildPoolDetailModel(
      pool({
        free_swim: [
          null,
          { day: "평일", sessions: [null, { start: "09:00", end: "10:00" }] },
        ] as unknown as Pool["free_swim"],
        prices: [
          null,
          { label: "성인", amount: "5000" },
        ] as unknown as Pool["prices"],
        facilities: null,
      }),
    );

    expect(model.schedule).toEqual([
      {
        days: [1, 2, 3, 4, 5],
        label: "평일",
        sessions: [{ start: "09:00", end: "10:00" }],
      },
    ]);
    expect(model.priceRows).toEqual([{ label: "자유수영", amount: 5000 }]);
    expect(model.facilityPills).toEqual([]);
  });
});

function buildPool(overrides: Partial<Pool>) {
  return buildPoolDetailModel(pool(overrides));
}
