// DB 정합성 정리 + 중복 병합. 삭제 전 백업하고, 트랜잭션으로 실행한다.
// 사용: set -a; source .env; set +a; node scripts/cleanup-db.mjs [--write]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve("./.manus/neon-migration/node_modules/pg"));
const WRITE = process.argv.includes("--write");

const c = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const rows = (await c.query("select * from pools")).rows;
const byId = new Map(rows.map((r) => [r.id, r]));

const plans = { phone: [], gu: [], address: [], fieldFix: [], merge: [], del: [], scheduleConflict: [] };

// ── 1. 전화번호 형식 정규화 ──────────────────────────────────────────
const fixPhone = (p) => {
  if (!p) return null;
  const d = String(p).replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0,4)}-${d.slice(4)}`;
  if (d.startsWith("02") && d.length === 9) return `02-${d.slice(2,5)}-${d.slice(5)}`;
  if (d.startsWith("02") && d.length === 10) return `02-${d.slice(2,6)}-${d.slice(6)}`;
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  return null;
};
for (const r of rows) {
  if (!r.phone) continue;
  if (/^0\d{1,2}-\d{3,4}-\d{4}$/.test(r.phone)) continue;
  const nf = fixPhone(r.phone);
  if (nf && nf !== r.phone) plans.phone.push({ id: r.id, name: r.name, from: r.phone, to: nf });
}

// ── 2. gu 형식 ───────────────────────────────────────────────────
for (const r of rows) {
  if (r.gu === "부천시 소사구") plans.gu.push({ id: r.id, name: r.name, from: r.gu, to: "부천시" });
}

// ── 3. 주소 시도 표기 통일 ────────────────────────────────────────
const renames = [["전라북도","전북특별자치도"],["강원도","강원특별자치도"],["전남광주통합특별시","전라남도"]];
for (const r of rows) {
  let a = r.address;
  if (!a) continue;
  let na = a;
  for (const [from, to] of renames) if (na.startsWith(from)) na = to + na.slice(from.length);
  if (na !== a) plans.address.push({ id: r.id, name: r.name, from: a, to: na });
}

// ── 4. 개별 오류 수정 (웹 확인 완료) ───────────────────────────────
const manual = [
  { name: "삼양반다비체육센터", set: { sido: "제주특별자치도", gu: "제주시",
      address: "제주특별자치도 제주시 원당북로 47 (삼양일동)", phone: "064-756-7330",
      homepage_url: "http://samyangbandabi.kr" },
    why: "제주시 삼양동 시설인데 주소·시도·구가 강일구민체육센터(서울 강동구) 값으로 잘못 들어가 있었다. 좌표(33.53,126.60)는 원래 맞았다." },
  { name: "태백장성국민체육센터", set: { sido: "강원특별자치도", gu: "태백시",
      address: "강원특별자치도 태백시 장성1길 175" },
    why: "태백시시설관리공단 장성국민체육센터인데 sido 가 전라남도, gu 가 장성군으로 잘못 들어가 있었다." },
];
for (const m of manual) {
  const r = rows.find((x) => x.name === m.name);
  if (!r) { console.log(`개별수정 대상 없음: ${m.name}`); continue; }
  plans.fieldFix.push({ id: r.id, name: r.name, set: m.set, why: m.why,
    before: Object.fromEntries(Object.keys(m.set).map((k) => [k, r[k]])) });
}

// ── 5. 수영장이 아닌 행 삭제 ─────────────────────────────────────
for (const r of rows) if (/전기차충전소/.test(r.name))
  plans.del.push({ id: r.id, name: r.name, sido: r.sido, gu: r.gu, why: "수영장 시설이 아님(충전소 레코드)" });

// ── 6. 중복 병합 ────────────────────────────────────────────────
const cls = JSON.parse(fs.readFileSync("docs/data/pool-duplicates-classified.json", "utf8"));
// 태백 그룹은 sido 수정 후 같은 시설이므로 병합 대상에 추가
const extraMerge = cls.reject.filter((g) => g.members.some((m) => m.name === "태백장성국민체육센터"));
const mergeGroups = [...cls.merge, ...extraMerge];
const UNION = ["phone","homepage_url","subway","price_note","address","lat","lng"];
for (const g of mergeGroups) {
  const members = g.members.map((m) => byId.get(m.id)).filter(Boolean);
  if (members.length < 2) continue;
  const scoreOf = (p) => g.members.find((m) => m.id === p.id)?.score ?? 0;
  const slotsOf = (p) => (p.free_swim ?? []).reduce((s, d) => s + (d.sessions?.length ?? 0), 0);
  // 이름에 "수영장"이 들어간 쪽을 선호(앱에서 보이는 이름), 그다음 점수, 그다음 회차 수
  const keeper = [...members].sort((a, b) =>
    (Number(/수영장/.test(b.name)) - Number(/수영장/.test(a.name))) ||
    (scoreOf(b) - scoreOf(a)) || (slotsOf(b) - slotsOf(a)))[0];
  const others = members.filter((m) => m.id !== keeper.id);
  // 자유수영 회차가 크게 다르면 어느 쪽이 맞는지 알 수 없다. 자동 병합하지 않는다.
  const ks = slotsOf(keeper);
  const conflict = others.filter((o) => {
    const os = slotsOf(o);
    if (ks === 0 && os === 0) return false;
    return Math.abs(ks - os) > Math.max(2, Math.max(ks, os) * 0.3);
  });
  if (conflict.length) {
    plans.scheduleConflict.push({ keepName: keeper.name, keepSlots: ks, reasons: g.reasons,
      conflict: conflict.map((o) => ({ name: o.name, slots: slotsOf(o), address: o.address })) });
    continue;
  }
  const fill = {};
  for (const f of UNION) if (keeper[f] == null || keeper[f] === "")
    for (const o of others) if (o[f] != null && o[f] !== "") { fill[f] = o[f]; break; }
  if (keeper.price_free_swim == null) for (const o of others) if (o.price_free_swim != null) { fill.price_free_swim = o.price_free_swim; break; }
  if ((keeper.images ?? []).length === 0) for (const o of others) if ((o.images ?? []).length) { fill.images = o.images; break; }
  plans.merge.push({ keepId: keeper.id, keepName: keeper.name, reasons: g.reasons, why: g.why,
    fill, drop: others.map((o) => ({ id: o.id, name: o.name, address: o.address,
      freeSwimSlots: (o.free_swim ?? []).reduce((s,d)=>s+(d.sessions?.length??0),0), price: o.price_free_swim })) });
}

const dropCount = plans.merge.reduce((s, m) => s + m.drop.length, 0) + plans.del.length;
console.log(`전화형식 ${plans.phone.length} | gu ${plans.gu.length} | 주소표기 ${plans.address.length} | 개별수정 ${plans.fieldFix.length}`);
console.log(`중복병합 ${plans.merge.length}그룹 → 삭제 ${plans.merge.reduce((s,m)=>s+m.drop.length,0)}행 | 비수영장 삭제 ${plans.del.length}행`);
console.log(`\n예상 행수: ${rows.length} → ${rows.length - dropCount}\n`);
console.log("=== 개별 수정 ===");
for (const f of plans.fieldFix) { console.log(` ${f.name}`); console.log(`   ${f.why}`);
  for (const [k,v] of Object.entries(f.set)) console.log(`   ${k}: ${f.before[k] ?? "없음"} -> ${v}`); }
console.log("\n=== 중복 병합 (유지 ← 삭제) ===");
for (const m of plans.merge) console.log(` 유지 ${m.keepName}  ←  ${m.drop.map(d=>d.name).join(", ")}   [${m.reasons.join(",")}]${Object.keys(m.fill).length ? "  보강:"+Object.keys(m.fill).join(",") : ""}`);
console.log(`\n=== 시간표 충돌로 자동병합 보류 ${plans.scheduleConflict.length}건 ===`);
for (const s2 of plans.scheduleConflict) console.log(` ${s2.keepName}(${s2.keepSlots}회차)  vs  ${s2.conflict.map(x=>x.name+"("+x.slots+"회차)").join(", ")}`);
console.log("\n=== 비수영장 삭제 ===");
for (const d of plans.del) console.log(` ${d.name} (${d.sido} ${d.gu}) — ${d.why}`);

fs.writeFileSync("docs/data/db-cleanup-plan.json", JSON.stringify({ plannedAt: new Date().toISOString(), before: rows.length, after: rows.length - dropCount, plans }, null, 1));

if (!WRITE) { console.log("\n[dry-run] --write 필요"); await c.end(); process.exit(0); }

const dropIds = [...plans.merge.flatMap((m) => m.drop.map((d) => d.id)), ...plans.del.map((d) => d.id)];
fs.writeFileSync(`docs/data/db-cleanup-backup-${new Date().toISOString().slice(0,10)}.json`,
  JSON.stringify(dropIds.map((id) => byId.get(id)), null, 1));
try {
  await c.query("BEGIN");
  for (const p of plans.phone) await c.query("update pools set phone=$2, updated_at=now() where id=$1", [p.id, p.to]);
  for (const p of plans.gu) await c.query("update pools set gu=$2, updated_at=now() where id=$1", [p.id, p.to]);
  for (const p of plans.address) await c.query("update pools set address=$2, updated_at=now() where id=$1", [p.id, p.to]);
  for (const f of plans.fieldFix) {
    const keys = Object.keys(f.set);
    await c.query(`update pools set ${keys.map((k,i)=>`${k}=$${i+2}`).join(", ")}, updated_at=now() where id=$1`, [f.id, ...keys.map(k=>f.set[k])]);
  }
  for (const m of plans.merge) {
    const keys = Object.keys(m.fill);
    if (keys.length) await c.query(`update pools set ${keys.map((k,i)=>`${k}=$${i+2}`).join(", ")}, updated_at=now() where id=$1`, [m.keepId, ...keys.map(k=>m.fill[k])]);
    await c.query("delete from pools where id = any($1)", [m.drop.map(d=>d.id)]);
  }
  if (plans.del.length) await c.query("delete from pools where id = any($1)", [plans.del.map(d=>d.id)]);
  const after = Number((await c.query("select count(*) n from pools")).rows[0].n);
  if (after !== rows.length - dropCount) throw new Error(`행수 불일치: 기대 ${rows.length-dropCount}, 실제 ${after}`);
  await c.query("COMMIT");
  console.log(`\nCOMMIT 완료. ${rows.length} -> ${after}`);
} catch (e) { await c.query("ROLLBACK"); console.error("ROLLBACK:", e.message); }
await c.end();
