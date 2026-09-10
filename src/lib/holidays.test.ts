import { afterEach, describe, expect, it } from "vitest";
import {
  BUNDLED_HOLIDAY_COUNT,
  holidayName,
  isHoliday,
  resetHolidays,
  setHolidays,
} from "./holidays";

afterEach(() => {
  resetHolidays();
});

describe("bundled holiday table", () => {
  it("keeps the dates published in the 월력요항", () => {
    expect(isHoliday(new Date("2026-09-25T09:00:00+09:00"))).toBe(true); // 추석
    expect(holidayName(new Date("2027-02-07T09:00:00+09:00"))).toBe("설날");
    expect(holidayName(new Date("2027-02-09T09:00:00+09:00"))).toBe("설날 대체공휴일");
  });

  // 2026.5.1 / 5.11 시행된 법 개정으로 추가된 날. 월력요항 발표 뒤에 바뀌어 빠져 있었다.
  it("includes 노동절 and 제헌절", () => {
    expect(holidayName(new Date("2026-05-01T09:00:00+09:00"))).toBe("노동절");
    expect(holidayName(new Date("2026-07-17T09:00:00+09:00"))).toBe("제헌절");
  });

  // 설날·추석 연휴는 일요일과 겹칠 때만 대체공휴일이 생긴다(관공서공휴일규정 제3조).
  // 2026년 추석 연휴는 9.24(목)~9.26(토)이라 9.28(월)은 평일이다.
  it("does not treat 2026-09-28 as a holiday", () => {
    expect(isHoliday(new Date("2026-09-28T09:00:00+09:00"))).toBe(false);
  });

  // 현충일은 대체공휴일 대상이 아니다. 2026년 현충일은 토요일이었다.
  it("gives 현충일 no substitute holiday", () => {
    expect(isHoliday(new Date("2026-06-08T09:00:00+09:00"))).toBe(false);
  });

  it("covers two years", () => {
    expect(BUNDLED_HOLIDAY_COUNT).toBe(45);
  });
});

describe("setHolidays", () => {
  it("replaces the table with the one from the database", () => {
    setHolidays({ "2026-09-28": "임시공휴일" });

    expect(holidayName(new Date("2026-09-28T09:00:00+09:00"))).toBe("임시공휴일");
    // 교체이므로 번들 표의 날짜는 더 이상 공휴일이 아니다. DB가 원본이다.
    expect(isHoliday(new Date("2026-09-25T09:00:00+09:00"))).toBe(false);
  });

  // 잘못된 update 한 번으로 전국 공휴일이 사라지는 것보다 예전 표가 낫다.
  it("keeps the bundled table when the database returns nothing", () => {
    expect(setHolidays({})).toBe(false);
    expect(isHoliday(new Date("2026-09-25T09:00:00+09:00"))).toBe(true);
  });
});
