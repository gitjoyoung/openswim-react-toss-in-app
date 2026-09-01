import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import { usePoolMap } from "./usePoolMap";

const geo = vi.hoisted(() => ({ getMyLocation: vi.fn(), getMyLocationSilent: vi.fn() }));
const mapSdk = vi.hoisted(() => ({ loadKakao: vi.fn() }));

vi.mock("../lib/geo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/geo")>()),
  getMyLocation: geo.getMyLocation,
  getMyLocationSilent: geo.getMyLocationSilent,
}));

vi.mock("../lib/kakaoMap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/kakaoMap")>()),
  loadKakao: mapSdk.loadKakao,
}));

const pool = (overrides: Partial<Pool> = {}): Pool => ({
  id: "pool-1",
  name: "테스트 수영장",
  sido: "서울특별시",
  gu: "금천구",
  address: "서울 금천구",
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

function createKakao() {
  const maps: { instances: FakeMap[]; markers: FakeMarker[] } = { instances: [], markers: [] };
  class LatLng {
    constructor(public lat: number, public lng: number) {}
  }
  class Size {
    constructor(public width: number, public height: number) {}
  }
  class Point {
    constructor(public x: number, public y: number) {}
  }
  class MarkerImage {
    constructor(public source: string, public size: Size, public options: unknown) {}
  }
  class FakeMap {
    level: number;
    listeners: Record<string, () => void> = {};
    setCenter = vi.fn();
    setLevel = vi.fn((level: number) => {
      this.level = level;
    });
    getLevel = vi.fn(() => this.level);
    setBounds = vi.fn();
    panTo = vi.fn();
    setDraggable = vi.fn();
    setZoomable = vi.fn();
    constructor(_element: HTMLElement, public options: { center: LatLng; level: number }) {
      this.level = options.level;
      maps.instances.push(this);
    }
  }
  class FakeMarker {
    listeners: Record<string, () => void> = {};
    setMap = vi.fn();
    setImage = vi.fn();
    setPosition = vi.fn();
    constructor(public options: unknown) {
      maps.markers.push(this);
    }
  }
  class CustomOverlay {
    setMap = vi.fn();
    constructor(public options: unknown) {}
  }
  class LatLngBounds {
    extend = vi.fn();
  }
  return {
    maps,
    kakao: {
      maps: {
        LatLng,
        Size,
        Point,
        MarkerImage,
        Map: FakeMap,
        Marker: FakeMarker,
        CustomOverlay,
        LatLngBounds,
        event: { addListener: (target: { listeners: Record<string, () => void> }, name: string, listener: () => void) => (target.listeners[name] = listener) },
      },
    },
  };
}

describe("usePoolMap", () => {
  it("initializes at the default center, renders selectable markers, and removes them on unmount", async () => {
    const { kakao, maps } = createKakao();
    mapSdk.loadKakao.mockResolvedValue(kakao);
    geo.getMyLocationSilent.mockResolvedValue(null);
    const ref = { current: document.createElement("div") };
    const onMarkerSelect = vi.fn(() => document.createElement("div"));
    const { unmount } = renderHook(() =>
      usePoolMap({
        containerRef: ref,
        pools: [pool()],
        visiblePools: [pool()],
        camera: "default",
        onCameraHandled: vi.fn(),
        onMarkerSelect,
        onLocation: vi.fn(),
      }),
    );

    await waitFor(() => expect(maps.instances).toHaveLength(1));
    expect(maps.instances[0].options.center).toMatchObject({ lat: 37.4569, lng: 126.8955 });
    expect(maps.instances[0].options.level).toBe(6);
    expect(maps.markers).toHaveLength(1);

    act(() => maps.markers[0].listeners.click());
    expect(onMarkerSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "pool-1" }), expect.any(Number));

    unmount();
    expect(maps.markers[0].setMap).toHaveBeenCalledWith(null);
  });

  it("moves to an explicit current location and surfaces lookup failures", async () => {
    const { kakao, maps } = createKakao();
    mapSdk.loadKakao.mockResolvedValue(kakao);
    geo.getMyLocationSilent.mockResolvedValue(null);
    geo.getMyLocation.mockResolvedValue({ lat: 37.51, lng: 127.01 });
    const ref = { current: document.createElement("div") };
    const onLocation = vi.fn();
    const { result } = renderHook(() =>
      usePoolMap({
        containerRef: ref,
        pools: [],
        visiblePools: [],
        camera: "skip",
        onCameraHandled: vi.fn(),
        onMarkerSelect: () => document.createElement("div"),
        onLocation,
      }),
    );

    await waitFor(() => expect(maps.instances).toHaveLength(1));
    await act(async () => result.current.locateMe());
    expect(onLocation).toHaveBeenCalledTimes(1);
    expect(maps.instances[0].panTo).toHaveBeenCalledWith(expect.objectContaining({ lat: 37.51, lng: 127.01 }));

    geo.getMyLocation.mockRejectedValue(new Error("denied"));
    await act(async () => result.current.locateMe());
    expect(result.current.error).toBe("위치를 가져오지 못했어요. 위치 권한을 확인해 주세요.");
  });

  it("keeps detail previews fixed without requesting the current location", async () => {
    const { kakao, maps } = createKakao();
    mapSdk.loadKakao.mockResolvedValue(kakao);
    geo.getMyLocationSilent.mockClear();
    const ref = { current: document.createElement("div") };
    renderHook(() => usePoolMap({ containerRef: ref, preview: { center: { lat: 37.51, lng: 127.01 }, level: 4 } }));

    await waitFor(() => expect(maps.instances).toHaveLength(1));
    expect(maps.instances[0].options).toMatchObject({ center: { lat: 37.51, lng: 127.01 }, level: 4 });
    expect(maps.instances[0].setDraggable).toHaveBeenCalledWith(false);
    expect(maps.instances[0].setZoomable).toHaveBeenCalledWith(false);
    expect(geo.getMyLocationSilent).not.toHaveBeenCalled();
  });

  it("moves the detail-preview marker when preview coordinates change", async () => {
    const { kakao, maps } = createKakao();
    mapSdk.loadKakao.mockResolvedValue(kakao);
    const ref = { current: document.createElement("div") };
    const { rerender } = renderHook(
      ({ lat, lng }) => usePoolMap({ containerRef: ref, preview: { center: { lat, lng }, level: 4 } }),
      { initialProps: { lat: 37.51, lng: 127.01 } },
    );

    await waitFor(() => expect(maps.markers).toHaveLength(1));
    rerender({ lat: 37.61, lng: 127.11 });

    await waitFor(() =>
      expect(maps.markers[0].setPosition).toHaveBeenCalledWith(expect.objectContaining({ lat: 37.61, lng: 127.11 })),
    );
  });
});
