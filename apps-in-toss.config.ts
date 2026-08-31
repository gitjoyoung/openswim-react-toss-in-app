import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "openswim",

  brand: {
    primaryColor: "#3182f6"
  },

  permissions: [{ name: "geolocation", access: "access" }],
  webBundleDir: "dist"
});
