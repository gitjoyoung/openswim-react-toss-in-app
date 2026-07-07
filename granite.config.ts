import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "openswim",
  brand: {
    displayName: "오늘 자유수영",
    primaryColor: "#3182f6",
    icon: "https://static.toss.im/appsintoss/57209/6ececa6f-b3bb-417a-a72d-768a6bc8e26d.png", // 앱 로고(아이콘)
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [{ name: "geolocation", access: "access" }],
  outdir: "dist",
});
