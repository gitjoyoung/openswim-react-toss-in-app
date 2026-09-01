import { useCallback, useEffect, useState } from "react";
import { fetchPools, type Pool } from "../pool";

export function usePools(fetch: () => Promise<Pool[]> = fetchPools) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetch()
      .then(setPools)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [fetch]);

  useEffect(() => {
    retry();
  }, [retry]);

  return { pools, loading, loadError, retry };
}
