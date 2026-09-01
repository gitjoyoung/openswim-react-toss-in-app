import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "./pool";
import App from "./App";

const fetchPools = vi.hoisted(() => vi.fn());
const migrateFromPreviousOrigin = vi.hoisted(() => vi.fn());

vi.mock("./pool", () => ({ fetchPools }));

vi.mock("./lib/storageMigration", () => ({ migrateFromPreviousOrigin }));

vi.mock("@apps-in-toss/web-framework", () => ({
  graniteEvent: { addEventListener: vi.fn(() => () => {}) },
  Screen: { close: vi.fn() },
}));

// 셸 동작만 검증한다. 홈 화면 자체는 HomeScreen.test.tsx가 다룬다.
vi.mock("./screens/HomeScreen", () => ({
  default: ({ pools, favs }: { pools: Pool[]; favs: string[] }) => (
    <div data-testid="home">
      <span data-testid="pool-count">{pools.length}</span>
      <span data-testid="favs">{favs.join(",")}</span>
    </div>
  ),
}));

const samplePool = { id: "p1", name: "수영장" } as Pool;

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchPools.mockReset();
    migrateFromPreviousOrigin.mockReset();
    migrateFromPreviousOrigin.mockResolvedValue(null);
  });

  it("loads pools and renders the home screen", async () => {
    fetchPools.mockResolvedValue([samplePool]);
    render(<App />);

    await act(async () => {});

    expect(screen.getByTestId("pool-count")).toHaveTextContent("1");
  });

  it("shows the load error state and recovers through the retry button", async () => {
    fetchPools
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([samplePool]);
    render(<App />);

    await act(async () => {});
    expect(screen.getByText(/정보를 불러오지 못했어요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await act(async () => {});

    expect(screen.getByTestId("pool-count")).toHaveTextContent("1");
  });

  it("merges favorites migrated from the previous origin", async () => {
    fetchPools.mockResolvedValue([samplePool]);
    migrateFromPreviousOrigin.mockResolvedValue(["p1", "p2"]);
    render(<App />);

    await act(async () => {});

    expect(screen.getByTestId("favs")).toHaveTextContent("p1,p2");
  });
});
