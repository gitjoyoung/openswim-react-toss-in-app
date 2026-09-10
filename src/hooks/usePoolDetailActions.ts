import { useCallback } from "react";
import type { Pool } from "../pool";
import { getMyLocationSilent } from "../lib/geo";
import { openExternal, openKakaoMap, openNaverMap } from "../lib/mapLinks";

export function usePoolDetailActions(pool: Pool) {
  const openKakaoRoute = useCallback(async () => {
    if (pool.lat != null && pool.lng != null) {
      const origin = await getMyLocationSilent();
      await openKakaoMap(pool.name, pool.lat, pool.lng, origin ?? undefined);
    }
  }, [pool.lat, pool.lng, pool.name]);

  const openNaverRoute = useCallback(async () => {
    if (pool.lat != null && pool.lng != null) {
      const origin = await getMyLocationSilent();
      await openNaverMap(pool.name, pool.lat, pool.lng, origin ?? undefined);
    }
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
