import { useCallback, useEffect, useRef, useState } from "react";
import { graniteEvent, Screen as AitScreen } from "@apps-in-toss/web-framework";
import type { Pool } from "../pool";

export type Tab = "home" | "nearby" | "fav";

type AppNavigationDeps = {
  addBackEventListener: (onEvent: () => void) => () => void;
  closeApp: () => void;
};

const defaultDeps: AppNavigationDeps = {
  addBackEventListener: (onEvent) => graniteEvent.addEventListener("backEvent", { onEvent }),
  closeApp: () => AitScreen.close(),
};

export function useAppNavigation(deps: AppNavigationDeps = defaultDeps) {
  const [tab, setTab] = useState<Tab>("home");
  const [selected, setSelected] = useState<Pool | null>(null);
  const detailOpenLockedRef = useRef(false);
  // backEvent 리스너는 한 번만 등록하므로, 콜백 안에서 최신 상세 상태를 ref로 읽는다.
  const selectedRef = useRef<Pool | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // 토스 내비게이션 바의 뒤로가기(시스템 back)를 앱 상태에 연결한다.
  // 상세가 열려 있으면 상세만 닫고, 첫 화면이면 미니앱을 종료한다.
  // (출시 체크리스트: "최초 화면에서 뒤로가기를 누르면 미니앱이 종료돼요")
  useEffect(() => {
    return deps.addBackEventListener(() => {
      if (selectedRef.current) {
        setSelected(null);
        return;
      }
      deps.closeApp();
    });
  }, [deps]);

  // 탭 이동 시 항상 상단부터. (상세는 모달이라 밑 화면 스크롤은 그대로 유지)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  // 첫 탭은 즉시 열고, 더블클릭·연속 탭으로 들어오는 후속 이벤트만 잠시 무시한다.
  const openPoolDetail = useCallback((pool: Pool) => {
    if (detailOpenLockedRef.current) return;
    detailOpenLockedRef.current = true;
    setSelected(pool);
    window.setTimeout(() => {
      detailOpenLockedRef.current = false;
    }, 400);
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
  }, []);

  const changeTab = useCallback((t: Tab) => {
    setSelected(null);
    setTab(t);
  }, []);

  return { tab, selected, openPoolDetail, closeDetail, changeTab };
}
