import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GearSection from "./GearSection";
import { GEAR_DISCLOSURE, toGearItems, type GearItem } from "../gear";

const links = vi.hoisted(() => ({ openExternal: vi.fn() }));
const gear = vi.hoisted(() => ({ fetchGear: vi.fn() }));

vi.mock("../lib/mapLinks", () => ({ openExternal: links.openExternal }));
vi.mock("../gear", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../gear")>();
  return { ...actual, fetchGear: gear.fetchGear };
});

vi.mock("@toss/tds-mobile", () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const item = (over: Partial<GearItem> = {}): GearItem => ({
  id: "2613455511",
  name: "아레나 웨이브마크 4부 남성 수영복",
  note: "남성 4부",
  image: "https://shopping.toss.im/13d/live/product/824506467/x.jpg",
  url: "https://toss.im/_m/1qMYZtxo",
  ...over,
});

describe("GearSection", () => {
  it("shows the db-backed items with the required affiliate disclosure", async () => {
    gear.fetchGear.mockResolvedValue([item()]);
    render(<GearSection />);

    expect(await screen.findByText("아레나 웨이브마크 4부 남성 수영복")).toBeInTheDocument();
    // 공정위 경제적 이해관계 표시는 링크와 같은 화면에 있어야 한다.
    expect(screen.getByText(GEAR_DISCLOSURE)).toBeInTheDocument();
  });

  it("renders the product image straight from the toss cdn", async () => {
    gear.fetchGear.mockResolvedValue([item()]);
    const { container } = render(<GearSection />);

    await screen.findByText(item().name);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^https:\/\/shopping\.toss\.im\//);
  });

  it("opens the sharelink through the external bridge, not an in-app route", async () => {
    gear.fetchGear.mockResolvedValue([item()]);
    render(<GearSection />);

    fireEvent.click(await screen.findByText(item().name));

    expect(links.openExternal).toHaveBeenCalledWith(item().url);
  });

  it("keeps three cards inline without scroll, and narrows them once the row overflows", async () => {
    // 3개까지는 화면에 딱 맞추고, 넘치면 다음 카드가 걸쳐 보이도록 폭을 줄인다.
    gear.fetchGear.mockResolvedValue([item(), item({ id: "b" }), item({ id: "c" })]);
    const three = render(<GearSection />);
    await three.findAllByRole("button");
    const threeWidth = (three.container.querySelector("li") as HTMLElement).style.width;
    // 카드 3장 + 사이 간격 2개(24px)가 폭에 딱 맞는다.
    expect(threeWidth).toContain("24px");

    three.unmount();

    gear.fetchGear.mockResolvedValue([
      item(),
      item({ id: "b" }),
      item({ id: "c" }),
      item({ id: "d" }),
    ]);
    const four = render(<GearSection />);
    await four.findAllByRole("button");
    const fourWidth = (four.container.querySelector("li") as HTMLElement).style.width;
    // 간격 3개(36px) + 걸쳐 보일 32px = 68px 을 빼서 다음 카드가 드러난다.
    expect(fourWidth).toContain("68px");
  });

  it("never shrinks a card below the readable minimum on narrow screens", async () => {
    gear.fetchGear.mockResolvedValue([item()]);
    const { container } = render(<GearSection />);
    await screen.findByText(item().name);

    // 좁은 뷰포트에서 1/3 폭이 너무 작아지면 max() 가 하한을 잡아준다.
    expect((container.querySelector("li") as HTMLElement).style.width).toContain("max(72px");
  });

  it("renders nothing when the db has no usable rows", async () => {
    gear.fetchGear.mockResolvedValue([]);
    const { container } = render(<GearSection />);

    await waitFor(() => expect(container.textContent).toBe(""));
  });
});

describe("toGearItems", () => {
  const row = {
    id: "uuid-1",
    product_id: "2613455511",
    name: "아레나 안티포그액",
    note: "김서림 방지",
    image_url: "https://shopping.toss.im/live/x.png",
    url: "https://toss.im/_m/1FFbboV9",
  };

  it("keeps a fully synced row and prefers the toss product id", () => {
    expect(toGearItems([row])).toEqual([
      {
        id: "2613455511",
        name: "아레나 안티포그액",
        note: "김서림 방지",
        image: "https://shopping.toss.im/live/x.png",
        url: "https://toss.im/_m/1FFbboV9",
      },
    ]);
  });

  it("drops rows that were inserted but not synced yet", () => {
    // url만 넣고 sync 전인 행. 그대로 그리면 빈 카드가 된다.
    expect(toGearItems([{ ...row, name: null, image_url: null }])).toEqual([]);
  });

  it("drops rows whose url is not a sharelink", () => {
    // 일반 공유 링크는 수익이 집계되지 않으므로 노출하지 않는다.
    expect(toGearItems([{ ...row, url: "https://toss.shopping/t/94653917" }])).toEqual([]);
  });

  it("returns an empty list for a malformed payload", () => {
    expect(toGearItems(null)).toEqual([]);
    expect(toGearItems({ error: "boom" })).toEqual([]);
  });
});
