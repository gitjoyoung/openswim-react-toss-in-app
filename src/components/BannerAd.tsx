import { useEffect, useRef, useState } from "react";
import { TossAds } from "@apps-in-toss/web-framework";
import { Divider } from "../design/primitives";

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

export default function BannerAd({
  slot = "home",
  separated = false,
}: {
  slot?: "home" | "detail";
  // true 면 위아래 구분선을 두르고 자기 영역을 갖는다.
  // 상세처럼 섹션 사이에 끼울 때 쓴다 — 안 그러면 바로 아래 섹션(요금)의 일부처럼 보인다.
  separated?: boolean;
}) {
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

  // 컨테이너(ref)는 항상 렌더한다 — SDK 가 여기에 붙기 때문이다.
  // 여백은 주지 않는다. variant: "card" 광고 소재가 자체 여백과 라운드를 갖고 있어서
  // 우리가 패딩을 더하면 이중으로 들어가 떠 보인다(실기기 확인).
  // 구분선만 광고가 실제로 그려졌을 때 붙인다. 안 그러면 빈 띠만 남는다.
  const inner = <div ref={ref} />;

  if (!separated) return inner;

  return (
    <>
      {loaded && <Divider />}
      {inner}
      {loaded && <Divider />}
    </>
  );
}
