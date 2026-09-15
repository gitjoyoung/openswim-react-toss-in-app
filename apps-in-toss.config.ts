import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "openswim",

  brand: {
    primaryColor: "#3182f6"
  },

  permissions: [
    { name: "geolocation", access: "access" },
    // 수영장 상세의 주소 복사 버튼(Clipboard.setText)에 필요.
    { name: "clipboard", access: "write" }
  ],
  webBundleDir: "dist"
});
