// 공식 페이지에서 시간표로 보이는 이미지를 찾아 원본 해상도로 내려받고 로컬 OCR을 돌린다.
// AI 토큰을 쓰지 않는다. 결과는 증거 폴더에 저장한다.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const TESS = process.env.TESSERACT_BIN ?? "/opt/homebrew/bin/tesseract";
const TARGETS = process.env.TARGETS ?? "tmp/ocr-targets.json";
const OUT = process.env.OUT ?? "tmp/ocr-results.jsonl";
const LIMIT = Number(process.env.LIMIT ?? 20);
const TODAY = "2026-09-02";

const IMG_HINT = /(시간표|자유수영|자유_수영|이용안내|운영시간|프로그램|schedule|time|program|guide|안내)/i;
const SKIP = /(logo|icon|banner|btn|button|arrow|bg_|_bg|nav|footer|header|quick|sns|kakao|facebook|instagram|top_)/i;

function absolute(u, base) {
  if (!u || /^(data:|javascript:|#)/i.test(u.trim())) return null;
  try {
    const x = new URL(u.replaceAll("&amp;", "&").trim(), base);
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch {
    return null;
  }
}

// 저장된 원본 HTML에서 시간표 후보 이미지를 뽑는다. 이미지 주변 텍스트도 함께 본다.
function candidatesFrom(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const tags = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const m of tags) {
    const tag = m[0];
    const src = tag.match(/(?:data-src|data-original|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = absolute(src, baseUrl);
    if (!url || seen.has(url)) continue;
    const alt = tag.match(/alt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    const around = html.slice(Math.max(0, m.index - 400), m.index + 400).replace(/<[^>]+>/g, " ");
    const hay = `${alt} ${url} ${around}`;
    if (SKIP.test(url)) continue;
    let score = 0;
    if (/자유\s*수영/.test(hay)) score += 50;
    if (/시간표/.test(hay)) score += 40;
    if (/이용안내|운영시간|이용시간/.test(hay)) score += 20;
    if (IMG_HINT.test(alt) || IMG_HINT.test(url)) score += 15;
    if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)) score += 5;
    if (score < 20) continue;
    seen.add(url);
    out.push({ url, alt: alt.slice(0, 80), score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

async function download(url, dest) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 5000) return null;
    fs.writeFileSync(dest, buf);
    return { bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function ocr(file) {
  // 작은 이미지는 확대해야 인식률이 오른다.
  const up = file.replace(/\.[^.]+$/, "") + "-up.png";
  try {
    execFileSync("/usr/bin/sips", ["-Z", "2000", file, "--out", up], { stdio: "ignore" });
  } catch {
    fs.copyFileSync(file, up);
  }
  for (const psm of ["6", "4"]) {
    try {
      const text = execFileSync(TESS, [up, "-", "-l", "kor+eng", "--psm", psm], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 10 * 1024 * 1024,
      });
      if (/자유\s*수영|\d{1,2}\s*[:시]\s*\d{2}/.test(text)) return { text, psm };
    } catch {}
  }
  return { text: "", psm: null };
}

const SEP = /(\d{1,2})\s*[:시]\s*(\d{2})\s*[~\-–—～∼〜－]\s*(\d{1,2})\s*[:시]\s*(\d{2})/g;
const pad = (n) => String(n).padStart(2, "0");
function ranges(t) {
  const s = new Set();
  for (const m of t.matchAll(SEP)) {
    if (+m[1] > 23 || +m[3] > 23) continue;
    s.add(`${pad(+m[1])}:${m[2]}-${pad(+m[3])}:${m[4]}`);
  }
  return [...s];
}

const targets = JSON.parse(fs.readFileSync(TARGETS, "utf8"));
let done = new Set();
try {
  for (const l of fs.readFileSync(OUT, "utf8").split("\n")) if (l.trim()) done.add(JSON.parse(l).id);
} catch {}
const queue = targets.filter((t) => !done.has(t.id)).slice(0, LIMIT);
console.log(`대상 ${targets.length} | 완료 ${done.size} | 이번 ${queue.length}`);

let lines = [];
for (const t of queue) {
  const dir = path.join("evidence/pools", t.id, TODAY);
  const htmlDir = path.join(dir, "html");
  const rec = { id: t.id, name: t.name, collectedAt: TODAY };
  if (!fs.existsSync(htmlDir)) {
    lines.push({ ...rec, status: "html-없음" });
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const cands = [];
  for (const p of manifest.pages) {
    const f = path.join(dir, p.file);
    if (!fs.existsSync(f)) continue;
    cands.push(...candidatesFrom(fs.readFileSync(f, "utf8"), p.url));
  }
  const uniq = [...new Map(cands.map((c) => [c.url, c])).values()].sort((a, b) => b.score - a.score).slice(0, 4);
  if (!uniq.length) {
    lines.push({ ...rec, status: "후보 이미지 없음" });
    continue;
  }
  const ocrDir = path.join(dir, "ocr");
  fs.mkdirSync(ocrDir, { recursive: true });
  const results = [];
  for (const [i, c] of uniq.entries()) {
    const ext = (c.url.match(/\.(png|jpe?g|gif|webp)/i)?.[1] ?? "img").toLowerCase();
    const file = path.join(ocrDir, `${i}.${ext}`);
    const dl = await download(c.url, file);
    if (!dl) continue;
    const { text, psm } = ocr(file);
    fs.writeFileSync(path.join(ocrDir, `${i}.txt`), text);
    results.push({ url: c.url, score: c.score, bytes: dl.bytes, sha256: dl.sha256, psm, ranges: ranges(text), mentionsFreeSwim: /자유\s*수영/.test(text) });
  }
  const found = results.filter((r) => r.mentionsFreeSwim && r.ranges.length);
  lines.push({ ...rec, status: "ok", images: results, foundSchedule: found.length > 0, ranges: [...new Set(found.flatMap((f) => f.ranges))] });
  console.log(`${t.name}: 이미지 ${results.length} | 시간표 ${found.length ? "발견" : "없음"}`);
}

let prev = "";
try {
  prev = fs.readFileSync(OUT, "utf8");
} catch {}
fs.writeFileSync(OUT, prev + lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
console.log(`기록 ${lines.length}건 → ${OUT}`);
