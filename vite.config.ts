import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// 카카오맵 JS SDK는 카카오 콘솔 [플랫폼 > Web]에 등록된 도메인과 정확히 일치해야 동작한다.
// 등록된 개발 도메인은 http://localhost:5173 하나라서 포트·호스트를 고정한다.
// - strictPort: 포트가 쓰이는 중이면 다른 포트로 도망가지 않고 즉시 실패시킨다.
//   (조용히 5174로 넘어가면 지도만 안 나오는 상태로 시간을 날리게 된다)
// - host: 127.0.0.1로 열면 동일 도메인이 아니라 카카오맵이 막힌다.
const DEV_PORT = 5173;

export default defineConfig({
  plugins: [aitDevtools.vite(), react()],
  server: {
    host: "localhost",
    port: DEV_PORT,
    strictPort: true,
    // 이 개발 환경에서는 파일시스템 변경 알림이 vite 워처까지 오지 않아
    // 코드를 고쳐도 옛 모듈을 계속 서빙한다(HMR도 안 뜬다). 폴링으로 강제한다.
    watch: { usePolling: true, interval: 300 },
  },
  preview: {
    host: "localhost",
    port: DEV_PORT,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
  },
});
