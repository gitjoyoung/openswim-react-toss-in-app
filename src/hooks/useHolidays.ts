import { useEffect, useState } from "react";
import { loadHolidays } from "../holiday";

// 공휴일 표를 DB에서 받아 모듈 캐시에 넣고, 갈아끼워졌으면 화면을 한 번 다시 그린다.
// isHoliday()는 동기 함수라 값만 바꾸면 이미 그려진 목록이 갱신되지 않는다.
export function useHolidays(load: () => Promise<boolean> = loadHolidays) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((replaced) => {
        if (alive && replaced) setLoaded(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [load]);

  return loaded;
}
