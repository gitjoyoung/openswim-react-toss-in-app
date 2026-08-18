import { useEffect, useMemo, useRef, useState } from "react";
import type { Pool } from "../pool";
import { EmptyState } from "../design/primitives";
import SearchBox, { type Suggestion } from "../components/SearchBox";
import { loadKakao, type Kakao } from "../lib/kakaoMap";
import { getMyLocation, getMyLocationSilent } from "../lib/geo";
import { operatingDaysLabel, markerState, images, prices, wonText, formatPrice } from "../lib/pools";
import { isHoliday, holidayName } from "../lib/holidays";
import { matchPool, distinctRegions, matchRegion, regionLabel, inRegion, DEFAULT_GU_CENTER, type Region } from "../lib/search";
import { brand, color, radius, space, dayColor, TAB_BAR_RESERVE } from "../design/tokens";
import CrosshairIcon from "../components/CrosshairIcon";
import freeImg from "../assets/free.webp"; // 사진 없는 곳 기본 이미지
type Props = { pools: Pool[]; onSelect: (p: Pool) => void };

// 기본 지도 뷰 = 금천구 중심 + 구 단위 줌 (검색·위치 없을 때 디폴트).
const DEFAULT_CENTER = DEFAULT_GU_CENTER;
const DEFAULT_LEVEL = 6;

// 오늘 운영=파랑, 휴무=빨강 (마커·오버레이 배지·범례)
const OPEN = "#3182f6";
const CLOSED = "#f04452";
const UNKNOWN = "#f5a623"; // 자유수영 시간표 미확보(노랑) — 닫힘이 아니라 정보 없음

// innerHTML 삽입 값 이스케이프 — 이름/가격에 특수문자 있어도 카드가 안 깨지게.
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

// 홈 리스트와 동일한 달력 컬러 규칙(dayColor): 평일=검정, 토요일=파랑, 일요일=빨강. 나머지는 상속.
function daysHtml(text: string) {
  return text
    .split(/(평일|토요일|일요일)/)
    .map((seg) =>
      seg === "평일"
        ? `<span style="color:${dayColor.weekday};font-weight:700">평일</span>`
        : seg === "토요일"
          ? `<span style="color:${dayColor.sat};font-weight:700">토요일</span>`
          : seg === "일요일"
            ? `<span style="color:${dayColor.sun};font-weight:700">일요일</span>`
            : esc(seg),
    )
    .join("");
}

