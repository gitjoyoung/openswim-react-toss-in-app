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

  it("includes verified facility usage notes in the facility pills", () => {
    const model = buildPool({ facilities: { notes: ["청소년 전용 수영장"] } });

    expect(model.facilityPills).toContain("청소년 전용 수영장");
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

describe("buildPoolDetailModel source notice", () => {
  it("states only when we checked, in the app's own voice", () => {
    const model = buildPoolDetailModel(
      pool({
        free_swim_source: "https://example.go.kr/pool",
        free_swim_source_type: "official_gov",
        free_swim_verified_at: "2026-09-02",
        free_swim_confidence: "medium",
      }),
    );

    expect(model.sourceNotice).toEqual({
      lead: "",
      linkLabel: "해당 수영장 정보",
      trailing: "를 2026-09-02 확인하였습니다.",
      caution: null,
      sourceUrl: "https://example.go.kr/pool",
    });
  });

  it("adds one visit-check sentence when the source is not an official page", () => {
    const model = buildPoolDetailModel(
      pool({
        free_swim_source: "https://blog.naver.com/example/1",
        free_swim_source_type: "blog",
        free_swim_verified_at: "2026-08-21",
        free_swim_confidence: "low",
      }),
    );

    // 확인 사실과 주의 안내는 별도 줄로 나가야 한다.
    expect(model.sourceNotice?.trailing).toBe("를 2026-08-21 확인하였습니다.");
    expect(model.sourceNotice?.caution).toBe("방문 전 확인이 필요합니다.");
  });

  it("uses the same sentence for an official page we could not fully trust", () => {
    const notChecked = buildPoolDetailModel(
      pool({
        free_swim_source: "https://example.or.kr/pool",
        free_swim_source_type: "official_pub",
        free_swim_verified_at: "2026-08-21",
        free_swim_confidence: "needs_check",
      }),
    );
    const lowConfidence = buildPoolDetailModel(
      pool({
        free_swim_source: "https://example.or.kr/pool",
        free_swim_source_type: "operator_site",
        free_swim_verified_at: "2026-08-21",
        free_swim_confidence: "low",
      }),
    );

    for (const model of [notChecked, lowConfidence]) {
      expect(model.sourceNotice?.trailing).toBe("를 2026-08-21 확인하였습니다.");
      expect(model.sourceNotice?.caution).toBe("방문 전 확인이 필요합니다.");
    }
  });

  it("drops the link when there is no verified date to show", () => {
    const model = buildPoolDetailModel(
      pool({ free_swim_source_type: "unknown", free_swim_confidence: "needs_check" }),
    );

    expect(model.sourceNotice).toEqual({
      lead: "시간표 정보를 확인하지 못했습니다.",
      linkLabel: "",
      trailing: "",
      caution: "방문 전 확인이 필요합니다.",
      sourceUrl: null,
    });
  });

  it("returns null when the pool has no provenance at all", () => {
    expect(buildPoolDetailModel(pool()).sourceNotice).toBeNull();
  });
});
describe("buildPoolDetailModel notice texts from the database", () => {
  const dbTexts = {
    verified: "우리가 {date}에 직접 확인한 시간표입니다.",
    linkLabel: "우리가",
    unverified: "아직 확인하지 못한 시간표입니다.",
    caution: "가기 전에 전화로 확인해 주세요.",
  };

  it("renders the sentence stored in the database instead of the bundled default", () => {
    const model = buildPoolDetailModel(
      pool({
        free_swim_source: "https://example.go.kr/pool",
        free_swim_source_type: "official_gov",
        free_swim_verified_at: "2026-09-02",
        free_swim_confidence: "high",
      }),
      dbTexts,
    );

    expect(model.sourceNotice).toEqual({
      lead: "",
      linkLabel: "우리가",
      trailing: " 2026-09-02에 직접 확인한 시간표입니다.",
      caution: null,
      sourceUrl: "https://example.go.kr/pool",
    });
  });

  it("uses the database caution and unverified sentences too", () => {
    const model = buildPoolDetailModel(
      pool({ free_swim_source_type: "unknown", free_swim_confidence: "needs_check" }),
      dbTexts,
    );

    expect(model.sourceNotice).toEqual({
      lead: "아직 확인하지 못한 시간표입니다.",
      linkLabel: "",
      trailing: "",
      caution: "가기 전에 전화로 확인해 주세요.",
      sourceUrl: null,
    });
  });

  it("falls back to a plain sentence when the edited text lost the link phrase", () => {
    const model = buildPoolDetailModel(
      pool({
        free_swim_source: "https://example.go.kr/pool",
        free_swim_source_type: "official_gov",
        free_swim_verified_at: "2026-09-02",
        free_swim_confidence: "high",
      }),
      { ...dbTexts, verified: "{date} 확인 완료." },
    );

    expect(model.sourceNotice).toEqual({
      lead: "2026-09-02 확인 완료.",
      linkLabel: "",
      trailing: "",
      caution: null,
      sourceUrl: null,
    });
  });
});
