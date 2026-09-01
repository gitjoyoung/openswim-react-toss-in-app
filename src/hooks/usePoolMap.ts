import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Pool } from "../pool";
import { getMyLocation, getMyLocationSilent, type LatLng } from "../lib/geo";
import { loadKakao, type Kakao } from "../lib/kakaoMap";
import { DEFAULT_GU_CENTER } from "../lib/search";
import { markerState } from "../lib/pools";

export type MapCamera = "default" | "fit" | "skip";

type MarkerRecord = { marker: Kakao; state?: "open" | "closed" | "unknown" };

type NearbyMapOptions = {
  containerRef: RefObject<HTMLDivElement>;
  pools: Pool[];
  visiblePools: Pool[];
  camera: MapCamera;
  onCameraHandled: () => void;
  onMarkerSelect: (pool: Pool, markerHeight: number) => HTMLElement;
  onLocation: () => void;
};

type PreviewMapOptions = {
  containerRef: RefObject<HTMLDivElement>;
  preview: { center: LatLng; level: number };
};

type UsePoolMapOptions = NearbyMapOptions | PreviewMapOptions;

const DEFAULT_LEVEL = 6;
const PIN_W = 26;
const PIN_H = 36;
const OPEN = "#3182f6";
const CLOSED = "#f04452";
const UNKNOWN = "#f5a623";
const EMPTY_POOLS: Pool[] = [];

