// DB 에 기록한 자유수영 시각이 "저장된 근거 중 어디엔가" 실제로 있는지 검사한다.
// 근거의 1순위는 저장된 본문 텍스트(page-text.txt)다. 스크린샷은 본문에 값이 없을 때만 의미가 있다
// (JS 렌더링 페이지, 시간표가 이미지로만 게시된 경우). 그래서 근거 종류를 구분해서 판정한다.
// 사용: set -a; source .env; set +a; BUNDLE=evidence/new-candidates DAY=2026-09-10 node scripts/verify-evidence-coverage.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const BUNDLE = process.env.BUNDLE ?? "evidence/new-candidates";
const DAY = process.env.DAY ?? new Date().toISOString().slice(0, 10);

const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const rows = (await c.query("select id,name,free_swim from pools")).rows;
await c.end();
const byId = new Map(rows.map((r) => [r.id, r]));

// 전각 콜론/물결까지 정규화해서 비교한다
const norm = (s) => String(s).replace(/[：]/g, ":").replace(/[～∼〜－]/g, "~");
const readIf = (p) => (fs.existsSync(p) ? norm(fs.readFileSync(p, "utf8")) : "");

const report = [];
for (const slug of fs.readdirSync(BUNDLE)) {
  const dir = path.join(BUNDLE, slug, DAY);
  const mp = path.join(dir, "manifest.json");
  if (!fs.existsSync(mp)) continue;
  const m = JSON.parse(fs.readFileSync(mp, "utf8"));
  const pool = m.poolId ? byId.get(m.poolId) : null;
  if (!pool) continue;

  const claimed = new Set();
  for (const d of pool.free_swim ?? []) for (const s of d.sessions ?? []) { claimed.add(s.start); claimed.add(s.end); }

  // 근거 후보를 종류별로 모은다
  const sources = { "본문텍스트": readIf(path.join(dir, "page-text.txt")) };
  const shotDir = path.join(dir, "screenshot");
  if (fs.existsSync(shotDir)) {
    let ocr = "";
    for (const f of fs.readdirSync(shotDir).filter((x) => x.endsWith(".txt"))) ocr += "\n" + readIf(path.join(shotDir, f));
    if (ocr.trim()) sources["스크린샷OCR"] = ocr;
  }
  // 육안 확인: OCR 이 못 읽는 격자형 표 등은 사람이 이미지에서 직접 읽고 기록한다.
  // 자동 추출이 아니므로 확인자·근거 파일·사유를 manifest.visualVerification 에 반드시 남긴다.
  if (m.visualVerification?.confirmed?.length) {
    if (!m.visualVerification.files?.length || !m.visualVerification.note)
      console.warn(`  경고 ${m.name}: visualVerification 에 files/note 가 없어 근거로 인정하지 않음`);
    else sources["육안확인"] = m.visualVerification.confirmed.join("\n");
  }
  const ocrDir = path.join(dir, "ocr");
  if (fs.existsSync(ocrDir)) {
    let img = "";
    for (const f of fs.readdirSync(ocrDir).filter((x) => x.endsWith(".txt"))) img += "\n" + readIf(path.join(ocrDir, f));
    if (img.trim()) sources["이미지시간표OCR"] = img;
  }

  const per = {}, covered = new Set();
  for (const [kind, text] of Object.entries(sources)) {
    const hit = [...claimed].filter((t) => text.includes(t));
    per[kind] = hit.length;
    for (const t of hit) covered.add(t);
  }
  const missing = [...claimed].filter((t) => !covered.has(t)).sort();
  // 어떤 근거 종류가 실제로 값을 담고 있었는지
  const primary = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
  const verdict = claimed.size === 0 ? "시간없음" : missing.length === 0 ? "근거완비" : covered.size ? "일부누락" : "근거없음";

  m.evidenceCoverage = { checkedAt: new Date().toISOString(), claimed: claimed.size,
    bySource: per, coveredBy: primary?.[0] ?? null, missingTimes: missing, verdict };
  fs.writeFileSync(mp, JSON.stringify(m, null, 1));
  report.push({ name: m.name, verdict, claimed: claimed.size, per, missing });
}

const w = (s, n) => String(s).padEnd(n);
console.log(`${w("시설", 26)}${w("판정", 9)}${w("DB시각", 7)}본문 /스크린샷/이미지/육안   누락`);
for (const r of report.sort((a, b) => a.verdict.localeCompare(b.verdict))) {
  console.log(`${w(r.name, 26)}${w(r.verdict, 9)}${w(r.claimed, 7)}${w(r.per["본문텍스트"] ?? "-", 5)}${w(r.per["스크린샷OCR"] ?? "-", 11)}${w(r.per["이미지시간표OCR"] ?? "-", 7)}${w(r.per["육안확인"] ?? "-", 7)}${r.missing.join(", ")}`);
}
const bad = report.filter((r) => r.verdict === "근거없음" || r.verdict === "일부누락");
console.log(`\n번들 ${report.length} | 근거완비 ${report.filter(r=>r.verdict==="근거완비").length} | 일부누락 ${report.filter(r=>r.verdict==="일부누락").length} | 근거없음 ${report.filter(r=>r.verdict==="근거없음").length}`);
console.log(`\n스크린샷이 유일한 근거였던 곳: ${report.filter(r=>(r.per["본문텍스트"]??0)===0 && (r.per["스크린샷OCR"]??0)>0).map(r=>r.name).join(", ") || "없음"}`);
process.exit(bad.length ? 1 : 0);
