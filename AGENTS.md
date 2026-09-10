# Openswim agent rules

## Skills

Project skills live in `.claude/skills/`. Read the matching `SKILL.md` before starting that kind of work.

- `.claude/skills/korean-pool-research/SKILL.md` — researching Korean pools: official-source evidence archiving, free-swim vs facility hours separation, fees, restrictions, facility photo selection, and validation before writing to Neon/R2.

Read a skill file only when the task matches it. Do not inline skill bodies into this file.

## Platform rules

Read `docs/skills/apps-in-toss-rules.md` before touching ads, navigation/back behavior,
safe-area positioning, permissions, sharelinks, or a bundle upload/review.
It records what fails review and the mistakes we already made.

`docs/skills/apps-in-toss.md` is only a link index to the official docs.

## App UI rules

- Never add an in-app back button. The Toss navigation bar already provides one, and both
  showing at once is a review violation. Handle back via the `backEvent` listener in
  `src/hooks/useAppNavigation.ts`.
- Never add safe-area insets to coordinates inside an element. `env(safe-area-inset-top)`
  returns the device notch value regardless of where the webview sits.
- Never wrap a banner ad in padding. The `variant: "card"` creative brings its own.
- Verify ads, safe-area, permissions, and clipboard on a real device. A local browser has
  neither the ad bridge nor the back bridge.

## 코드 vs DB 판단 기준

화면에 나가는 값을 어디에 둘지는 **바뀌는 빈도**와 **레이아웃 결합 여부**로 가른다.

**앱 재배포가 맞는 것 — 코드에 둔다**
- UI 레이아웃·구조 변경. 어차피 화면을 다시 봐야 하므로 배포 주기를 타는 게 맞다.
- 레이아웃과 1:1로 붙은 문자열: 탭 이름, 섹션 제목, 필터 칩 라벨. 바꾸면 폭·줄바꿈을 다시 봐야 한다.
- 데이터 구조에 묶인 라벨: 요일 이름(day 0~7), 상태 분류(운영/휴무/정보 없음).
- **네트워크 실패 경로의 문구.** DB를 못 읽는 상황에서 보여줄 문구를 DB에 둘 수는 없다.

**DB에 두는 것 — 수정 즉시 반영**
- 자주 바뀌지만 레이아웃에 영향이 없는 값. 재배포까지 갈 만큼 중대하지 않고, 배포를 걸면 관리 복잡도만 커진다.
- 현재: `public.pools`(수영장·시간표·요금), `public.gear_items`(추천 상품),
  `public.app_texts`(시간표 아래 근거 문구).
- 판단이 애매하면 이렇게 물어본다. "이 값 하나 고치자고 검수를 다시 태울 만한가?"
  아니라면 DB로 간다.

DB 값이 늦게 오거나 못 올 수 있으므로, DB에서 읽는 값은 **번들에 기본값을 함께 둔다.**
화면이 비는 것보다 예전 값이 보이는 편이 낫다.

## Pool data rules

- Use official homepages and official municipal/operator pages as the source of record.
- Save dated page evidence before extracting facts.
- Never write a guessed free-swim schedule; keep unknown values explicit.
- Get approval before changing production R2 objects or Neon rows.
- Clear image rights before publishing any photo: government (.go.kr) sources are usable under Copyright Act art. 24-2(1); public-corporation (.or.kr) sources need a KOGL mark or written permission; private-operator sources need permission. Openswim serves ads, so treat all use as commercial.
- Never publish a photo with an identifiable face. Portrait rights are separate from copyright.
- Verify every image visually before upload, and re-check served bytes with a cache-busting query after upload.
