import { useEffect, useRef, useState } from "react";
import { color, radius, space } from "../design/tokens";

export type Suggestion = {
  id: string;
  icon?: string;
  label: string;
  hint?: string; // 오른쪽 회색 보조 텍스트 (예: 지역/구 이름)
  onPick: () => void;
};

// 통합 검색바 — 통통한 입력 + 포커스 시 추천 드롭다운(지역명/수영장). 홈·지도 공용.
// 커밋 기반: 타이핑 중엔 추천만 갱신하고, 목록/지도는 '이동'(엔터/키보드 검색) 또는 추천 선택 때만 바뀐다.
// onChange = 라이브 입력(추천·표시용), onSubmit = 확정(목록/지도 반영).
export default function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder = "지역이나 수영장 이름으로 검색",
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void; // 라이브: 추천/입력 표시용 (목록·지도는 안 바뀜)
  onSubmit?: (text: string) => void; // 확정: 엔터/키보드 '이동' → 목록·지도 반영
  placeholder?: string;
  suggestions: Suggestion[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value); // 화면에 즉시 반영되는 로컬 값
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false); // 한글 IME 조합 중 여부

  // 외부에서 value가 바뀌면(추천 선택·지우기·위치조회) 로컬 값 동기화.
  useEffect(() => setText(value), [value]);

  // 바깥(지도 포함) 클릭 시 닫기. 카카오 지도가 blur를 막아서 document 레벨에서 감지.
  useEffect(() => {
    if (!open) return;
    function onDown(e: Event) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function submit() {
    setOpen(false);
    inputRef.current?.blur();
    composingRef.current = false;
    onSubmit?.(text);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 52,
          background: color.bg,
          borderRadius: radius.md,
          boxShadow: "0 2px 10px rgba(0,0,0,.10)",
          padding: `0 ${space.lg}px`,
        }}
      >
        <span style={{ fontSize: 18, opacity: 0.5 }}>🔍</span>
        <input
          ref={inputRef}
          value={text}
          enterKeyHint="search"
          onChange={(e) => {
            const v = e.target.value;
            setText(v); // 즉시 표시
            if (!composingRef.current) onChange(v); // 라이브(추천용). 목록/지도는 안 바뀜
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onChange(e.currentTarget.value); // 조합 확정된 최종 글자로 추천 갱신
          }}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          // 엔터/키보드 '이동' → 확정(목록·지도 반영). 조합 중엔 무시.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !composingRef.current) {
              e.preventDefault();
              submit();
            }
          }}
          // 항목 클릭(onMouseDown)이 먼저 처리되도록 blur 닫기를 살짝 지연
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 16,
            color: color.textStrong,
          }}
        />
        {text && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setText("");
              onChange("");
              onSubmit?.(""); // 지우기도 확정 → 목록/지도 초기화
            }}
            aria-label="지우기"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 16,
              color: color.textMuted,
              width: 40,
              height: 40,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: -8, // 컨테이너 오른쪽 여백 상쇄
            }}
          >
            ✕
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: color.bg,
            borderRadius: radius.md,
            boxShadow: "0 8px 24px rgba(0,0,0,.15)",
            overflow: "hidden",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.id}
              onMouseDown={(e) => {
                e.preventDefault(); // input blur 전에 실행
                inputRef.current?.blur(); // IME 조합 확정 → 잔여 글자('구서울…') 방지
                composingRef.current = false;
                s.onPick();
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {s.icon && <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 15,
                  color: color.textStrong,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.label}
              </span>
              {s.hint && <span style={{ fontSize: 12, color: color.textMuted, flexShrink: 0 }}>{s.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
