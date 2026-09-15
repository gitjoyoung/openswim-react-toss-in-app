import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openExternal, openKakaoMap, openNaverMap } from "./mapLinks";

const device = vi.hoisted(() => ({ openURL: vi.fn() }));

vi.mock("@apps-in-toss/web-framework", () => ({
  Device: { openURL: device.openURL },
}));

describe("map links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    device.openURL.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a web URL through the Toss bridge", async () => {
    await openExternal("https://example.com/pool");

    expect(device.openURL).toHaveBeenCalledWith("https://example.com/pool");
  });

  it("falls back to a new browser tab when the Toss bridge is unavailable", async () => {
    device.openURL.mockRejectedValueOnce(new Error("bridge unavailable"));
    const browserOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    await openExternal("https://example.com/pool");

    expect(browserOpen).toHaveBeenCalledWith(
      "https://example.com/pool",
      "_blank",
      "noopener",
    );
  });

  it("includes the known current location in both walking route schemes", async () => {
    const origin = { lat: 37.45, lng: 126.9 };

    await openKakaoMap("테스트 수영장", 37.5, 127, origin);
    await openNaverMap("테스트 수영장", 37.5, 127, origin);

    expect(device.openURL).toHaveBeenNthCalledWith(
      1,
      "kakaomap://route?sp=37.45,126.9&ep=37.5,127&by=FOOT",
    );
    expect(device.openURL).toHaveBeenNthCalledWith(
      2,
      "nmap://route/walk?slat=37.45&slng=126.9&sname=%ED%98%84%EC%9E%AC%20%EC%9C%84%EC%B9%98&dlat=37.5&dlng=127&dname=%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%88%98%EC%98%81%EC%9E%A5&appname=openswim",
    );
  });
});