// 심플한 핀(테두리 없음) — 작게 찍혀도 색이 바로 보이도록 상태 색으로 꽉 채움.
function pinDataUri(fill: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='36' viewBox='0 0 26 36'><path d='M13 0C5.8 0 0 5.8 0 13c0 9.2 13 23 13 23s13-13.8 13-23C26 5.8 20.2 0 13 0z' fill='${fill}'/><circle cx='13' cy='13' r='4.8' fill='white'/></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

const PIN_W = 26;
const PIN_H = 36;

// 줌 레벨 → 마커 스케일. 카카오 level은 낮을수록 확대라, 멀리 볼수록(level↑) 작아진다.
function markerScale(level: number) {
  return Math.max(0.55, Math.min(1.1, 1 - (level - 5) * 0.09));
}

// 현재 레벨 크기의 핀 이미지. SVG는 MarkerImage size로 스케일되므로 크기만 바꾸면 됨.
function markerImages(kakao: Kakao, level: number) {
  const scale = markerScale(level);
  const w = Math.round(PIN_W * scale);
  const h = Math.round(PIN_H * scale);
  const size = new kakao.maps.Size(w, h);
  const anchor = { offset: new kakao.maps.Point(Math.round(w / 2), h) };
  return {
    open: new kakao.maps.MarkerImage(pinDataUri(OPEN), size, anchor),
    closed: new kakao.maps.MarkerImage(pinDataUri(CLOSED), size, anchor),
    unknown: new kakao.maps.MarkerImage(pinDataUri(UNKNOWN), size, anchor),
  };
}

export default function NearbyScreen({ pools, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<Kakao>(null);
  const mapRef = useRef<Kakao>(null);
  const markersRef = useRef<Kakao[]>([]);
  const overlayRef = useRef<Kakao>(null);
  const meRef = useRef<Kakao>(null);

  const [query, setQuery] = useState(""); // 입력창 표시 + 추천용 (라이브)
  const [appliedText, setAppliedText] = useState(""); // 확정된 텍스트 검색 (마커 필터)
  const [region, setRegion] = useState<Region | null>(null); // 확정된 지역 필터
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const cameraRef = useRef<"default" | "fit" | "skip">("default"); // 다음 마커 렌더 때 지도 카메라 처리

  // 타이핑 중엔 추천만 갱신 (마커·지도는 그대로). 실제 필터는 커밋(엔터/추천/지우기) 때만.
  const onQueryChange = (v: string) => setQuery(v);

  // 확정: 지역 우선 → 없으면 이름(텍스트) 검색. (홈과 동일 규칙)
  const onSearchSubmit = (text: string) => {
    const s = text.trim();
    if (!s) {
      cameraRef.current = "default";
      setRegion(null);
      setAppliedText("");
      setQuery("");
      return;
    }
    cameraRef.current = "fit";
    const r = distinctRegions(pools).find((rg) => matchRegion(rg, s)); // 지역 먼저
    if (r) {
      setRegion(r);
      setAppliedText("");
      setQuery(regionLabel(r));
    } else {
      setRegion(null);
      setAppliedText(s);
      setQuery(s);
    }
  };

  // 지도 1회 초기화
  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((kakao) => {
        // 중복 생성 방지(StrictMode/HMR): 이미 지도가 있으면 skip, 컨테이너 잔상 제거
        if (cancelled || !boxRef.current || mapRef.current) return;
        boxRef.current.innerHTML = "";
        kakaoRef.current = kakao;
        mapRef.current = new kakao.maps.Map(boxRef.current, {
          center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          level: DEFAULT_LEVEL,
        });
        // 지도 빈 곳 누르면 정보 오버레이 닫기
        kakao.maps.event.addListener(mapRef.current, "click", () => overlayRef.current?.setMap(null));
        // 줌 변경 시 마커 크기 재조정 (멀리서 볼수록 작게)
        kakao.maps.event.addListener(mapRef.current, "zoom_changed", () => {
          // 줌 중엔 카드-마커가 어긋나므로 열려있으면 닫는다.
          overlayRef.current?.setMap(null);
          overlayRef.current = null;
          const imgs = markerImages(kakao, mapRef.current.getLevel());
          markersRef.current.forEach(({ marker, state }) =>
            marker.setImage(imgs[state as keyof typeof imgs]),
          );
        });
        setReady(true);
      })
      .catch((e) => !cancelled && setErr(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // pools/검색어 변할 때 마커 갱신
  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map) return;

    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    markersRef.current = [];
    overlayRef.current?.setMap(null);

    // 마커는 전부 표시 — 검색해도 주변 수영장까지 보이게(개수가 많지 않으니).
    const list = pools.filter((p) => p.lat != null && p.lng != null);

    // 현재 줌 레벨에 맞는 크기의 핀. 운영=파랑, 휴무=빨강.
    const imgs = markerImages(kakao, map.getLevel());

    list.forEach((p) => {
      const state = markerState(p);
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const marker = new kakao.maps.Marker({
        position: pos,
        map,
        title: p.name,
        image: imgs[state],
      });
      kakao.maps.event.addListener(marker, "click", () => showInfo(p, pos));
      markersRef.current.push({ marker, state });
    });

    // 카메라 이동 대상: 검색한 지역(구)/텍스트에 해당하는 곳만. 마커는 전부 두고 지도만 그쪽으로.
    const focus = region
      ? list.filter((p) => inRegion(p, region))
      : appliedText.trim()
        ? list.filter((p) => matchPool(p, appliedText))
        : [];

    // 커밋 검색이면 해당 지역으로 이동(fit), 초기/지우기면 서울 기준(default),
    // 위치조회처럼 스스로 이동한 경우엔 안 건드림(skip). 매 렌더 1회 소비.
    const cam = cameraRef.current;
    cameraRef.current = "skip";
    if (cam === "default") {
      map.setCenter(new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
      map.setLevel(DEFAULT_LEVEL);
    } else if (cam === "fit" && focus.length) {
      if (focus.length === 1) {
        map.setCenter(new kakao.maps.LatLng(focus[0].lat, focus[0].lng));
        if (map.getLevel() > 6 || map.getLevel() < 4) map.setLevel(5); // 동네 단위로
      } else {
        const b = new kakao.maps.LatLngBounds();
        focus.forEach((p) => b.extend(new kakao.maps.LatLng(p.lat, p.lng)));
        map.setBounds(b);
        if (map.getLevel() < 4) map.setLevel(4); // 붙어있어도 건물 레벨까진 안 당기게
      }
    }
    // showInfo는 매 렌더 재생성되므로 deps 제외(포함 시 마커가 매번 다시 그려짐)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools, appliedText, region, ready]);

  // 마커 클릭 → 정보 오버레이(바로 이동 X, "상세 보기" 눌러야 이동)
  function showInfo(p: Pool, pos: Kakao) {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    overlayRef.current?.setMap(null);

    const state = markerState(p);
    const hol = isHoliday();
    const badge =
      state === "open"
        ? { color: OPEN, label: hol ? "공휴일 운영" : "오늘 운영" }
        : state === "closed"
          ? { color: CLOSED, label: hol ? "공휴일 휴무" : "오늘 휴무" }
          : { color: UNKNOWN, label: hol ? "공휴일 운영 정보 없음" : "자유수영 정보 없음" };
    const pic = images(p)[0] ?? freeImg;
    // 지역구 대신 가격 — 요금 티어 있으면 최저가~, 없으면 기존 포맷
    const tiers = prices(p);
    const priceText = tiers.length
      ? wonText(Math.min(...tiers.map((t) => t.amount))) + (tiers.length > 1 ? "~" : "")
      : formatPrice(p);
    const line = `font-size:12px;color:${color.textMuted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    // 카드 끝(스페이서 하단)이 마커 끝점(pos)에 오도록 yAnchor:1.
    // 카드 아래 말꼬리 + 현재 마커 높이만큼 스페이서 → 줌으로 마커 크기가 변해도 항상 머리 위에 붙음.
    const mh = Math.round(PIN_H * markerScale(map.getLevel()));
    const now = new Date();
    const WD = ["일", "월", "화", "수", "목", "금", "토"];
    const hName = holidayName(now);
    const todayText = `${now.getMonth() + 1}월 ${now.getDate()}일 (${WD[now.getDay()]})${hName ? ` · ${hName}` : ""}`;
    const el = document.createElement("div");
    el.innerHTML = `
      <div style="min-width:200px;max-width:280px;padding:12px 14px;border-radius:14px;background:${color.bg};box-shadow:0 6px 22px rgba(0,0,0,.20)">
        <div style="display:flex;gap:12px;align-items:flex-start">
          ${pic ? `<img src="${esc(pic)}" alt="" style="flex-shrink:0;width:56px;height:56px;border-radius:10px;object-fit:cover" />` : ""}
          <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
            <span style="display:flex;align-items:center;gap:6px">
              <span style="padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;background:${badge.color}22;color:${badge.color}">${badge.label}</span>
              <span style="font-size:11px;color:${color.textFaint}">${todayText}</span>
            </span>
            <span style="font-weight:700;font-size:15px;color:${color.textStrong};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</span>
            <span style="${line}">${daysHtml(operatingDaysLabel(p))}</span>
            <span style="font-size:13px;font-weight:700;color:${color.textStrong}">${esc(priceText)}</span>
          </div>
        </div>
        <button type="button" style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:10px;background:${brand.main};color:#fff;font-weight:700;font-size:13px;cursor:pointer">상세 보기</button>
      </div>
      <div style="width:0;height:0;margin:0 auto;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid ${color.bg};filter:drop-shadow(0 4px 2px rgba(0,0,0,.10))"></div>
      <div style="height:${mh}px"></div>
    `;
    el.querySelector("button")!.addEventListener("click", () => onSelect(p));

    const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, clickable: true });
    overlay.setMap(map);
    overlayRef.current = overlay;
    map.panTo(pos);
  }

  // 내 위치(파란 점) 표시 + 그쪽으로 이동. 검색과 배타라 검색 상태도 해제, 카메라는 내 위치 유지.
  function showMeAt(lat: number, lng: number) {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map) return;
    const pos = new kakao.maps.LatLng(lat, lng);
    meRef.current?.setMap(null);
    meRef.current = new kakao.maps.Marker({
      position: pos,
      map,
      image: new kakao.maps.MarkerImage(
        "data:image/svg+xml;base64," +
          btoa(
            `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='11' cy='11' r='7' fill='#3182f6' stroke='white' stroke-width='3'/></svg>`,
          ),
        new kakao.maps.Size(22, 22),
        { offset: new kakao.maps.Point(11, 11) },
      ),
    });
    cameraRef.current = "skip"; // 마커 렌더가 카메라 안 뺏게
    setRegion(null);
    setAppliedText("");
    setQuery("");
    map.setLevel(5);
    map.panTo(pos);
  }

  // 표적 버튼: 권한 요청까지 포함해 내 위치 조회.
  async function locateMe() {
    setLocating(true);
    setErr(null);
    try {
      const { lat, lng } = await getMyLocation();
      showMeAt(lat, lng);
    } catch {
      setErr("위치를 가져오지 못했어요. 위치 권한을 확인해 주세요.");
    } finally {
      setLocating(false);
    }
  }

  // 최초 진입: 권한이 이미 있으면 조용히 내 위치로. 없으면 금천구(디폴트) 유지. (권한창 안 띄움)
  useEffect(() => {
    if (!ready) return;
    let live = true;
    getMyLocationSilent().then((loc) => {
      if (live && loc) showMeAt(loc.lat, loc.lng);
    });
    return () => {
      live = false;
    };
  }, [ready]);

  // 추천: 지역("부산 서구"로 시도까지) → 이름 매치 수영장. 선택 시 검색어로 넣어 마커 필터.
  const suggestions = useMemo<Suggestion[]>(() => {
    const s = query.trim();
    if (!s) return [];
    const regions = distinctRegions(pools)
      .filter((r) => matchRegion(r, s))
      .slice(0, 8)
      .map((r) => {
        const label = regionLabel(r);
        return {
          id: `r:${label}`,
          icon: "📍",
          label,
          hint: "지역",
          onPick: () => {
            cameraRef.current = "fit";
            setRegion(r);
            setAppliedText("");
            setQuery(label);
          },
        };
      });
    // 수영장 추천도 바로 상세로 이동하지 않고 이름으로 마커만 필터링한다.
    const named = pools
      .filter((p) => p.name.includes(s))
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        icon: "🏊",
        label: p.name,
        hint: p.gu,
        onPick: () => {
          cameraRef.current = "fit";
          setRegion(null);
          setAppliedText(p.name);
          setQuery(p.name);
        },
      }));
    return [...regions, ...named];
  }, [pools, query]);

  if (err && !ready) {
    return <EmptyState emoji="🗺️" text={`지도를 불러오지 못했어요. (${err})`} />;
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh", // 지도는 풀블리드 — 플로팅 탭바가 그 위에 뜬다
        marginBottom: `calc(-1 * (${TAB_BAR_RESERVE}))`, // Screen 하단 패딩 상쇄
      }}
    >
      {/* data-allow-zoom: 지도는 확대·축소가 필요한 예외 영역 (앱인토스 체크리스트) */}
      <div ref={boxRef} data-allow-zoom style={{ width: "100%", height: "100%" }} />

      {/* 지도 위 오버레이: 검색바 + 표적 버튼 (홈과 동일 구성). 버튼 → 지도를 현재 위치로 이동 */}
      <div
        style={{
          position: "absolute",
          top: `max(env(safe-area-inset-top), ${space.sm}px)`,
          left: space.md,
          right: space.md,
          display: "flex",
          gap: space.sm,
          pointerEvents: "none",
          zIndex: 1000, // 카카오 지도 내부 레이어보다 위 — 검색 추천 드롭다운이 지도에 안 가리게
        }}
      >
        <div style={{ flex: 1, minWidth: 0, pointerEvents: "auto" }}>
          <SearchBox value={query} onChange={onQueryChange} onSubmit={onSearchSubmit} suggestions={suggestions} />
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

      {/* 범례 — 오른쪽 하단 (플로팅 탭바 위로) */}
      <div
        style={{
          position: "absolute",
          bottom: TAB_BAR_RESERVE, // 플로팅 탭바 바로 위 (탭바 높이+세이프에어리어와 같은 토큰)
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

      {err && ready && (
        <div
          style={{
            position: "absolute",
            bottom: TAB_BAR_RESERVE, // 플로팅 탭바 바로 위 (탭바 높이+세이프에어리어와 같은 토큰)
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
          {err}
        </div>
      )}
    </div>
  );
}
