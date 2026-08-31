# Region-First Pool Search Design

## Purpose

Optimize pool discovery for users who search by Korean administrative area—시·도, 시·군·구, 읍·면·동—while retaining pool-name search as a lower-priority fallback. Home and map screens must produce the same suggestions and committed search results.

## Current Constraints

- The app loads 779 pools from Neon and falls back to bundled JSON.
- Every pool has coordinates and a road-style address, but most addresses do not contain a 동 name.
- The current search mixes pool name and address substring matching, duplicates suggestion logic in Home and Nearby, and resolves ambiguous region names with the first array match.
- Search must remain fast and available without a runtime geocoding request.

## Address Enrichment

Add nullable search metadata to each pool:

- `road_address`: normalized road-name address
- `jibun_address`: normalized parcel address
- `legal_dong`: 법정 읍·면·동/리 name returned for the coordinate
- `administrative_dong`: 행정 읍·면·동 name returned for the coordinate
- `legal_region_code`: legal-region code
- `administrative_region_code`: administrative-region code

A Node.js maintenance script calls Kakao coordinate-to-address and coordinate-to-region APIs using each pool's existing WGS84 longitude and latitude. It writes an auditable result file by default and updates Neon only with an explicit write flag. Requests are rate-limited, retry transient failures with a finite retry count, and preserve existing enriched fields when a lookup fails.

The browser never receives a Kakao REST API key and never performs runtime address enrichment. Pools without enrichment remain searchable through existing `sido`, `gu`, `address`, and `name` fields.

## Search Model

Replace the separate region/text branches with one committed query and a shared, pure search index.

Each indexed pool exposes normalized terms grouped by priority:

1. Administrative terms: full and shortened 시·도, 시·군·구, 법정동, 행정동
2. Address terms: road address and parcel address
3. Name terms: pool name

Normalization trims input, collapses repeated whitespace, and lowercases Latin characters. It supports existing 시·도 suffix shortening, but does not add typo correction, 초성 search, transliteration, or fuzzy matching.

Whitespace-separated query tokens use AND semantics for a pool match. A token may match any indexed field, but result scoring gives administrative matches the highest weight, address matches the next weight, and pool-name matches the lowest weight. Exact complete-field matches rank above substring matches within a group. Stable source order breaks remaining ties.

## Suggestions and Ambiguity

Suggestions use the same index and ranking on Home and Nearby.

- Region suggestions appear before pool suggestions.
- Region suggestions are derived from enriched pool metadata and contain the smallest unambiguous label, such as `서울 강남구 역삼동` or `경기 여주시 가남읍`.
- Duplicate names such as `서구` are returned as separate 시·도-qualified suggestions. Submitting ambiguous text does not silently select the first region; it returns all matching pools ranked by region and keeps the qualified region suggestions visible.
- Pool suggestions remain available after region suggestions and are labeled with their location.
- Selecting a region suggestion commits its canonical region tokens. Selecting a pool suggestion commits its pool name.

## Home Behavior

The search box keeps live input separate from committed input. Typing updates suggestions only; Enter, suggestion selection, and clear commit a search.

Committed search runs the shared search engine before applying the existing availability filter. Existing day filters and schedule ranking remain unchanged. Location sorting remains mutually exclusive with committed text search. With neither location nor search, the current default-region behavior remains unchanged.

Remove `Region`, `matchRegion`, `inRegion`, the first-match region resolution, and Home's screen-local pool suggestion index after the shared index replaces them.

## Map Behavior

Nearby uses the same suggestions and committed result IDs as Home. Search moves the camera to the matching pools. All pool markers remain visible so nearby context is preserved; matched markers may be emphasized, but marker removal is outside this change.

Remove Nearby's screen-local `distinctRegions` and name-only suggestion logic. Clearing search restores the existing default camera behavior. A result with no coordinates remains valid in Home but cannot contribute to map bounds.

## Failure Handling

- Empty input matches all pools and clears committed search.
- An enrichment failure is recorded with pool ID, coordinates, status, and error message.
- A pool with partial enrichment is indexed from every available field.
- A query with no matches produces the existing empty state.
- API authentication or configuration failure stops write mode before database mutation.

## Test Strategy

Tests are written before implementation.

Pure search tests cover:

- legal-dong and administrative-dong matching
- 읍·면 and multi-token `시군구 + 동` matching
- road and parcel address matching
- administrative results ranking above address and pool-name matches
- pool-name fallback
- duplicate `서구` suggestions remaining qualified and separate
- whitespace and 시·도 suffix normalization
- missing enrichment fallback
- deterministic ordering and empty-query behavior

Enrichment tests mock Kakao responses and cover address/region mapping, legal-versus-administrative selection, retries, partial responses, dry-run output, and write-mode guards.

Screen integration tests verify that Home and Nearby consume identical suggestions and result IDs, typing does not commit, Enter does commit, clear resets, availability filters still apply after search, and map bounds use only matched pools with coordinates.

Final verification runs the focused tests, complete test suite, ESLint, and production build.

## Out of Scope

- Runtime Kakao place or address search
- Searching arbitrary places not present in the pool dataset
- Fuzzy matching, typo correction, 초성 search, or Romanized Korean search
- Replacing Kakao Maps or changing pool schedule filters
- Self-hosting nationwide address or boundary datasets
