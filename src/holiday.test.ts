import { describe, expect, it } from "vitest";
import { toHolidayMap } from "./holiday";

describe("toHolidayMap", () => {
  it("maps rows into a date-keyed table", () => {
    expect(
      toHolidayMap([
        { date: "2026-09-25", name: "추석" },
        { date: "2026-10-03", name: "개천절" },
      ]),
    ).toEqual({ "2026-09-25": "추석", "2026-10-03": "개천절" });
  });

  // 이름이 비어도 공휴일 판정 자체는 살려야 한다. 이름은 화면 문구에만 쓴다.
  it("falls back to a generic name when the row has none", () => {
    expect(toHolidayMap([{ date: "2026-09-25", name: "  " }])).toEqual({
      "2026-09-25": "공휴일",
    });
  });

  it("drops rows whose date is not a plain yyyy-mm-dd", () => {
    expect(
      toHolidayMap([
        { date: "2026-09-25T00:00:00Z", name: "추석" },
        { date: 20260925, name: "추석" },
        { name: "추석" },
        { date: "2026-10-03", name: "개천절" },
      ]),
    ).toEqual({ "2026-10-03": "개천절" });
  });

  it("ignores a broken payload", () => {
    expect(toHolidayMap(null)).toEqual({});
    expect(toHolidayMap("nope")).toEqual({});
  });
});
