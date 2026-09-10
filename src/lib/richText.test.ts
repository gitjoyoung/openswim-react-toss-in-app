import { describe, expect, it } from "vitest";
import { fillTemplate, parseRichText } from "./richText";

describe("parseRichText", () => {
  it("turns a markdown link into a link segment", () => {
    expect(parseRichText("[해당 수영장 정보](https://a.go.kr)를 2026-09-02 확인하였습니다.")).toEqual([
      { text: "해당 수영장 정보", href: "https://a.go.kr" },
      { text: "를 2026-09-02 확인하였습니다.", href: null },
    ]);
  });

  it("keeps plain text as one segment", () => {
    expect(parseRichText("방문 전 확인이 필요합니다.")).toEqual([
      { text: "방문 전 확인이 필요합니다.", href: null },
    ]);
  });

  // 근거 URL 이 없는 수영장에서는 {source} 가 빈 문자열이 된다. 글자만 남고 링크는 빠져야 한다.
  it("drops the link when the url is empty", () => {
    expect(parseRichText("[해당 수영장 정보]()를 확인하였습니다.")).toEqual([
      { text: "해당 수영장 정보", href: null },
      { text: "를 확인하였습니다.", href: null },
    ]);
  });

  // DB 값이 그대로 href 가 되므로 스킴을 검사한다.
  it("refuses a non-http scheme", () => {
    expect(parseRichText("[누르지 마세요](javascript:alert)")).toEqual([
      { text: "누르지 마세요", href: null },
    ]);
    expect(parseRichText("[파일](file:///etc/passwd)")).toEqual([{ text: "파일", href: null }]);
  });

  it("handles more than one link and text on both ends", () => {
    expect(parseRichText("앞 [A](https://a.kr) 사이 [B](https://b.kr) 뒤")).toEqual([
      { text: "앞 ", href: null },
      { text: "A", href: "https://a.kr" },
      { text: " 사이 ", href: null },
      { text: "B", href: "https://b.kr" },
      { text: " 뒤", href: null },
    ]);
  });

  it("leaves unmatched brackets alone", () => {
    expect(parseRichText("[닫히지 않은 괄호 (https://a.kr)")).toEqual([
      { text: "[닫히지 않은 괄호 (https://a.kr)", href: null },
    ]);
  });
});

describe("fillTemplate", () => {
  it("fills the known placeholders", () => {
    expect(fillTemplate("{a}를 {b} 확인", { a: "정보", b: "2026-09-02" })).toBe(
      "정보를 2026-09-02 확인",
    );
  });

  it("erases a placeholder whose value is missing", () => {
    expect(fillTemplate("[정보]({source})", { source: null })).toBe("[정보]()");
  });

  it("leaves an unknown placeholder untouched so the mistake is visible", () => {
    expect(fillTemplate("{date} {unknown}", { date: "2026-09-02" })).toBe("2026-09-02 {unknown}");
  });
});
