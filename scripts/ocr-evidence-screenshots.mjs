// 증거 스크린샷을 OCR해서 텍스트로 남기고, DB에 기록한 자유수영 시간이 그 이미지에
// 실제로 보이는지 대조한다. "파일은 있는데 근거가 아닌" 스크린샷을 잡아내는 게 목적이다.
// 사용: set -a; source .env; set +a; BUNDLE=evidence/new-candidates DAY=2026-09-10 node scripts/ocr-evidence-screenshots.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const TESS = process.env.TESSERACT_BIN ?? "/opt/homebrew/bin/tesseract";
const BUNDLE = process.env.BUNDLE ?? "evidence/new-candidates";
const DAY = process.env.DAY ?? new Date().toISOString().slice(0, 10);

const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const rows = (await c.query("select id,name,free_swim,free_swim_confidence from pools")).rows;
await c.end();
const byId = new Map(rows.map((r) => [r.id, r]));

// OCR 텍스트에서 시각 표기를 정규화해 뽑는다. 전각 물결·OCR이 흔히 틀리는 콜론 변형까지 포함.
const timesIn = (s) =>
  new Set([...String(s).matchAll(/(\d{1,2})\s*[:;.]\s*(\d{2})/g)]
    .map((m) => `${m[1].padStart(2, "0")}:${m[2]}`));

let bundles = 0, shots = 0, matched = 0, unmatched = [];
for (const slug of fs.readdirSync(BUNDLE)) {
  const dir = path.join(BUNDLE, slug, DAY);
  const shotDir = path.join(dir, "screenshot");
  if (!fs.existsSync(shotDir)) continue;
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pool = manifest.poolId ? byId.get(manifest.poolId) : null;

  // DB에 기록된 자유수영 시각 집합
  const claimed = new Set();
  for (const d of pool?.free_swim ?? []) for (const s of d.sessions ?? []) { claimed.add(s.start); claimed.add(s.end); }

  const ocrAll = new Set();
  const perShot = [];
  for (const f of fs.readdirSync(shotDir).filter((x) => x.endsWith(".png"))) {
    const src = path.join(shotDir, f);
    const txt = src.replace(/\.png$/, ".txt");
    if (!fs.existsSync(txt)) {
      try {
        execFileSync(TESS, [src, txt.replace(/\.txt$/, ""), "-l", "kor+eng", "--psm", "6"], { stdio: "ignore" });
      } catch (e) { perShot.push({ file: f, error: "ocr_failed" }); continue; }
    }
    const t = fs.readFileSync(txt, "utf8");
    const found = timesIn(t);
    for (const x of found) ocrAll.add(x);
    perShot.push({ file: f, ocrFile: path.basename(txt), ocrChars: t.length, timesFound: found.size });
    shots++;
  }

  const hit = [...claimed].filter((x) => ocrAll.has(x));
  const miss = [...claimed].filter((x) => !ocrAll.has(x));
  const verdict = claimed.size === 0 ? "시간없음"
    : miss.length === 0 ? "완전일치"
    : hit.length > 0 ? "부분일치" : "불일치";

  manifest.ocr = { checkedAt: new Date().toISOString(), engine: "tesseract kor+eng",
    shots: perShot, claimedTimes: [...claimed].sort(), matchedTimes: hit.sort(), missingTimes: miss.sort(), verdict };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  bundles++;
  if (verdict === "완전일치") matched++;
  if (verdict === "불일치" || verdict === "부분일치") unmatched.push({ slug, name: manifest.name, verdict, hit: hit.length, miss: miss.length, missingTimes: miss });
  console.log(`${verdict.padEnd(5)} ${manifest.name} | 샷 ${perShot.length} | DB시각 ${claimed.size} | OCR일치 ${hit.length} | 누락 ${miss.length}`);
}
console.log(`\n번들 ${bundles} | 스크린샷 ${shots} | 완전일치 ${matched} | 검토필요 ${unmatched.length}`);
if (unmatched.length) {
  console.log("\n검토 필요:");
  for (const u of unmatched) console.log(`  ${u.name} (${u.verdict}) 누락 시각: ${u.missingTimes.join(", ")}`);
}
