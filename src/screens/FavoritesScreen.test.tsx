import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Pool } from "../pool";
import FavoritesScreen from "./FavoritesScreen";

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

describe("FavoritesScreen", () => {
  it("shows a list skeleton while loading", () => {
    render(
      <FavoritesScreen
        pools={[samplePool]}
        favs={["sample"]}
        onToggleFav={() => {}}
        onSelect={() => {}}
        loading
      />,
    );

    expect(screen.getByText("즐겨찾기")).toBeInTheDocument();
    expect(screen.getByTestId("pool-list-skeleton")).toBeInTheDocument();
  });

  it("shows the empty state when not loading and no favorites", () => {
    render(
      <FavoritesScreen
        pools={[samplePool]}
        favs={[]}
        onToggleFav={() => {}}
        onSelect={() => {}}
      />,
    );

    const matches = screen.getAllByText((content) =>
      content.includes("아직 즐겨찾기가 없어요."),
    );
    expect(matches.length).toBeGreaterThan(0);
  });
});
