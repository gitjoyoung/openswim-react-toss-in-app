import { describe, expect, it } from "vitest";
import { DEFAULT_POOL_NOTICE_TEXTS, toPoolNoticeTexts } from "./appText";

describe("toPoolNoticeTexts", () => {
  it("maps the app_texts rows onto the notice texts", () => {
    const texts = toPoolNoticeTexts([
      { key: "pool_notice_verified", value: "{date}에 확인했습니다." },
      { key: "pool_notice_link_label", value: "확인" },
      { key: "pool_notice_unverified", value: "확인 못했습니다." },
      { key: "pool_notice_caution", value: "가기 전에 전화하세요." },
    ]);

    expect(texts).toEqual({
      verified: "{date}에 확인했습니다.",
      linkLabel: "확인",
      unverified: "확인 못했습니다.",
      caution: "가기 전에 전화하세요.",
    });
  });

  // 운영자가 행 하나를 지우거나 공백으로 비워도 그 항목만 기본 문구로 돌아가야 한다.
  it("falls back per key when a row is missing or blank", () => {
    const texts = toPoolNoticeTexts([
      { key: "pool_notice_caution", value: "   " },
      { key: "pool_notice_verified", value: "{date} 확인" },
    ]);

    expect(texts.verified).toBe("{date} 확인");
    expect(texts.caution).toBe(DEFAULT_POOL_NOTICE_TEXTS.caution);
    expect(texts.unverified).toBe(DEFAULT_POOL_NOTICE_TEXTS.unverified);
    expect(texts.linkLabel).toBe(DEFAULT_POOL_NOTICE_TEXTS.linkLabel);
  });

  it("ignores a broken payload entirely", () => {
    expect(toPoolNoticeTexts(null)).toEqual(DEFAULT_POOL_NOTICE_TEXTS);
    expect(toPoolNoticeTexts([{ key: 1, value: 2 }])).toEqual(DEFAULT_POOL_NOTICE_TEXTS);
  });
});
