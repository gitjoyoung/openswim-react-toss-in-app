import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../pool";
import PoolDetail from "./PoolDetail";

const maps = vi.hoisted(() => ({
  kakao: vi.fn(),
  naver: vi.fn(),
  external: vi.fn(),
}));

vi.mock("@toss/tds-mobile", () => {
  const Top = ({
    title,
    subtitleBottom,
  }: {
    title: React.ReactNode;
    subtitleBottom: React.ReactNode;
  }) => (
    <div>
      {title}
      {subtitleBottom}
    </div>
  );
  Top.TitleParagraph = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  Top.SubtitleParagraph = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  return {
    Top,
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  };
});

vi.mock("../components/PoolMap", () => ({
  default: ({ lat, lng }: { lat: number; lng: number }) => (
    <div data-testid="pool-map" data-lat={lat} data-lng={lng} />
  ),
}));
vi.mock("../components/BannerAd", () => ({
  default: () => <div data-testid="detail-banner">detail-banner</div>,
}));
vi.mock("../lib/mapLinks", () => ({
  openKakaoMap: maps.kakao,
  openNaverMap: maps.naver,
  openExternal: maps.external,
}));

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: "pool-1",
    name: "테스트 수영장",
    sido: "서울특별시",
    gu: "금천구",
    address: "서울 금천구 테스트로 1",
    lat: 37.5,
    lng: 127,
    phone: "02-1234-5678",
    homepage_url: "https://pool.example.com",
    subway: null,
    price_free_swim: 5000,
    price_note: null,
    prices: [{ label: "성인", amount: 5000 }],
    facilities: { lanes: 6 },
    free_swim: [{ day: 1, sessions: [{ start: "09:00", end: "10:00" }] }],
    images: [],
    ...overrides,
  };
}

describe("PoolDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the detail banner above the location preview and preserves section order", () => {
    const { container } = render(
      <PoolDetail
        pool={pool()}
        isFav={false}
        onToggleFav={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pool-map")).toHaveAttribute("data-lat", "37.5");
    expect(screen.getByTestId("pool-map")).toHaveAttribute("data-lng", "127");
    expect(screen.getByText("위치")).toBeInTheDocument();
    expect(screen.getByText("정보")).toBeInTheDocument();
    expect(screen.getByText("시간표")).toBeInTheDocument();
    expect(screen.getAllByText("요금")[0]).toBeInTheDocument();
    expect(screen.getByText("시설")).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text.indexOf("detail-banner")).toBeLessThan(text.indexOf("위치"));
    expect(text.indexOf("위치")).toBeLessThan(text.indexOf("정보"));
    expect(text.indexOf("정보")).toBeLessThan(text.indexOf("시간표"));
    expect(text.indexOf("시간표")).toBeLessThan(text.indexOf("요금"));
    expect(text.indexOf("요금")).toBeLessThan(text.indexOf("시설"));
  });

  it("hides optional sections but retains established empty-state copy", () => {
    render(
      <PoolDetail
        pool={pool({
          lat: null,
          lng: null,
          phone: null,
          homepage_url: null,
          free_swim: [],
          prices: [],
          facilities: {},
          price_free_swim: null,
        })}
        isFav={false}
        onToggleFav={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText("위치")).not.toBeInTheDocument();
    expect(screen.queryByText("정보")).not.toBeInTheDocument();
    expect(screen.getByText("시설 문의")).toBeInTheDocument();
    expect(screen.getByText("시설 정보 없음")).toBeInTheDocument();
    expect(
      screen.getByText("정규권과 강습 요금은 수영장에 직접 문의해 주세요."),
    ).toBeInTheDocument();
  });

  it("invokes close, favorite, external homepage, and map route actions", () => {
    const onToggleFav = vi.fn();
    const onClose = vi.fn();
    render(
      <PoolDetail
        pool={pool()}
        isFav={false}
        onToggleFav={onToggleFav}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    fireEvent.click(screen.getByRole("button", { name: "즐겨찾기" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오맵 길찾기" }));
    fireEvent.click(screen.getByRole("button", { name: "네이버 지도" }));
    fireEvent.click(
      screen.getByRole("link", { name: /https:\/\/pool\.example\.com/ }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(onToggleFav).toHaveBeenCalledOnce();
    expect(maps.kakao).toHaveBeenCalledWith("테스트 수영장", 37.5, 127);
    expect(maps.naver).toHaveBeenCalledWith("테스트 수영장", 37.5, 127);
    expect(maps.external).toHaveBeenCalledWith("https://pool.example.com");
  });
});
