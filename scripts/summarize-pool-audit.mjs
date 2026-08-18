import fs from "node:fs/promises";
import path from "node:path";

const auditPath = process.env.AUDIT_PATH ?? path.resolve("docs/data/pool-data-audit.json");
const audit = JSON.parse(await fs.readFile(auditPath, "utf8"));

const topRegions = audit.priority.groups
  .filter((region) => region.missing_free_swim > 0 || region.missing_phone > 0 || region.missing_homepage > 0)
  .sort((a, b) => b.missing_free_swim - a.missing_free_swim || b.missing_all_priority - a.missing_all_priority || b.total - a.total)
  .slice(0, 30);

console.log(JSON.stringify({
  duplicate_ids: audit.integrity.duplicate_ids,
  duplicate_name_addresses: audit.integrity.duplicate_name_addresses,
  invalid_phone_examples: audit.integrity.examples.invalid_phones,
  invalid_homepage_examples: audit.integrity.examples.invalid_homepage_urls,
  invalid_free_swim_examples: audit.integrity.examples.invalid_free_swim_rows,
  all_critical_missing_examples: audit.priority.all_critical_missing_examples.slice(0, 40),
  top_regions: topRegions,
}, null, 2));