function pinDataUri(fill: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='36' viewBox='0 0 26 36'><path d='M13 0C5.8 0 0 5.8 0 13c0 9.2 13 23 13 23s13-13.8 13-23C26 5.8 20.2 0 13 0z' fill='${fill}'/><circle cx='13' cy='13' r='4.8' fill='white'/></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

function markerScale(level: number) {
  return Math.max(0.55, Math.min(1.1, 1 - (level - 5) * 0.09));
}

function markerImages(kakao: Kakao, level: number) {
  const scale = markerScale(level);
  const width = Math.round(PIN_W * scale);
  const height = Math.round(PIN_H * scale);
  const size = new kakao.maps.Size(width, height);
  const anchor = { offset: new kakao.maps.Point(Math.round(width / 2), height) };
  return {
    open: new kakao.maps.MarkerImage(pinDataUri(OPEN), size, anchor),
    closed: new kakao.maps.MarkerImage(pinDataUri(CLOSED), size, anchor),
    unknown: new kakao.maps.MarkerImage(pinDataUri(UNKNOWN), size, anchor),
  };
}

function currentLocationImage(kakao: Kakao) {
  return new kakao.maps.MarkerImage(
    "data:image/svg+xml;base64," +
      btoa(
        `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='11' cy='11' r='7' fill='#3182f6' stroke='white' stroke-width='3'/></svg>`,
      ),
    new kakao.maps.Size(22, 22),
    { offset: new kakao.maps.Point(11, 11) },
  );
}

// Owns the imperative Kakao map boundary. Rendered search and panel UI remain in the calling screen.
export function usePoolMap(options: UsePoolMapOptions) {
  const isPreview = "preview" in options;
  const { containerRef } = options;
  const preview = isPreview ? options.preview : null;
  const previewLat = preview?.center.lat;
  const previewLng = preview?.center.lng;
  const previewLevel = preview?.level;
  const pools = isPreview ? EMPTY_POOLS : options.pools;
  const visiblePools = isPreview ? EMPTY_POOLS : options.visiblePools;
  const camera: MapCamera = isPreview ? "skip" : options.camera;
  const onCameraHandled = isPreview ? undefined : options.onCameraHandled;
  const onMarkerSelect = isPreview ? undefined : options.onMarkerSelect;
  const onLocation = isPreview ? undefined : options.onLocation;
  const kakaoRef = useRef<Kakao>(null);
  const mapRef = useRef<Kakao>(null);
  const markersRef = useRef<MarkerRecord[]>([]);
  const overlayRef = useRef<Kakao>(null);
  const meRef = useRef<Kakao>(null);
  const previewRef = useRef(preview);
  const previewMarkerRef = useRef<Kakao>(null);
  previewRef.current = preview;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = [];
  }, []);

  const showMeAt = useCallback(
    (lat: number, lng: number) => {
      const kakao = kakaoRef.current;
      const map = mapRef.current;
      if (!kakao || !map) return;
      const position = new kakao.maps.LatLng(lat, lng);
      meRef.current?.setMap(null);
      meRef.current = new kakao.maps.Marker({ position, map, image: currentLocationImage(kakao) });
      onLocation?.();
      map.setLevel(5);
      map.panTo(position);
    },
    [onLocation],
  );

  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((kakao) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        containerRef.current.innerHTML = "";
        kakaoRef.current = kakao;
        const center = previewRef.current ?? { center: DEFAULT_GU_CENTER, level: DEFAULT_LEVEL };
        const position = new kakao.maps.LatLng(center.center.lat, center.center.lng);
        const map = new kakao.maps.Map(containerRef.current, {
          center: position,
          level: center.level,
        });
        mapRef.current = map;
        if (previewRef.current) {
          const marker = new kakao.maps.Marker({ position, map });
          markersRef.current.push({ marker });
          previewMarkerRef.current = marker;
          map.setDraggable(false);
          map.setZoomable(false);
        }
        kakao.maps.event.addListener(map, "click", () => overlayRef.current?.setMap(null));
        kakao.maps.event.addListener(map, "zoom_changed", () => {
          overlayRef.current?.setMap(null);
          overlayRef.current = null;
          const images = markerImages(kakao, map.getLevel());
          markersRef.current.forEach(({ marker, state }) => {
            if (state) marker.setImage(images[state]);
          });
        });
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "지도를 불러오지 못했어요.");
      });
    return () => {
      cancelled = true;
      clearMarkers();
      overlayRef.current?.setMap(null);
      meRef.current?.setMap(null);
    };
  }, [clearMarkers, containerRef]);

  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !kakao || !map) return;
    if (isPreview) return;

    clearMarkers();
    overlayRef.current?.setMap(null);
    const images = markerImages(kakao, map.getLevel());
    pools
      .filter((pool) => pool.lat != null && pool.lng != null)
      .forEach((pool) => {
        const state = markerState(pool);
        const position = new kakao.maps.LatLng(pool.lat, pool.lng);
        const marker = new kakao.maps.Marker({ position, map, title: pool.name, image: images[state] });
        kakao.maps.event.addListener(marker, "click", () => {
          overlayRef.current?.setMap(null);
          if (!onMarkerSelect) return;
          const content = onMarkerSelect(pool, Math.round(PIN_H * markerScale(map.getLevel())));
          const overlay = new kakao.maps.CustomOverlay({ position, content, yAnchor: 1, clickable: true });
          overlay.setMap(map);
          overlayRef.current = overlay;
          map.panTo(position);
        });
        markersRef.current.push({ marker, state });
      });
  }, [clearMarkers, isPreview, onMarkerSelect, pools, ready]);

  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!ready || !kakao || !map) return;
    if (camera === "default") {
      map.setCenter(new kakao.maps.LatLng(DEFAULT_GU_CENTER.lat, DEFAULT_GU_CENTER.lng));
      map.setLevel(DEFAULT_LEVEL);
    } else if (camera === "fit" && visiblePools.length) {
      const focus = visiblePools.filter((pool) => pool.lat != null && pool.lng != null);
      if (focus.length === 1) {
        map.setCenter(new kakao.maps.LatLng(focus[0].lat, focus[0].lng));
        if (map.getLevel() > 6 || map.getLevel() < 4) map.setLevel(5);
      } else if (focus.length > 1) {
        const bounds = new kakao.maps.LatLngBounds();
        focus.forEach((pool) => bounds.extend(new kakao.maps.LatLng(pool.lat, pool.lng)));
        map.setBounds(bounds);
        if (map.getLevel() < 4) map.setLevel(4);
      }
    }
    if (camera !== "skip") onCameraHandled?.();
  }, [camera, onCameraHandled, ready, visiblePools]);

  useEffect(() => {
    if (!ready || isPreview) return;
    let live = true;
    getMyLocationSilent().then((location) => {
      if (live && location) showMeAt(location.lat, location.lng);
    });
    return () => {
      live = false;
    };
  }, [isPreview, ready, showMeAt]);

  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (previewLat == null || previewLng == null || previewLevel == null || !kakao || !map) return;
    const position = new kakao.maps.LatLng(previewLat, previewLng);
    map.setCenter(position);
    map.setLevel(previewLevel);
    previewMarkerRef.current?.setPosition(position);
  }, [previewLat, previewLng, previewLevel, ready]);

  const locateMe = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const location = await getMyLocation();
      showMeAt(location.lat, location.lng);
    } catch {
      setError("위치를 가져오지 못했어요. 위치 권한을 확인해 주세요.");
    } finally {
      setLocating(false);
    }
  }, [showMeAt]);

  return { ready, error, locating, locateMe };
}
