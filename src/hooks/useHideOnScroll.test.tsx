import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHideOnScroll } from "./useHideOnScroll";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("useHideOnScroll", () => {
  it("hides after scrolling down past the tab bar and shows again on scroll up", () => {
    scrollTo(0);
    const { result } = renderHook(() => useHideOnScroll());
    expect(result.current).toBe(false);

    scrollTo(200);
    expect(result.current).toBe(true);

    scrollTo(150);
    expect(result.current).toBe(false);
  });

  it("ignores movement smaller than the threshold", () => {
    scrollTo(200);
    const { result } = renderHook(() => useHideOnScroll());

    scrollTo(300);
    expect(result.current).toBe(true);

    scrollTo(297); // 8px 미만의 흔들림은 상태를 바꾸지 않는다
    expect(result.current).toBe(true);
  });

  it("keeps the bar visible when scrolling down near the top", () => {
    scrollTo(0);
    const { result } = renderHook(() => useHideOnScroll());

    scrollTo(40); // 아래로 움직였지만 탭바 높이(68px) 이내라 계속 보여준다
    expect(result.current).toBe(false);
  });
});
