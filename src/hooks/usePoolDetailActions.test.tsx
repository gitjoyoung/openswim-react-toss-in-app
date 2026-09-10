import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import { usePoolDetailActions } from "./usePoolDetailActions";

const maps = vi.hoisted(() => ({
  kakao: vi.fn(),
  naver: vi.fn(),
  external: vi.fn(),
}));
const geo = vi.hoisted(() => ({ silent: vi.fn() }));

vi.mock("../lib/mapLinks", () => ({
  openKakaoMap: maps.kakao,
  openNaverMap: maps.naver,
  openExternal: maps.external,
}));
vi.mock("../lib/geo", () => ({ getMyLocationSilent: geo.silent }));

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: "pool-1",
    name: "테스트 수영장",
    sido: "서울특별시",
    gu: "금천구",
    address: "서울 금천구 테스트로 1",
    lat: 37.5,
    lng: 127,
    phone: null,
    homepage_url: "https://pool.example.com",
    subway: null,
    price_free_swim: null,
    price_note: null,
    prices: [],
    facilities: {},
    free_swim: [],
    images: [],
    ...overrides,
  };
}

describe("usePoolDetailActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geo.silent.mockResolvedValue({ lat: 37.45, lng: 126.9 });
  });

  it("opens both walking routes with an already-authorized current location", async () => {
    const { result } = renderHook(() => usePoolDetailActions(pool()));

    await result.current.openKakaoRoute();
    await result.current.openNaverRoute();

    expect(maps.kakao).toHaveBeenCalledWith("테스트 수영장", 37.5, 127, {
      lat: 37.45,
      lng: 126.9,
    });
    expect(maps.naver).toHaveBeenCalledWith("테스트 수영장", 37.5, 127, {
      lat: 37.45,
      lng: 126.9,
    });
  });

  it("prevents browser navigation and opens the homepage through the external bridge", () => {
    const { result } = renderHook(() => usePoolDetailActions(pool()));
    const event = {
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLAnchorElement>;

    result.current.openHomepage(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(maps.external).toHaveBeenCalledWith("https://pool.example.com");
  });

  it("does not invoke route or homepage bridges when their source data is absent", () => {
    const { result } = renderHook(() =>
      usePoolDetailActions(pool({ lat: null, lng: null, homepage_url: null })),
    );
    const event = {
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLAnchorElement>;

    result.current.openKakaoRoute();
    result.current.openNaverRoute();
    result.current.openHomepage(event);

    expect(maps.kakao).not.toHaveBeenCalled();
    expect(maps.naver).not.toHaveBeenCalled();
    expect(maps.external).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});
