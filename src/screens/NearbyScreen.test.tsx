import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import NearbyScreen from "./NearbyScreen";

vi.mock("../hooks/usePoolMap", () => ({
  usePoolMap: () => ({ ready: true, error: null, locating: false, locateMe: vi.fn() }),
}));

const pools: Pool[] = [
  {
    id: "gangnam",
    name: "역삼 수영장",
    sido: "서울특별시",
    gu: "강남구",
    address: "서울 강남구 역삼동 1",
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
  },
  {
    id: "geumcheon",
    name: "금천 수영장",
    sido: "서울특별시",
    gu: "금천구",
    address: "서울 금천구 독산동 1",
    lat: 37.45,
    lng: 126.9,
    phone: null,
    homepage_url: null,
    subway: null,
    price_free_swim: null,
    price_note: null,
    prices: [],
    facilities: [],
    free_swim: [],
    images: [],
  },
];

describe("NearbyScreen", () => {
  it("keeps the zoomable map surface and commits a selected region through the search panel", () => {
    const { container } = render(<NearbyScreen pools={pools} onSelect={vi.fn()} />);
    const input = screen.getByRole("textbox");

    expect(container.querySelector("[data-allow-zoom]")).toBeInTheDocument();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "강남구" } });
    fireEvent.mouseDown(screen.getByText("서울 강남구").closest("button")!);

    expect(input).toHaveValue("서울 강남구");
    expect(screen.getByRole("button", { name: "현재 위치로 이동" })).toBeEnabled();
  });
});
