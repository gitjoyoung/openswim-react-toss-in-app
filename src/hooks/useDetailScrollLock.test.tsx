import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDetailScrollLock } from "./useDetailScrollLock";

describe("useDetailScrollLock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    const b = document.body.style;
    b.position = "";
    b.top = "";
    b.left = "";
    b.right = "";
  });

  it("pins the body at the current scroll position while open", () => {
    Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
    renderHook(() => useDetailScrollLock(true));

    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-120px");
  });

  it("restores the body styles and scroll position on close", () => {
    Object.defineProperty(window, "scrollY", { value: 80, configurable: true });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { rerender } = renderHook(({ open }) => useDetailScrollLock(open), {
      initialProps: { open: true },
    });

    rerender({ open: false });

    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 80);
  });

  it("leaves the body untouched while closed", () => {
    renderHook(() => useDetailScrollLock(false));
    expect(document.body.style.position).toBe("");
  });
});
