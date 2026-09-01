import { useEffect, useRef, useState } from "react";
import { TAB_BAR_HEIGHT } from "../design/tokens";

// 아래로 스크롤하면 탭바를 내려 숨기고, 위로 올리면 다시 보여준다.
// TDS BottomCTA의 hideOnScroll과 같은 동작이고, 임계값도 같은 의미(이만큼 움직여야 반응).
export function useHideOnScroll(threshold = 8): boolean {
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    lastYRef.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastYRef.current;
      if (Math.abs(delta) < threshold) return; // 미세한 흔들림은 무시
      lastYRef.current = y;
      // 최상단 근처에서는 항상 보여준다 (바운스로 숨은 채 남는 것 방지)
      setHidden(delta > 0 && y > TAB_BAR_HEIGHT);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return hidden;
}
