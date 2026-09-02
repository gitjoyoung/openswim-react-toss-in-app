# Openswim agent rules

## Skills

Project skills live in `.claude/skills/`. Read the matching `SKILL.md` before starting that kind of work.

- `.claude/skills/korean-pool-research/SKILL.md` — researching Korean pools: official-source evidence archiving, free-swim vs facility hours separation, fees, restrictions, facility photo selection, and validation before writing to Neon/R2.

Read a skill file only when the task matches it. Do not inline skill bodies into this file.

## Pool data rules

- Use official homepages and official municipal/operator pages as the source of record.
- Save dated page evidence before extracting facts.
- Never write a guessed free-swim schedule; keep unknown values explicit.
- Get approval before changing production R2 objects or Neon rows.
- Clear image rights before publishing any photo: government (.go.kr) sources are usable under Copyright Act art. 24-2(1); public-corporation (.or.kr) sources need a KOGL mark or written permission; private-operator sources need permission. Openswim serves ads, so treat all use as commercial.
- Never publish a photo with an identifiable face. Portrait rights are separate from copyright.
- Verify every image visually before upload, and re-check served bytes with a cache-busting query after upload.
