import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeLocation } from "./useHomeLocation";

const geo = {
  getMyLocation: vi.fn(),
  getMyLocationSilent: vi.fn(),
};

describe("useHomeLocation", () => {
  beforeEach(() => {
    geo.getMyLocation.mockReset();
    geo.getMyLocationSilent.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays its loader, applies an explicit location, and toggles it off", async () => {
    vi.useFakeTimers();
    geo.getMyLocationSilent.mockResolvedValue(null);
    let resolveLocation: (location: { lat: number; lng: number }) => void;
    geo.getMyLocation.mockReturnValue(new Promise((resolve) => { resolveLocation = resolve; }));
    const { result } = renderHook(() => useHomeLocation(geo));

    await act(async () => {});
    act(() => { void result.current.toggleLocation(); });
    expect(result.current.locating).toBe(true);
    expect(result.current.showLocLoader).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(result.current.showLocLoader).toBe(true);

    await act(async () => { resolveLocation!({ lat: 37.5, lng: 127 }); });
    expect(result.current.location).toEqual({ lat: 37.5, lng: 127 });
    expect(result.current.locating).toBe(false);
    expect(result.current.showLocLoader).toBe(false);

    act(() => { void result.current.toggleLocation(); });
    expect(result.current.location).toBeNull();
  });

  it("ignores a superseded silent lookup while the hook remains mounted", async () => {
    let resolveStale: (location: { lat: number; lng: number } | null) => void;
    const staleGeo = {
      getMyLocation: vi.fn(),
      getMyLocationSilent: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      ),
    };
    const currentGeo = {
      getMyLocation: vi.fn(),
      getMyLocationSilent: vi.fn().mockResolvedValue(null),
    };
    const { result, rerender } = renderHook(
      ({ dependencies }) => useHomeLocation(dependencies),
      { initialProps: { dependencies: staleGeo } },
    );

    expect(staleGeo.getMyLocationSilent).toHaveBeenCalledTimes(1);
    rerender({ dependencies: currentGeo });

    await act(async () => {
      resolveStale!({ lat: 37.5, lng: 127 });
    });

    expect(result.current.location).toBeNull();
    expect(currentGeo.getMyLocationSilent).toHaveBeenCalledTimes(1);
  });
});
