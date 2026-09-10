import { useCallback, useEffect, useRef, useState } from "react";
import { Clipboard } from "@apps-in-toss/web-framework";
import { color } from "../design/tokens";

// 주소를 클립보드에 복사한다.
// 토스 앱 안에서는 SDK Clipboard.setText(권한: clipboard/write)를 쓰고,
// 일반 브라우저(로컬 개발·웹 프리뷰)에서는 navigator.clipboard로 떨어진다.
async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setText(text);
    return true;
  } catch {
    // 토스 브리지가 없거나(일반 브라우저) 권한이 거부된 경우 — 아래 브라우저 경로로 한 번 더 시도한다.
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function CopyAddressButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = useCallback(async () => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "주소 복사됨" : "주소 복사"}
      style={{
        border: "none",
        background: "none",
        // 터치 영역은 넉넉히(44px 권장) 주되 바깥 여백은 음수로 상쇄해 글줄이 벌어지지 않게 한다.
        padding: 10,
        margin: -10,
        marginLeft: -2,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
        color: copied ? color.textSub : color.textMuted,
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="9.5" height="9.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M13 4.5H6A2.5 2.5 0 0 0 3.5 7v7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
