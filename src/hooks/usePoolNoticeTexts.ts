import { useEffect, useState } from "react";
import {
  DEFAULT_POOL_NOTICE_TEXTS,
  fetchPoolNoticeTexts,
  type PoolNoticeTexts,
} from "../appText";

// DB에서 문구를 받아오기 전에는 번들 기본 문구로 그린다.
// 문구는 부가 정보라서 로딩 상태를 화면에 드러내지 않는다. 빈 줄이 깜빡이는 편이 더 나쁘다.
export function usePoolNoticeTexts(
  load: () => Promise<PoolNoticeTexts> = fetchPoolNoticeTexts,
) {
  const [texts, setTexts] = useState<PoolNoticeTexts>(DEFAULT_POOL_NOTICE_TEXTS);

  useEffect(() => {
    let alive = true;
    load()
      .then((next) => {
        if (alive) setTexts(next);
      })
      .catch(() => {
        if (alive) setTexts(DEFAULT_POOL_NOTICE_TEXTS);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  return texts;
}
