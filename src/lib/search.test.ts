import { describe, expect, it } from "vitest";
import type { Pool } from "../pool";
import { distinctRegions, inRegion, matchPool, matchRegion, regionLabel, shortSido } from "./search";

function pool(overrides: Partial<Pool>): Pool {
  return {
    id: "pool-1",
    name: "역삼청소년수련관 수영장",
    sido: "서울특별시",
    gu: "강남구",
    address: "서울 강남구 논현로64길 7 역삼동",
    lat: 37.4,
    lng: 127.0,
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

describe("pool search", () => {
  it.each(["역삼", "강남구", "서울", "역삼동", "청소년 수영장"])(
    "matches every token across name and address for %s",
    (query) => {
      expect(matchPool(pool({}), query)).toBe(true);
    },
  );

  it("does not mix identically named districts from different cities", () => {
    const pools = [
      pool({ id: "busan", sido: "부산광역시", gu: "서구" }),
      pool({ id: "incheon", sido: "인천광역시", gu: "서구" }),
    ];

    const regions = distinctRegions(pools);
    const busan = regions.find((region) => regionLabel(region) === "부산 서구");

    expect(regions).toHaveLength(2);
    expect(busan).toBeDefined();
    expect(pools.filter((item) => inRegion(item, busan!)).map((item) => item.id)).toEqual(["busan"]);
    expect(matchRegion(busan!, "부산 서구")).toBe(true);
  });

  it.each([
    ["서울특별시", "서울"],
    ["부산광역시", "부산"],
    ["강원특별자치도", "강원"],
    ["경기도", "경기"],
  ])("shortens %s to %s", (input, expected) => {
    expect(shortSido(input)).toBe(expected);
  });
});
