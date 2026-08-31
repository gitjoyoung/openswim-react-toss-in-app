import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import HomeScreen from "./HomeScreen";

vi.mock("../lib/geo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/geo")>();
  return {
    ...actual,
    getMyLocationSilent: vi.fn().mockResolvedValue(null),
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

describe("HomeScreen", () => {
  it("renders the searchable pool list without a render-time reference error", () => {
    render(
      <HomeScreen
        pools={[samplePool]}
        loading={false}
        favs={[]}
        onToggleFav={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();
  });

  it("offers a pool by its address without applying the search before submit", async () => {
    vi.useFakeTimers();
    render(
      <HomeScreen
        pools={[samplePool]}
        loading={false}
        favs={[]}
        onToggleFav={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("textbox");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "역삼동" } });
    expect(screen.getByText("역삼청소년수련관 수영장")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(screen.getAllByText("역삼청소년수련관 수영장")).toHaveLength(2);
    vi.useRealTimers();
  });
});
