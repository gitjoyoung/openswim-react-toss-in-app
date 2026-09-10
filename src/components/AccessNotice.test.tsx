import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AccessNotice from "./AccessNotice";
import type { Pool } from "../pool";

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: "p", name: "테스트 수영장", sido: "서울특별시", gu: "용산구",
    address: null, lat: null, lng: null, phone: null, homepage_url: null, subway: null,
    price_free_swim: null, price_note: null, prices: [], facilities: {}, free_swim: [], images: [],
    ...overrides,
  };
}

describe("AccessNotice", () => {
  // 확인되지 않은 수영장이 841곳이다. 값이 없으면 아무것도 그리지 않아야 한다.
  it("renders nothing without a label", () => {
    const { container } = render(<AccessNotice pool={pool()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the label is only whitespace", () => {
    const { container } = render(<AccessNotice pool={pool({ access_label: "   " })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the badge and the note", () => {
    render(
      <AccessNotice
        pool={pool({
          access_label: "일부 시간 회원 전용",
          access_note: "평일 08:00 타임은 월정기권 회원만 이용할 수 있습니다.",
        })}
      />,
    );

    expect(screen.getByText("일부 시간 회원 전용")).toBeInTheDocument();
    expect(
      screen.getByText("평일 08:00 타임은 월정기권 회원만 이용할 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("shows the badge alone when the note is empty", () => {
    render(<AccessNotice pool={pool({ access_label: "여성 전용" })} />);
    expect(screen.getByText("여성 전용")).toBeInTheDocument();
  });

  // 목록 카드에서는 이름과 한 줄에 놓이므로 설명은 빼고 배지만 보여준다.
  it("drops the note in compact mode", () => {
    render(
      <AccessNotice
        pool={pool({ access_label: "여성 전용", access_note: "남성은 이용할 수 없습니다." })}
        compact
      />,
    );

    expect(screen.getByText("여성 전용")).toBeInTheDocument();
    expect(screen.queryByText("남성은 이용할 수 없습니다.")).toBeNull();
  });
});
