---
name: "korean-pool-research"
description: "Use when researching Korean swimming pools, public free-swim schedules, fees, official facility photos, operating hours, restrictions, holidays, or updating Openswim pool data."
---

# Korean pool research

Use an evidence-first workflow. Do not fill a schedule, image, fee, or restriction from inference.

## 1. Identify the exact facility

- Match by full road address and phone number, not name alone.
- Treat duplicate records as one facility only after confirming address and coordinates.
- Record the official homepage and every official operator/city facility page used.

## 2. Crawl and preserve the evidence

Start at the official homepage and follow same-domain links up to the relevant facility pages. Prioritize links containing:
`시설`, `수영장`, `이용안내`, `운영안내`, `시설사진`, `요금`, `자유수영`, `공지`, `센터소개`, `pool`, `facility`, `photo`.

For each relevant page, preserve a dated evidence bundle before extracting facts:

```text
evidence/pools/{poolId}/{YYYY-MM-DD}/
  manifest.json       # URL, final URL, fetchedAt, status, content hash
  page.html           # raw or rendered DOM
  page-text.txt       # normalized text with stable line numbers
  screenshot-full.png # rendered full-page evidence, especially tables/images
  assets/             # official attachments and candidate photos
```

Read evidence in this order: `facts.md`/`page-text.txt`, then screenshot, then HTML and assets. If a later interpretation is challenged, re-parse the saved evidence before revisiting the live site. Keep old dated bundles; never overwrite the prior capture.

## 3. Extract separate fact categories

Keep these fields separate:

- `facilityHours`: building/operator hours and regular closure days
- `freeSwim`: only confirmed public/open-swim days and sessions
- `prices`: free-swim/day-pass/monthly/member prices with audience labels
- `notes`: important restrictions and special conditions
- `images`: official building exterior and pool interior photos

Never turn building hours into free-swim hours. Never turn a lesson frequency into free-swim days. For example, `주 2회(화목)` attached to a children's lesson is not evidence that free swim runs Tuesday and Thursday.

If a current official page does not explicitly state the free-swim day/time, use `public_source_not_found` or `needs_phone_confirmation`; do not invent symmetric hours or copy an old notice without its date and applicability.

Distinguish at minimum:

- lesson/class hours vs free swim
- facility opening hours vs pool lane availability
- monthly/member registration vs walk-in/day pass
- adult/general-public vs youth/student/women-only/member-only access
- regular weekly schedule vs dated event, temporary opening, or holiday exception

## 4. Select facility photos, not website artwork

Only select images from an official facility-detail or facility-photo page, or an official municipal/operator facility record whose address matches. Prefer images whose page context or alt text identifies the pool, swimming pool, facility, or building.

Filename, size, and aspect-ratio rules are a first-pass filter only. They do not detect a notice poster, timetable, calendar, floor plan, staff portrait, gym/studio room, or sports field saved as a normal-looking photo. Every image must be viewed before it reaches production; build a contact sheet of downscaled candidates and inspect it rather than trusting the heuristics.

Accept both kinds when available:

- `exterior`: the pool building or facility exterior
- `pool-interior`: lanes, pool basin, deck, or indoor pool

Store multiple images in an array, each with `kind`, `imageUrl`, `sourcePage`, `sourceNote`, and evidence line/page reference. Reject homepage carousel artwork, operating-hour posters, event flyers, popup notices, banners, logos, icons, maps, social thumbnails, and unrelated youth-program graphics. A large image is not automatically a facility photo.

For the Guro Youth Center failure case: `adm/data/main/main1_73` was a `구로ing` operating-hours banner, while the official facility-photo page contained actual `구로청소년수련관 수영장` photos. The latter is valid; the former is not.

## 5. Preserve restrictions as user-visible notes

Put verified conditions in `facilities.notes[]`, not only in research notes. Examples:

- `청소년 전용 수영장`
- `여성 전용`
- `회원 전용`
- `일요일·공휴일 휴관`
- `일반인 이용 가능`
- `자유수영 상세 일정은 센터 확인 필요`

Keep the wording faithful to the source and include a dated/source reference in the evidence record. Do not silently convert an old event notice into a current permanent restriction.

## 6. Produce field-level provenance

Every populated fact must point to the evidence that supports it:

```json
{
  "value": "09:00-22:00",
  "sourcePage": "https://...",
  "evidenceFile": "page-text.txt",
  "evidenceLines": "120-126",
  "quote": "운영시간 주중 09:00-22:00",
  "collectedAt": "2026-09-02",
  "confidence": "high"
}
```

