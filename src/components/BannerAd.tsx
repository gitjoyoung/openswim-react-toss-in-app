import { useEffect, useRef, useState } from "react";
import { TossAds } from "@apps-in-toss/web-framework";

// 앱인토스 인앱 광고(배너). 콘솔 > 인앱 광고에서 만든 광고 그룹 ID를 VITE_TOSS_AD_GROUP_ID 로 넣는다.
// ID가 없거나(로컬 dev) 브릿지가 없으면(일반 브라우저) 아무것도 그리지 않아 레이아웃에 영향이 없다.
// 자리별로 그룹을 나누면 콘솔에서 성과를 따로 볼 수 있다. home = 홈 필터 아래, detail = 상세 시간표 아래.
const AD_GROUP_IDS: Record<"home" | "detail", string | undefined> = {
  home: import.meta.env.VITE_TOSS_AD_GROUP_ID,
  detail: import.meta.env.VITE_TOSS_AD_GROUP_ID_DETAIL,
};

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  TossAds.initialize({
    callbacks: {
      onInitializationFailed: (e) => console.warn("TossAds init failed", e),
    },
  });
}

export default function BannerAd({ slot = "home" }: { slot?: "home" | "detail" }) {
  const adGroupId = AD_GROUP_IDS[slot];
  const ref = useRef<HTMLDivElement>(null);
  // 광고가 실제로 붙었을 때만 여백을 준다 (빈 자리가 남지 않게).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!adGroupId || !ref.current) return;
    if (!TossAds.attachBanner.isSupported()) return;
    ensureInitialized();
    const { destroy } = TossAds.attachBanner(adGroupId, ref.current, {
      theme: "auto",
      variant: "card",
      callbacks: {
        onAdRendered: () => setLoaded(true),
        onAdFailedToRender: () => setLoaded(false),
        onNoFill: () => setLoaded(false),
      },
    });
    return destroy;
  }, [adGroupId]);

  if (!adGroupId) return null;
  return <div ref={ref} style={{ padding: loaded ? "0 20px 12px" : 0 }} />;
}
