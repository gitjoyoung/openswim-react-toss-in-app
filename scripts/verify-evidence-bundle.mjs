// 선언한 규칙을 강제하는 게이트. 위반이 있으면 exit 1.
// 사용: set -a; source .env; set +a; node scripts/verify-evidence-bundle.mjs [--bundle evidence/new-candidates] [--day 2026-09-10]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const BUNDLE = arg("--bundle", "evidence/new-candidates");
const DAY = arg("--day", new Date().toISOString().slice(0, 10));

const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const pools = (await c.query("select id,name,free_swim,free_swim_source,free_swim_source_type,free_swim_verified_at,free_swim_confidence,free_swim_note from pools")).rows;
await c.end();
const byId = new Map(pools.map((p) => [p.id, p]));

const violations = [];
const V = (rule, subject, detail) => violations.push({ rule, subject, detail });

// ── 규칙 A. provenance: 값이 있으면 출처가 있어야 한다 ─────────────────────
for (const p of pools) {
  const hasTimes = (p.free_swim ?? []).some((d) => (d.sessions ?? []).length > 0);
  if (hasTimes && !p.free_swim_confidence) V("A1 확신도 누락", p.name, "자유수영 값이 있는데 free_swim_confidence 가 NULL");
  if (["high", "medium"].includes(p.free_swim_confidence)) {
    if (!p.free_swim_source) V("A2 출처 누락", p.name, `confidence=${p.free_swim_confidence} 인데 free_swim_source 가 비어 있음`);
    if (!p.free_swim_verified_at) V("A3 확인일 누락", p.name, `confidence=${p.free_swim_confidence} 인데 free_swim_verified_at 이 비어 있음`);
  }
  if (!hasTimes && !p.free_swim_note && ["needs_check", null, undefined].includes(p.free_swim_confidence))
    V("A4 사유 누락", p.name, "자유수영 값이 없는데 free_swim_note 에 사유(공개 자료 없음 / 전화 확인 필요)가 없음");
}

// ── 규칙 B. 증거번들 구성요소 ────────────────────────────────────────────
const slugs = fs.existsSync(BUNDLE) ? fs.readdirSync(BUNDLE).filter((s) => fs.statSync(path.join(BUNDLE, s)).isDirectory()) : [];
const checked = [];
for (const slug of slugs) {
  const dir = path.join(BUNDLE, slug, DAY);
  if (!fs.existsSync(dir)) continue;
  const mp = path.join(dir, "manifest.json");
  if (!fs.existsSync(mp)) { V("B1 manifest 없음", slug, dir); continue; }
  const m = JSON.parse(fs.readFileSync(mp, "utf8"));
  const label = m.name ?? slug;
  checked.push(label);

  if (!fs.existsSync(path.join(dir, "page-text.txt"))) V("B2 본문 텍스트 없음", label, dir);
  const htmlDir = path.join(dir, "html");
  if (!fs.existsSync(htmlDir) || fs.readdirSync(htmlDir).length === 0) V("B3 원본 HTML 없음", label, dir);
  const shotDir = path.join(dir, "screenshot");
  const shots = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => f.endsWith(".png")) : [];
  // 스크린샷 유무 자체는 규칙이 아니다. 본문에 근거가 있으면 안 찍어도 된다(규칙 C 참조).


  // 저장된 HTML 이 manifest 해시와 일치하는가 (사후 변조/불일치 탐지)
  for (const pg of m.pages ?? []) {
    if (!pg.file || !pg.sha256) continue;
    const f = path.join(dir, pg.file);
    if (!fs.existsSync(f)) { V("B6 HTML 파일 유실", label, pg.file); continue; }
    const h = crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    if (h !== pg.sha256) V("B7 HTML 해시 불일치", label, `${pg.file} manifest=${pg.sha256.slice(0, 12)} 실제=${h.slice(0, 12)}`);
    if (pg.tlsVerified === undefined) V("B8 TLS 기록 없음", label, `${pg.url} 에 tlsVerified 기록이 없음`);
  }

  // ── 규칙 C. DB 값이 저장된 근거 중 어딘가에 실제로 있는가 ───────────────
  // 근거 1순위는 저장된 본문 텍스트다. 스크린샷은 본문에 값이 없을 때만 의미가 있다.
  const pool = m.poolId ? byId.get(m.poolId) : null;
  if (m.poolId && !pool) V("C4 poolId 불일치", label, `${m.poolId} 가 DB 에 없음`);
  if (!m.evidenceCoverage) { V("C1 근거 대조 안 함", label, "manifest.evidenceCoverage 없음. scripts/verify-evidence-coverage.mjs 를 돌려야 함"); continue; }
  const cov = m.evidenceCoverage;
  if (cov.verdict === "근거없음") V("C5 근거 없음", label, `DB 시각 ${cov.claimed}개가 저장된 어느 근거에도 없음. 누락: ${cov.missingTimes.join(", ")}`);
  else if (cov.verdict === "일부누락") V("C6 근거 일부 누락", label, `누락 시각: ${cov.missingTimes.join(", ")}`);
  // 본문에 값이 없어 스크린샷이 유일한 근거인 경우에만 렌더링 근거와 OCR 텍스트를 요구한다
  const textOnly = (cov.bySource?.["본문텍스트"] ?? 0) === 0 && cov.claimed > 0;
  if (textOnly) {
    if (shots.length === 0) V("C2 렌더링 근거 없음", label, "저장된 본문에 값이 없는데 스크린샷도 없음(JS 렌더링 페이지로 추정)");
    const ocrTxt = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => f.endsWith(".txt")).length : 0;
    if (shots.length > 0 && ocrTxt === 0) V("C3 OCR 텍스트 없음", label, "스크린샷이 유일한 근거인데 OCR 텍스트가 없음");
  }
}

// ── 규칙 D. DB 에 쓴 신규 시설은 반드시 번들이 있어야 한다 ─────────────────
const bundlePoolIds = new Set(slugs.map((s) => {
  const mp = path.join(BUNDLE, s, DAY, "manifest.json");
  return fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, "utf8")).poolId : null;
}).filter(Boolean));
const progressFile = "docs/data/worksplit/progress-B.jsonl";
if (fs.existsSync(progressFile)) {
  for (const line of fs.readFileSync(progressFile, "utf8").trim().split("\n")) {
    const r = JSON.parse(line);
    if (r.verdict === "register" && r.new_id && !bundlePoolIds.has(r.new_id))
      V("D1 등록했는데 번들 없음", r.name, r.new_id);
  }
}

// ── 결과 ────────────────────────────────────────────────────────────────
const byRule = {};
for (const v of violations) (byRule[v.rule] ??= []).push(v);
console.log(`검사 대상 번들 ${checked.length}건 / DB ${pools.length}행 (${BUNDLE}, ${DAY})\n`);
if (!violations.length) { console.log("위반 없음."); process.exit(0); }
for (const [rule, list] of Object.entries(byRule)) {
  console.log(`[${rule}] ${list.length}건`);
  for (const v of list.slice(0, 12)) console.log(`   - ${v.subject}: ${v.detail}`);
  if (list.length > 12) console.log(`   ... 외 ${list.length - 12}건`);
}
console.log(`\n총 위반 ${violations.length}건`);
fs.writeFileSync("docs/data/evidence-verification.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), bundle: BUNDLE, day: DAY, total: violations.length, violations }, null, 1));
process.exit(1);
