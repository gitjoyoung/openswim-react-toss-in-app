import { useEffect, useState } from "react";
import { fetchGear, type GearItem } from "../gear";

// 수영용품 목록은 부가 정보라서 로딩/에러 상태를 화면에 노출하지 않는다.
// 못 가져오면 섹션 자체를 안 그린다 (빈 껍데기가 남는 것보다 낫다).
export function useGear(load: () => Promise<GearItem[]> = fetchGear) {
  const [items, setItems] = useState<GearItem[]>([]);

  useEffect(() => {
    let alive = true;
    load()
      .then((next) => {
        if (alive) setItems(next);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  return items;
}
