import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKm, getMyLocation, getMyLocationSilent, haversineKm, type LatLng } from "../lib/geo";
import { hasCachedHomeSearch } from "./useHomeSearch";

type LocationDependencies = {
  getMyLocation: () => Promise<LatLng>;
  getMyLocationSilent: () => Promise<LatLng | null>;
};

const defaultDependencies: LocationDependencies = { getMyLocation, getMyLocationSilent };
const homeLocationCache: { location: LatLng | null } = { location: null };

export function useHomeLocation(dependencies: LocationDependencies = defaultDependencies) {
  const [location, setLocation] = useState<LatLng | null>(homeLocationCache.location);
  const [locating, setLocating] = useState(false);
  const [showLocLoader, setShowLocLoader] = useState(false);

  useEffect(() => {
    homeLocationCache.location = location;
  }, [location]);

  useEffect(() => {
    if (homeLocationCache.location || hasCachedHomeSearch()) return;
    let live = true;
    dependencies.getMyLocationSilent().then((result) => {
      if (live && result) setLocation(result);
    });
    return () => {
      live = false;
    };
  }, [dependencies]);

  const clearLocation = useCallback(() => setLocation(null), []);

  const toggleLocation = useCallback(async (): Promise<boolean> => {
    if (location) {
      setLocation(null);
      return false;
    }
    setLocating(true);
    const loaderTimer = setTimeout(() => setShowLocLoader(true), 300);
    try {
      setLocation(await dependencies.getMyLocation());
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(loaderTimer);
      setShowLocLoader(false);
      setLocating(false);
    }
  }, [location, dependencies]);

  const distanceText = useMemo(() => {
    if (!location) return undefined;
    return (pool: { lat: number | null; lng: number | null }) =>
      pool.lat != null && pool.lng != null ? formatKm(haversineKm(location, { lat: pool.lat, lng: pool.lng })) : null;
  }, [location]);

  return { location, locating, showLocLoader, clearLocation, toggleLocation, distanceText };
}
