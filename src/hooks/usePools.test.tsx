import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import { usePools } from "./usePools";

const samplePool = { id: "p1", name: "수영장" } as Pool;

describe("usePools", () => {
  it("loads pools on mount and clears the loading state", async () => {
    const fetch = vi.fn().mockResolvedValue([samplePool]);
    const { result } = renderHook(() => usePools(fetch));

    expect(result.current.loading).toBe(true);
    await act(async () => {});

    expect(result.current.pools).toEqual([samplePool]);
    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBe(false);
  });

  it("marks a failed load and recovers through retry", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([samplePool]);
    const { result } = renderHook(() => usePools(fetch));

    await act(async () => {});
    expect(result.current.loadError).toBe(true);
    expect(result.current.pools).toEqual([]);

    await act(async () => {
      result.current.retry();
    });

    expect(result.current.loadError).toBe(false);
    expect(result.current.pools).toEqual([samplePool]);
  });
});
