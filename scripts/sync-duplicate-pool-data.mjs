import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const poolsPath = path.join(root, "src/data/pools.json");
const auditPath = path.join(root, "docs/data/pool-source-audit.json");

// 좌표와 시설명이 함께 일치하는 중복 레코드만 명시적으로 연결한다.
// 가격은 레코드별 기존 값이 다를 수 있어 덮어쓰지 않고, 빈 값만 보충한다.
const pairs = [
  ["00fb99ad-2f1d-4045-9775-93f46b493666", "adee362b-6c89-4cf0-83b5-cfc189b2d83c"],
  ["9c4cfc48-893d-474c-81d5-bef11e839fd7", "1c4ca946-1180-46b7-9b60-3cde268da388"],
  ["2c6edb5b-6197-4046-96b9-0c3a60813fed", "7e2c5f50-5e08-4923-962c-ff0cc8e01bd5"],
  ["5774861c-5fe0-49ad-8959-a4453b1165ac", "4ff490ec-61c2-428a-bc39-92d30a6a0b3c"],
  ["c5c5f13f-5fff-4d96-95a6-dcff27a51630", "335e9c84-0d76-4c20-a5bd-0cbf761d5a6c"],
  ["4cdbddb5-b7bb-4b3a-a513-01a7d54c54d9", "5d2257d5-f2cd-4c25-b668-d860df84ef78"],
  ["1b476bee-47f5-4ca1-983d-886d1e7a92f0", "8597b9bd-b302-4048-adea-a3adb190b523"],
  ["7af1bf4e-fb65-4915-9fcb-28d562795e85", "64bf0a3f-e0e1-43e0-b1f1-2b365db35ad2"],
  ["c919166c-03dc-4a67-b5c9-9fceecc06682", "359e7e4a-71ba-44ae-b19e-381a1ccd46c1"],
  ["9f473761-bf20-4f8a-bdac-c2f1d3322eec", "3f5348a2-086e-4801-86e2-a6fa6edb60fc"],
  ["1040b376-686c-4090-9ad1-b682baa23d7b", "358264e1-5586-42f5-822f-4307c7a1022b"],
  ["f5da7f87-ec6b-44a9-a135-799942b4ec66", "96ff8aa7-188e-4566-9c3d-a6dd308a2de4"],
  ["63ee892f-9349-44c4-baa7-e46b6f9ea3f4", "a275b264-6d50-40a7-9088-9adc872e9856"],
  ["9d6ae918-5557-4167-9660-117556a01774", "d62b98c4-65c9-4ea6-bcb7-114c5896cddc"],
  ["04d338e8-5289-498f-a9ea-6634ef1b98f9", "76364a2f-cc09-4c23-807c-95b2df802499"],
  ["75fb36d8-5ae0-49ad-a00d-41105d8bd001", "f60862a1-c5de-4a97-865b-6e7dfb253f9b"],
  ["98d68834-b24e-4825-9e16-eaa1232153ec", "c72ff817-f9d4-400e-bff6-11cda27e4fc4"],
  ["711089c6-663c-4ff7-912f-60fa68bc926b", "b40323cc-6d8d-4eb9-805b-ca544152f859"],
  ["6a9a33f8-42fa-4af2-802b-0d0671532bba", "c48a01b9-79f8-40bd-84b4-b395e64523c2"],
  ["1e976aa9-8e7c-495f-a32f-cd4e3fd91ca5", "064c9051-13f1-4ca0-822a-377af1df9ab8"],
  ["1a99c81f-aff7-4bc2-a7b8-5c94b3cc16e2", "fff64dc7-c398-42d8-a6a1-4adba61728a5"],
  ["cbbba6aa-d5a3-448e-bf37-17b80b381d27", "f15c4198-404f-4d40-908c-b8476b34ceb7"],
  ["6b92b3c8-5b34-4414-bb48-1eadabfc507a", "87def618-06ef-4df0-ad54-7e07fdb0bf95"],
  ["811e01f1-82a5-4016-a19f-cf5f26c62513", "f0319d76-c172-4184-9f39-546ab90871ef"],
  ["829184bb-00f6-46e1-b9df-8892471797ad", "8c46c379-14e0-4ad7-b68c-0f57407428fb"],
  ["18bd91f4-c2d3-4073-bfe9-a4f68248b494", "170ff9c5-7c4e-4f78-9a5b-61119dc7614d"],
  ["059f95dc-b796-4391-b256-de96b5fe25df", "f999c601-d7d6-4ddb-8240-6700553879c4"],
  ["eea6ba02-4433-4d78-96d4-5f777d06821c", "58679074-0038-4792-9340-3f830511584b"],
  ["d91e5f87-a245-4067-bb7e-2139861fd1e3", "e055bedf-6687-4820-ab8d-5548f1d191a8"],
  ["4df55ecd-5d5b-466a-bedc-0af4ed905894", "8b70444b-c8e6-40fc-99e9-a0bf693c27e7"],
  ["7706fa40-db6c-4b58-a6e5-0b83ae85af21", "3781b191-60d4-4fd9-b4af-ea095aef9295"],
  ["c23dab03-cb28-40cd-8595-a418cffcd8d4", "220917f2-261a-435f-82d2-70d72db43e35"],
  ["d3bbd22f-65f0-4cc5-9e61-113d6a799ac6", "f4aad639-fa56-4a80-ad8a-54ed42643653"],
];

const pools = JSON.parse(await readFile(poolsPath, "utf8"));
let audit = [];
try {
  audit = JSON.parse(await readFile(auditPath, "utf8"));
} catch {
  // 감사 파일이 없으면 새로 만든다.
}
const poolsById = new Map(pools.map((pool) => [pool.id, pool]));
const auditByPool = new Map(audit.map((entry) => [entry.poolId, entry]));
let changed = 0;

for (const [targetId, sourceId] of pairs) {
  const target = poolsById.get(targetId);
  const source = poolsById.get(sourceId);
  if (!target || !source) throw new Error(`중복 연결 ID 누락: ${targetId} <- ${sourceId}`);

  const fields = [];
  if ((!Array.isArray(target.free_swim) || target.free_swim.length === 0) && source.free_swim?.length) {
    target.free_swim = structuredClone(source.free_swim);
    fields.push("free_swim");
  }
  for (const field of ["price_free_swim", "prices", "homepage_url", "phone"]) {
    if ((target[field] == null || target[field]?.length === 0) && source[field] != null && source[field]?.length !== 0) {
      target[field] = structuredClone(source[field]);
      fields.push(field);
    }
  }
  if (!fields.length) continue;

  changed += 1;
  const sourceAudit = auditByPool.get(sourceId);
  auditByPool.set(targetId, {
    poolId: target.id,
    poolName: target.name,
    matchedName: source.name,
    fields,
    checkedAt: "2026-08-03",
    sourceUpdatedAt: sourceAudit?.sourceUpdatedAt ?? null,
    sourcePage: sourceAudit?.sourcePage ?? null,
    primarySource: sourceAudit?.primarySource ?? null,
    derivedFromPoolId: source.id,
    note: "동일 시설 중복 레코드의 확인된 정보를 동기화",
  });
}

await mkdir(path.dirname(auditPath), { recursive: true });
await writeFile(poolsPath, `${JSON.stringify(pools, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify([...auditByPool.values()], null, 2)}\n`);
console.log(`${changed}개 중복 시설 레코드 동기화 완료`);
