import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "openswim",

  brand: {
    primaryColor: "#3182f6"
  },

  webView: {
    // 인트로 영상(public/intro.mp4)이 앱 진입 시 자동 재생돼야 한다.
    // 기본값(mediaPlaybackRequiresUserAction: true, allowsInlineMediaPlayback: false)이면
    // 사용자가 탭하기 전엔 재생되지 않고, 인라인 재생도 막혀 스플래시가 깨진다.
    mediaPlaybackRequiresUserAction: false,
    allowsInlineMediaPlayback: true,
  },

  permissions: [{ name: "geolocation", access: "access" }],
  webBundleDir: "dist"
});
