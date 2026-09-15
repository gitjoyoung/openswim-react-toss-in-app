// 중복 후보를 병합/오탐/판단필요로 분류한다. 읽기 전용.
import fs from "node:fs";
const rep = JSON.parse(fs.readFileSync("docs/data/pool-duplicates-live.json", "utf8"));
const roadKey = (s) => { const m = String(s ?? "").match(/([가-힣A-Za-z0-9]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/); return m ? m[1] + m[2] : null; };
const dist = (a, b, c2, d) => { if ([a,b,c2,d].some(v=>v==null)) return Infinity;
  const R=6371000,t=x=>x*Math.PI/180; const dl=t(c2-a),dg=t(d-b);
  const h=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c2))*Math.sin(dg/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };

const merge = [], reject = [], review = [];
for (const g of rep.duplicateGroups) {
  const ms = g.members;
  // 그룹 안 모든 쌍이 같은 도로명 + 가까운 좌표인가
  let allSameRoad = true, maxD = 0, roadKeys = new Set();
  for (const m of ms) roadKeys.add(roadKey(m.address) ?? "?");
  for (let i = 0; i < ms.length; i++) for (let j = i+1; j < ms.length; j++) {
    const d = dist(ms[i].lat, ms[i].lng, ms[j].lat, ms[j].lng);
    if (Number.isFinite(d)) maxD = Math.max(maxD, d);
    if ((roadKey(ms[i].address) ?? "?") !== (roadKey(ms[j].address) ?? "!")) allSameRoad = false;
  }
  const guSet = new Set(ms.map(m => (m.gu ?? "").replace(/\s.*$/, "")));
  const sidoSet = new Set(ms.map(m => (m.sido ?? "").slice(0, 2)));

  const entry = { ...g, maxMeters: Math.round(maxD), roadKeys: [...roadKeys], guSet: [...guSet], sidoSet: [...sidoSet] };

  if (sidoSet.size > 1 || guSet.size > 1) { entry.verdict = "오탐"; entry.why = "시도/구가 서로 다름 — 전화번호가 운영기관 대표번호일 가능성"; reject.push(entry); }
  else if (!allSameRoad && maxD > 400) { entry.verdict = "오탐"; entry.why = `도로명이 다르고 좌표도 ${Math.round(maxD)}m 떨어짐 — 같은 운영기관의 다른 시설`; reject.push(entry); }
  else if (allSameRoad && maxD <= 150 && ms.length === 2) { entry.verdict = "병합"; entry.why = `같은 도로명 주소, 좌표 ${Math.round(maxD)}m`; merge.push(entry); }
  else if (allSameRoad && maxD <= 150) { entry.verdict = "병합"; entry.why = `같은 도로명 주소, 좌표 ${Math.round(maxD)}m (${ms.length}행)`; merge.push(entry); }
  else { entry.verdict = "판단필요"; entry.why = `도로명 ${allSameRoad ? "일치" : "불일치"}, 좌표 최대 ${Math.round(maxD)}m`; review.push(entry); }
}
fs.writeFileSync("docs/data/pool-duplicates-classified.json",
  JSON.stringify({ classifiedAt: new Date().toISOString(), merge, review, reject }, null, 1));
const line = (g) => g.members.map(m => `${m.name}(${m.gu}${m.freeSwimSlots ? " " + m.freeSwimSlots + "회차" : ""})`).join("  ↔  ");
console.log(`병합 ${merge.length} | 판단필요 ${review.length} | 오탐 ${reject.length}\n`);
console.log("### 오탐 (병합 금지)");
for (const g of reject) console.log(`  ${line(g)}\n      ${g.why}`);
console.log("\n### 판단필요");
for (const g of review) console.log(`  ${line(g)}\n      ${g.why} | 주소: ${g.members.map(m=>m.address).join(" / ")}`);
