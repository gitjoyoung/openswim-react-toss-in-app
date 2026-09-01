import { useCallback, useRef } from "react";
import type { Pool } from "../pool";
import { EmptyState } from "../design/primitives";
import SearchBox from "../components/SearchBox";
import { operatingDaysLabel, markerState, images, prices, wonText, formatPrice } from "../lib/pools";
import { isHoliday, holidayName } from "../lib/holidays";
import { brand, color, radius, space, dayColor, TAB_BAR_RESERVE } from "../design/tokens";
import CrosshairIcon from "../components/CrosshairIcon";
import freeImg from "../assets/free.webp";
import { useNearbySearch } from "../hooks/useNearbySearch";
import { usePoolMap } from "../hooks/usePoolMap";

type Props = { pools: Pool[]; onSelect: (p: Pool) => void };

const OPEN = "#3182f6";
const CLOSED = "#f04452";
const UNKNOWN = "#f5a623";
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

function daysHtml(text: string) {
  return text
    .split(/(평일|토요일|일요일)/)
    .map((segment) =>
      segment === "평일"
        ? `<span style="color:${dayColor.weekday};font-weight:700">평일</span>`
        : segment === "토요일"
          ? `<span style="color:${dayColor.sat};font-weight:700">토요일</span>`
          : segment === "일요일"
            ? `<span style="color:${dayColor.sun};font-weight:700">일요일</span>`
            : esc(segment),
    )
    .join("");
}

function pinDataUri(fill: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='36' viewBox='0 0 26 36'><path d='M13 0C5.8 0 0 5.8 0 13c0 9.2 13 23 13 23s13-13.8 13-23C26 5.8 20.2 0 13 0z' fill='${fill}'/><circle cx='13' cy='13' r='4.8' fill='white'/></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

export default function NearbyScreen({ pools, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { q, camera, suggestions, visiblePools, setQuery, submitSearch, clearForLocation, markCameraHandled } =
    useNearbySearch(pools);

  const renderMarkerInfo = useCallback(
    (pool: Pool, markerHeight: number) => {
      const state = markerState(pool);
      const holiday = isHoliday();
      const badge =
        state === "open"
          ? { color: OPEN, label: holiday ? "공휴일 운영" : "오늘 운영" }
          : state === "closed"
            ? { color: CLOSED, label: holiday ? "공휴일 휴무" : "오늘 휴무" }
            : { color: UNKNOWN, label: holiday ? "공휴일 운영 정보 없음" : "자유수영 정보 없음" };
      const pic = images(pool)[0] ?? freeImg;
      const tiers = prices(pool);
      const priceText = tiers.length
        ? wonText(Math.min(...tiers.map((tier) => tier.amount))) + (tiers.length > 1 ? "~" : "")
        : formatPrice(pool);
      const line = `font-size:12px;color:${color.textMuted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
      const now = new Date();
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const holidayNameText = holidayName(now);
      const todayText = `${now.getMonth() + 1}월 ${now.getDate()}일 (${weekdays[now.getDay()]})${holidayNameText ? `  ${holidayNameText}` : ""}`;
      const element = document.createElement("div");
      element.innerHTML = `
        <div style="min-width:200px;max-width:280px;padding:12px 14px;border-radius:14px;background:${color.bg};box-shadow:0 6px 22px rgba(0,0,0,.20)">
          <div style="display:flex;gap:12px;align-items:flex-start">
            ${pic ? `<img src="${esc(pic)}" alt="" style="flex-shrink:0;width:56px;height:56px;border-radius:10px;object-fit:cover" />` : ""}
            <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;background:${badge.color}22;color:${badge.color}">${badge.label}</span>
                <span style="font-size:11px;color:${color.textFaint}">${todayText}</span>
              </span>
              <span style="font-weight:700;font-size:15px;color:${color.textStrong};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pool.name)}</span>
              <span style="${line}">${daysHtml(operatingDaysLabel(pool))}</span>
              <span style="font-size:13px;font-weight:700;color:${color.textStrong}">${esc(priceText)}</span>
            </div>
          </div>
          <button type="button" style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:10px;background:${brand.main};color:#fff;font-weight:700;font-size:13px;cursor:pointer">상세 보기</button>
        </div>
        <div style="width:0;height:0;margin:0 auto;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid ${color.bg};filter:drop-shadow(0 4px 2px rgba(0,0,0,.10))"></div>
        <div style="height:${markerHeight}px"></div>
      `;
      element.querySelector("button")!.addEventListener("click", () => onSelect(pool));
      return element;
    },
    [onSelect],
  );

  const { ready, error, locating, locateMe } = usePoolMap({
    containerRef: boxRef,
    pools,
    visiblePools,
    camera,
    onCameraHandled: markCameraHandled,
    onMarkerSelect: renderMarkerInfo,
    onLocation: clearForLocation,
  });

  if (error && !ready) return <EmptyState emoji="🗺️" text={`지도를 불러오지 못했어요. (${error})`} />;

  return (
    <div style={{ position: "relative", height: "100dvh", marginBottom: `calc(-1 * (${TAB_BAR_RESERVE}))` }}>
      <div ref={boxRef} data-allow-zoom style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          top: `max(env(safe-area-inset-top), ${space.sm}px)`,
          left: space.md,
          right: space.md,
          display: "flex",
          gap: space.sm,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, pointerEvents: "auto" }}>
          <SearchBox value={q} onChange={setQuery} onSubmit={submitSearch} suggestions={suggestions} />
        </div>
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-label="현재 위치로 이동"
          style={{
            pointerEvents: "auto",
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: radius.md,
            border: "none",
            background: color.bg,
            boxShadow: "0 2px 10px rgba(0,0,0,.10)",
            color: brand.main,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: locating ? 0.6 : 1,
          }}
        >
          <CrosshairIcon />
        </button>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: TAB_BAR_RESERVE,
          right: space.md,
          display: "flex",
          gap: space.md,
          padding: "7px 12px",
          borderRadius: radius.pill,
          background: color.bg,
          boxShadow: "0 4px 14px rgba(0,0,0,.15)",
          fontSize: 12,
          fontWeight: 600,
          color: color.textSub,
          zIndex: 10,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <img src={pinDataUri(OPEN)} alt="" style={{ width: 13, height: 18 }} /> 오늘 운영
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <img src={pinDataUri(CLOSED)} alt="" style={{ width: 13, height: 18 }} /> 휴무
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <img src={pinDataUri(UNKNOWN)} alt="" style={{ width: 13, height: 18 }} /> 정보 미확인
        </span>
      </div>
      {error && ready && (
        <div
          style={{
            position: "absolute",
            bottom: TAB_BAR_RESERVE,
            left: space.md,
            right: space.md,
            padding: "10px 14px",
            borderRadius: radius.md,
            background: color.bg,
            boxShadow: "0 4px 14px rgba(0,0,0,.15)",
            fontSize: 13,
            color: color.textSub,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
