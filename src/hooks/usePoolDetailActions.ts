import { useCallback } from "react";
import type { Pool } from "../pool";
import { openExternal, openKakaoMap, openNaverMap } from "../lib/mapLinks";

export function usePoolDetailActions(pool: Pool) {
  const openKakaoRoute = useCallback(() => {
    if (pool.lat != null && pool.lng != null)
      openKakaoMap(pool.name, pool.lat, pool.lng);
  }, [pool.lat, pool.lng, pool.name]);

  const openNaverRoute = useCallback(() => {
    if (pool.lat != null && pool.lng != null)
      openNaverMap(pool.name, pool.lat, pool.lng);
  }, [pool.lat, pool.lng, pool.name]);

  const openHomepage = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (pool.homepage_url) void openExternal(pool.homepage_url);
    },
    [pool.homepage_url],
  );

  return { openKakaoRoute, openNaverRoute, openHomepage };
}
