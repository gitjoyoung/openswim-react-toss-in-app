import { describe, expect, it } from "vitest";
import { isPoolArray, type Pool } from "./pool";

function pool(): Pool {
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
    facilities: {},
    free_swim: [],
    images: [],
  };
}

describe("isPoolArray", () => {
  it("accepts a complete pool array", () => {
    expect(isPoolArray([pool()])).toBe(true);
  });

  it("rejects a non-array payload", () => {
    expect(isPoolArray({ id: "pool-1", name: "테스트 수영장" })).toBe(false);
  });

  it.each([
    [{ name: "이름만 있음" }],
    [{ id: "id만 있음" }],
  ])("rejects rows missing required identity fields", (payload) => {
    expect(isPoolArray(payload)).toBe(false);
  });

  it("rejects mixed valid and invalid rows", () => {
    expect(isPoolArray([pool(), { id: "broken" }])).toBe(false);
  });
});