Use `high` for a current official page that states the fact directly, `medium` for dated/secondary corroboration, and `needs_phone_confirmation` when the official evidence is missing or conflicting.

## 7. Validate before database updates

- Address and phone identify the same facility.
- Every `freeSwim` session has an explicit day and time source.
- `facilityHours` was not copied into `freeSwim`.
- Class days were not copied into `freeSwim`.
- Every image is an actual exterior/interior facility photo, not a banner or notice.
- Image source page belongs to the official facility/operator or verified municipal portal.
- Multiple images retain their order and are converted to WebP only after source validation.
- Every stored image was visually inspected, not only rule-checked.
- After upload, re-fetch each public URL with a cache-busting query string and view the bytes actually served. A CDN can keep serving a previously uploaded object for an unchanged key, so an un-busted check can show a stale image and hide a failed replacement.
- Duplicate facility records receive the same correction only after the primary evidence is recorded.
- Missing or conflicting facts remain explicitly marked instead of being guessed.

Only after these checks should the normalized facts and WebP image URLs be written to Neon/R2. When the source changes, save a new dated evidence bundle and compare it with the previous capture before changing production data.

## 8. Minimize AI tokens with an exception queue

Do all mechanical work in scripts before calling AI:

- crawl official pages and attachments
- save raw HTML, rendered text, screenshots, and hashes
- normalize Korean text and extract tables
- detect schedule/price/restriction/image keywords
- parse explicit day/time/amount patterns
- check address/phone identity, MIME, dimensions, duplicates, and image URLs
- classify obvious assets such as logos, banners, popups, maps, and event artwork

Do not send full HTML or full screenshots to AI by default. Send only a compact facility record plus the relevant line-numbered snippets. Send a screenshot only when the fact is image-based, JS/canvas-rendered, OCR is needed, or text extraction is ambiguous.

Use deterministic confidence gates:

- `confirmed_by_rule`: write no AI request when an official table directly gives the fact
- `needs_ai_triage`: send a small snippet to a low-cost model only to classify the issue
- `needs_strong_review`: send contradictions, unclear audience restrictions, or image-semantic cases to a stronger/visual model
- `needs_phone_confirmation`: do not ask AI to invent a missing schedule

Never use a fast-model guess as final evidence for a schedule or implementation decision. AI output must be strict JSON keyed by `poolId`, with `value`, `status`, `evidenceRefs`, and `uncertain` fields. No explanatory prose.

Cache by page hash/ETag/Last-Modified. On recheck, skip unchanged pages and send only the changed text block or changed image candidate to AI. Batch only independent compact records with explicit IDs; keep each batch small enough that one facility cannot be confused with another.

The target economics are zero AI tokens for obvious mechanical cases, roughly 500–1,500 tokens for an ambiguous text case, and visual/strong review only for the small exception set. This is substantially cheaper and more reproducible than asking AI to reread every full page and screenshot on every run.

## 9. Clear image rights before publishing

Copyright is a release blocker, not a later cleanup. Classify every image source before it goes to production.

### Source classes

- `.go.kr` (national/local government): Copyright Act art. 24-2(1) allows use without permission for works the state or a local government created in the course of duty, or whose economic rights it fully holds, subject to the listed exceptions. Lowest risk.
- `.or.kr` (public corporations, facility management corporations, foundations): NOT covered by art. 24-2(1). Free use depends on an explicit KOGL (공공누리) mark or written permission. Grey zone by default.
- Private operators (`.co.kr`, `.com`, other private domains): fully reserved. Assume permission is required.

### KOGL types

| Type | Commercial use | Modification |
|---|---|---|
| 1 | allowed | allowed |
| 2 | prohibited | allowed |
| 3 | allowed | prohibited |
| 4 | prohibited | prohibited |

Record the type shown on the page. No mark means no permission, not implied permission.

### Rules for this project

- Openswim serves ads, so treat every use as commercial. KOGL types 2 and 4 are unusable.
- Copying an image into R2 and converting it to WebP is reproduction, adaptation, and public transmission. It is a stronger act than linking, and any "no modification" condition already forbids the WebP conversion.
- Do not publish photos where a face is identifiable, especially minors. Portrait rights are separate from copyright and are not cured by a public source.
- Prefer empty pools and building exteriors over photos containing people.
- Store `sourceClass` (`gov`, `public-corp`, `private`), `licenseMark` (KOGL type or `none`), and `collectedAt` next to every image record.
- When the source class is `private`, or a public-corporation page carries no license mark, do not publish. Request written permission, replace the image, or leave the facility without a photo.

Leaving a facility with no photo is an acceptable outcome. Publishing an unlicensed photo is not.
