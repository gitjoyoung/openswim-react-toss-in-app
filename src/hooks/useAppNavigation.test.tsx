import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import { useAppNavigation } from "./useAppNavigation";

const poolA = { id: "a", name: "A 수영장" } as Pool;
const poolB = { id: "b", name: "B 수영장" } as Pool;

function makeDeps() {
  let backHandler: (() => void) | null = null;
  return {
    deps: {
      addBackEventListener: vi.fn((onEvent: () => void) => {
        backHandler = onEvent;
        return () => {
          backHandler = null;
        };
      }),
      closeApp: vi.fn(),
    },
    fireBack: () => act(() => backHandler?.()),
  };
}

describe("useAppNavigation", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens the first detail immediately and ignores rapid follow-up opens", () => {
    vi.useFakeTimers();
    const { deps } = makeDeps();
    const { result } = renderHook(() => useAppNavigation(deps));

    act(() => result.current.openPoolDetail(poolA));
    expect(result.current.selected).toBe(poolA);

    act(() => result.current.openPoolDetail(poolB));
    expect(result.current.selected).toBe(poolA);

    act(() => result.current.closeDetail());
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => result.current.openPoolDetail(poolB));
    expect(result.current.selected).toBe(poolB);
  });

  it("closes only the detail on system back, then closes the app from the root", () => {
    const { deps, fireBack } = makeDeps();
    const { result } = renderHook(() => useAppNavigation(deps));

    act(() => result.current.openPoolDetail(poolA));
    fireBack();
    expect(result.current.selected).toBeNull();
    expect(deps.closeApp).not.toHaveBeenCalled();

    fireBack();
    expect(deps.closeApp).toHaveBeenCalledTimes(1);
  });

  it("closes the detail and scrolls to the top when the tab changes", () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useAppNavigation(deps));

    act(() => result.current.openPoolDetail(poolA));
    act(() => result.current.changeTab("fav"));

    expect(result.current.tab).toBe("fav");
    expect(result.current.selected).toBeNull();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
