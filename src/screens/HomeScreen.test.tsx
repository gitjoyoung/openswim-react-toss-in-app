import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import HomeScreen from "./HomeScreen";

const geo = vi.hoisted(() => ({
  getMyLocation: vi.fn(),
  getMyLocationSilent: vi.fn(),
}));

vi.mock("../lib/geo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/geo")>();
  return {
    ...actual,
    getMyLocation: geo.getMyLocation,
    getMyLocationSilent: geo.getMyLocationSilent,
  };
});

const samplePool: Pool = {
  id: "sample",
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
};

function pool(overrides: Partial<Pool>): Pool {
  return { ...samplePool, ...overrides };
}

function renderHome(pools: Pool[] = [samplePool]) {
  return render(
    <HomeScreen pools={pools} loading={false} favs={[]} onToggleFav={vi.fn()} onSelect={vi.fn()} />,
  );
}

async function waitForSuggestions() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
  });
}

describe("HomeScreen", () => {
  beforeEach(() => {
    geo.getMyLocation.mockReset();
    geo.getMyLocationSilent.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the searchable pool list without a render-time reference error", () => {
    renderHome();

    expect(screen.getByRole("textbox", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();
  });

  it("offers a pool by its address without applying the search before submit", async () => {
    vi.useFakeTimers();
    renderHome([
      samplePool,
      pool({ id: "other", name: "다른 수영장", gu: "금천구", address: "서울 금천구 독산동 1" }),
    ]);

    const searchInput = screen.getByRole("textbox");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "역삼동" } });
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();
    expect(screen.getByText("다른 수영장")).toBeInTheDocument();

    await waitForSuggestions();

    expect(screen.getAllByText("역삼청소년수련관 수영장")).toHaveLength(2);
    fireEvent.mouseDown(screen.getByRole("button", { name: "지우기" }));
  });

  it("applies the typed query only when Enter is pressed and clearing restores the full list", () => {
    const other = pool({ id: "other", name: "다른 수영장", gu: "금천구", address: "서울 금천구 독산동 1" });
    renderHome([samplePool, other]);

    const searchInput = screen.getByRole("textbox");
    fireEvent.change(searchInput, { target: { value: "역삼동" } });
    expect(screen.getByText("다른 수영장")).toBeInTheDocument();

    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(screen.queryByText("다른 수영장")).not.toBeInTheDocument();
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "지우기" }));
    expect(screen.getByText("다른 수영장")).toBeInTheDocument();
  });

  it("applies the selected region suggestion to the list", async () => {
    vi.useFakeTimers();
    const geumcheon = pool({ id: "geumcheon", name: "금천 수영장", gu: "금천구" });
    renderHome([samplePool, geumcheon]);

    const searchInput = screen.getByRole("textbox");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "강남구" } });
    await waitForSuggestions();

    fireEvent.mouseDown(screen.getAllByText("서울 강남구")[0].closest("button")!);
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();
    expect(screen.queryByText("금천 수영장")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "지우기" }));
  });

  it("filters the list when a day chip is selected", () => {
    const saturday = pool({
      id: "saturday",
      name: "토요일 수영장",
      gu: "금천구",
      free_swim: [{ day: 6, sessions: [{ start: "09:00", end: "10:00" }] }],
    });
    const sunday = pool({
      id: "sunday",
      name: "일요일 수영장",
      gu: "강남구",
      free_swim: [{ day: 0, sessions: [{ start: "09:00", end: "10:00" }] }],
    });
    renderHome([saturday, sunday]);

    fireEvent.click(screen.getByRole("button", { name: "토요일" }));
    expect(screen.getByText("토요일 수영장")).toBeInTheDocument();
    expect(screen.queryByText("일요일 수영장")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "전체" }));
  });

  it("uses an explicit location result to sort nearby pools first", async () => {
    geo.getMyLocation.mockResolvedValue({ lat: 37.5, lng: 127 });
    const far = pool({ id: "far", name: "먼 수영장", gu: "금천구", lat: 37.8, lng: 127.4 });
    const near = pool({ id: "near", name: "가까운 수영장", gu: "강남구", lat: 37.501, lng: 127.001 });
    const { container } = renderHome([far, near]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "내 위치로 가까운 순" }));
    });

    expect(screen.getByRole("button", { name: "가까운 순 정렬 끄기" })).toBeEnabled();
    expect(container.textContent!.indexOf("가까운 수영장")).toBeLessThan(container.textContent!.indexOf("먼 수영장"));

    fireEvent.click(screen.getByRole("button", { name: "가까운 순 정렬 끄기" }));
  });

  it("keeps the default list when explicit location lookup is rejected", async () => {
    geo.getMyLocation.mockRejectedValue(new Error("denied"));
    renderHome();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "내 위치로 가까운 순" }));
    });

    expect(screen.getByRole("button", { name: "내 위치로 가까운 순" })).toBeEnabled();
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();
  });

  it("does not update an unmounted screen after a silent location lookup resolves", async () => {
    let resolveSilent: (location: { lat: number; lng: number } | null) => void;
    geo.getMyLocationSilent.mockReturnValue(
      new Promise((resolve) => {
        resolveSilent = resolve;
      }),
    );
    const { unmount } = renderHome();

    unmount();
    await act(async () => {
      resolveSilent!({ lat: 37.5, lng: 127 });
    });

    expect(geo.getMyLocationSilent).toHaveBeenCalledTimes(1);
  });
});
