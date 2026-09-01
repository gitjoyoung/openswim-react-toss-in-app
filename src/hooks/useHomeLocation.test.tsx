import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHomeLocation } from "./useHomeLocation";

const geo = {
  getMyLocation: vi.fn(),
  getMyLocationSilent: vi.fn(),
};

describe("useHomeLocation", () => {
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
    vi.useRealTimers();
  });
});
