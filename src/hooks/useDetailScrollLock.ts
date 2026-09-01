import { useEffect } from "react";

// 상세 모달 열린 동안 배경(탭 화면) 스크롤 잠금 + 위치 정확히 보존.
// position:fixed + top:-y 로 현재 스크롤을 고정하고, 닫을 때 그 위치로 복원.
export function useDetailScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    const b = document.body.style;
    b.position = "fixed";
    b.top = `-${y}px`;
    b.left = "0";
    b.right = "0";
    return () => {
      b.position = "";
      b.top = "";
      b.left = "";
      b.right = "";
      window.scrollTo(0, y);
    };
  }, [open]);
}
