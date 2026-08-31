# Openswim Project Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every user-visible behavior while separating pure domain logic, React lifecycle hooks, and rendering across the project.

**Architecture:** Pure calculations stay in `src/lib` and accept all variable inputs explicitly. Screen-specific hooks own state and effects but return no JSX; screens compose those results into existing UI. Work proceeds in isolated worktrees with domain foundations first, then non-overlapping screens in parallel, then shell integration.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Vitest 3, React Testing Library, AppsInToss SDK 3.1, TDS Mobile.

**Spec:** `docs/superpowers/specs/2026-08-31-project-refactoring-design.md`

## Global Constraints

- Preserve search results, ordering, filter semantics, suggestion timing, copy, layout, ad placement, navigation, and permission timing.
- Pure modules must not import React or access browser/SDK globals.
- Hooks must return state and handlers, never JSX.
- External boundaries may be mocked; assertions must target returned state or rendered behavior, not mock existence.
- Avoid wrapper functions, components, and files that do not reduce cognitive load.
- Run `pnpm test`, `pnpm run lint`, `pnpm exec tsc -b --pretty false`, and `pnpm run build` at every integration gate.
- Do not modify the user's untracked `GEMINI.md` or `check_errors.cjs`.

---

### Task 1: Pure Search, Schedule, and Pool Data Boundaries

**Files:**
- Modify: `src/lib/search.ts`
- Modify: `src/lib/pools.ts`
- Modify: `src/pool.ts`
- Modify: `src/lib/search.test.ts`
- Create: `src/lib/pools.test.ts`
- Create: `src/pool.test.ts`

**Interfaces:**
- Produces: `buildPoolSearchIndex(pools: Pool[]): PoolSearchEntry[]`
- Produces: `findPoolSuggestions(index: PoolSearchEntry[], query: string, limit?: number): Pool[]`
- Produces: `filterAndSortPools(input: PoolListQuery): Pool[]`
- Produces: `isPoolArray(value: unknown): value is Pool[]`
- Consumes: existing `Pool`, `Region`, schedule helpers, and geo distance functions.

- [ ] **Step 1: Add characterization tests for search index and ordering**

Add literal fixtures proving address search, token matching, identical district isolation, default Geumcheon priority, location distance priority, schedule coverage priority, and stable empty-query behavior. A mutation removing address, region, or one ranking branch must fail a test.

- [ ] **Step 2: Run domain tests and record the characterization baseline**

Run: `pnpm vitest run src/lib/search.test.ts src/lib/pools.test.ts`

Expected: existing characterization tests pass; tests naming the new extracted interfaces fail because the exports do not exist.

- [ ] **Step 3: Extract the minimal pure interfaces**

Move index construction and list filtering/sorting out of screens. `PoolListQuery` must carry `pools`, `region`, `appliedText`, filter key, and optional location. Do not read time or browser state inside the new functions.

- [ ] **Step 4: Add data validation boundary tests**

Test a complete valid array, non-array payload, missing required identity fields, and mixed valid/invalid rows. Export `isPoolArray` and keep remote fetch/fallback behavior unchanged.

- [ ] **Step 5: Run Task 1 verification**

Run: `pnpm vitest run src/lib/search.test.ts src/lib/pools.test.ts src/pool.test.ts && pnpm run lint && pnpm exec tsc -b --pretty false`

- [ ] **Step 6: Commit Task 1**

```bash
git add src/lib/search.ts src/lib/pools.ts src/pool.ts src/lib/search.test.ts src/lib/pools.test.ts src/pool.test.ts
git commit -m "refactor: isolate pool domain calculations"
```

---

### Task 2: Home Search and Location Hooks

**Files:**
- Create: `src/hooks/useHomeSearch.ts`
- Create: `src/hooks/useHomeLocation.ts`
- Create: `src/hooks/useHomeSearch.test.tsx`
- Create: `src/hooks/useHomeLocation.test.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `buildPoolSearchIndex`, `findPoolSuggestions`, `filterAndSortPools` from Task 1.
- Produces: `useHomeSearch(pools: Pool[])` returning query, committed region/text, suggestions, filter, filtered pools, and explicit handlers.
- Produces: `useHomeLocation()` returning location, locating state, delayed loader state, and toggle handler.

- [ ] **Step 1: Extend HomeScreen behavior tests before extraction**

Cover typing without applying, Enter applying, clearing restoring the full list, region suggestion selection, filter selection, location success, location rejection, and unmount before silent-location resolution.

- [ ] **Step 2: Run the new tests against the current screen**

Run: `pnpm vitest run src/screens/HomeScreen.test.tsx`

Expected: characterization cases pass; hook import tests fail because hooks do not exist.

- [ ] **Step 3: Extract `useHomeSearch`**

Move query cache synchronization, 150ms suggestion debounce, committed search state, filter state, and pure-list calls into the hook. Ensure timer cleanup remains explicit.

- [ ] **Step 4: Extract `useHomeLocation`**

Move silent initial lookup, explicit permission lookup, 300ms loader delay, cancellation guard, and toggle behavior into the hook. Inject geo functions only where tests require control.

- [ ] **Step 5: Reduce HomeScreen to composition**

Remove moved imports, callbacks, effects, refs, and calculations. Keep existing JSX order and inline presentation styles unchanged.

- [ ] **Step 6: Run Task 2 verification and commit**

Run: `pnpm vitest run src/hooks/useHomeSearch.test.tsx src/hooks/useHomeLocation.test.tsx src/screens/HomeScreen.test.tsx && pnpm run lint && pnpm exec tsc -b --pretty false`

```bash
git add src/hooks/useHomeSearch.ts src/hooks/useHomeLocation.ts src/hooks/useHomeSearch.test.tsx src/hooks/useHomeLocation.test.tsx src/screens/HomeScreen.tsx src/screens/HomeScreen.test.tsx
git commit -m "refactor: separate home state from presentation"
```

---

### Task 3: Nearby Map Boundary

**Files:**
- Create: `src/hooks/useNearbySearch.ts`
- Create: `src/hooks/usePoolMap.ts`
- Create: `src/hooks/useNearbySearch.test.tsx`
- Create: `src/hooks/usePoolMap.test.tsx`
- Modify: `src/screens/NearbyScreen.tsx`
- Modify: `src/components/PoolMap.tsx`
- Create or modify: `src/screens/NearbyScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1 search/index functions and existing `LatLng`/map helpers.
- Produces: `useNearbySearch(pools: Pool[])` for live query, committed region/text, suggestions, and visible pools.
- Produces: `usePoolMap(options)` for SDK lifecycle, center changes, markers, and current-location commands.

- [ ] **Step 1: Add characterization tests for nearby behavior**

Cover initial default center, typing versus committed search, region selection, marker selection, current-location success/failure, and cleanup after unmount.

- [ ] **Step 2: Verify tests fail only for missing hook boundaries**

Run: `pnpm vitest run src/screens/NearbyScreen.test.tsx src/hooks/useNearbySearch.test.tsx src/hooks/usePoolMap.test.tsx`

- [ ] **Step 3: Extract pure search state and imperative map lifecycle**

Keep search calculation in pure Task 1 functions. Limit map SDK access to `usePoolMap`/the existing low-level map adapter and preserve `data-allow-zoom` behavior.

- [ ] **Step 4: Simplify NearbyScreen and PoolMap**

Remove duplicated search index creation and lifecycle effects from JSX components. Do not alter marker appearance, map links, or panel layout.

- [ ] **Step 5: Run Task 3 verification and commit**

Run: `pnpm vitest run src/screens/NearbyScreen.test.tsx src/hooks/useNearbySearch.test.tsx src/hooks/usePoolMap.test.tsx && pnpm run lint && pnpm exec tsc -b --pretty false`

```bash
git add src/hooks/useNearbySearch.ts src/hooks/usePoolMap.ts src/hooks/useNearbySearch.test.tsx src/hooks/usePoolMap.test.tsx src/screens/NearbyScreen.tsx src/screens/NearbyScreen.test.tsx src/components/PoolMap.tsx
git commit -m "refactor: isolate nearby map lifecycle"
```

---

### Task 4: Pool Detail View Model

**Files:**
- Create: `src/lib/poolDetail.ts`
- Create: `src/lib/poolDetail.test.ts`
- Create: `src/hooks/usePoolDetailActions.ts`
- Create: `src/hooks/usePoolDetailActions.test.tsx`
- Modify: `src/screens/PoolDetail.tsx`
- Create or modify: `src/screens/PoolDetail.test.tsx`

**Interfaces:**
- Produces: `buildPoolDetailModel(pool: Pool): PoolDetailModel` containing display-ready schedule, price, facility, contact, and image data.
- Produces: `usePoolDetailActions(pool: Pool)` containing external link and route handlers.
- Consumes: existing schedule parsers and `mapLinks` functions.

- [ ] **Step 1: Add literal view-model tests**

Cover a complete pool, missing schedule, missing prices, empty facilities, absent images, and malformed optional JSON. Expected labels and section visibility must be hand-derived literals.

- [ ] **Step 2: Add screen characterization tests**

Cover section visibility, favorite action, close action, homepage action, route action, and banner position.

- [ ] **Step 3: Run tests to expose missing boundaries**

Run: `pnpm vitest run src/lib/poolDetail.test.ts src/hooks/usePoolDetailActions.test.tsx src/screens/PoolDetail.test.tsx`

- [ ] **Step 4: Extract view model and actions, then simplify JSX**

Move only reused or complex transformations. Keep one-off, obvious display expressions in the screen. Extract sections only when they own a coherent render responsibility.

- [ ] **Step 5: Run Task 4 verification and commit**

Run: `pnpm vitest run src/lib/poolDetail.test.ts src/hooks/usePoolDetailActions.test.tsx src/screens/PoolDetail.test.tsx && pnpm run lint && pnpm exec tsc -b --pretty false`

```bash
git add src/lib/poolDetail.ts src/lib/poolDetail.test.ts src/hooks/usePoolDetailActions.ts src/hooks/usePoolDetailActions.test.tsx src/screens/PoolDetail.tsx src/screens/PoolDetail.test.tsx
git commit -m "refactor: separate pool detail view model"
```

---

### Task 5: Application Shell Hooks

**Files:**
- Create: `src/hooks/useAppNavigation.ts`
- Create: `src/hooks/useDetailScrollLock.ts`
- Create: `src/hooks/useHideOnScroll.ts`
- Create: `src/hooks/usePools.ts`
- Create: `src/hooks/useAppNavigation.test.tsx`
- Create: `src/hooks/useDetailScrollLock.test.tsx`
- Create: `src/hooks/useHideOnScroll.test.tsx`
- Create: `src/hooks/usePools.test.tsx`
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

**Interfaces:**
- Produces: `usePools()` returning pools, loading, loadError, and retry.
- Produces: `useAppNavigation()` returning active tab, selected pool, guarded open/close handlers, and tab handler.
- Produces: `useDetailScrollLock(open: boolean): void`.
- Produces: `useHideOnScroll(threshold?: number): boolean`.

- [ ] **Step 1: Characterize shell behavior**

Cover data success/failure/retry, favorite migration, detail double-open guard, system back closing detail before app close, tab reset, scroll restoration, and tabbar hide/show thresholds.

- [ ] **Step 2: Run shell tests before extraction**

Run: `pnpm vitest run src/App.test.tsx src/hooks/useAppNavigation.test.tsx src/hooks/useDetailScrollLock.test.tsx src/hooks/useHideOnScroll.test.tsx src/hooks/usePools.test.tsx`

- [ ] **Step 3: Extract lifecycle hooks one responsibility at a time**

After each hook extraction, rerun its focused test. Keep favorite persistence and Origin migration sequencing unchanged.

- [ ] **Step 4: Simplify App and TabBar**

App should compose loading/error/tab/detail states and render screens. TabBar should consume `hidden` rather than own scroll listeners.

- [ ] **Step 5: Run Task 5 verification and commit**

Run: `pnpm vitest run src/App.test.tsx src/hooks/useAppNavigation.test.tsx src/hooks/useDetailScrollLock.test.tsx src/hooks/useHideOnScroll.test.tsx src/hooks/usePools.test.tsx && pnpm run lint && pnpm exec tsc -b --pretty false`

```bash
git add src/hooks/useAppNavigation.ts src/hooks/useDetailScrollLock.ts src/hooks/useHideOnScroll.ts src/hooks/usePools.ts src/hooks/*.test.tsx src/App.tsx src/App.test.tsx
git commit -m "refactor: separate application shell lifecycles"
```

---

### Task 6: Integration, Dead-Code Removal, and Final Verification

**Files:**
- Modify only files identified as dead or duplicated by compiler, lint, test, and `rg` evidence.
- Modify: `README.md` only if commands or structure changed.

**Interfaces:**
- Consumes all prior task interfaces.
- Produces no new abstraction unless integration exposes a duplicated behavior used in at least two owners.

- [ ] **Step 1: Integrate worktrees in dependency order**

Integrate Task 1 first; rebase Task 2 and Task 3 on it and integrate them after independent review. Then rebase/integrate Task 4 and Task 5. Resolve conflicts by preserving the task ownership boundaries in this plan.

- [ ] **Step 2: Scan for dead and duplicate code**

Run: `rg -n "TODO|FIXME|eslint-disable|@ts-ignore" src` and `rg -n "useEffect|useMemo|useCallback" src/screens src/components`

Remove only imports, helpers, comments, and wrappers proven unused or duplicated. Do not perform formatting-only rewrites across unrelated files.

- [ ] **Step 3: Run the complete verification gate**

```bash
pnpm test
pnpm run lint
pnpm exec tsc -b --pretty false
pnpm run build
```

Expected: all commands exit 0. Record test counts and bundle-size warnings; do not hide the existing large-chunk warning.

- [ ] **Step 4: Review the final diff against the spec**

Confirm each screen preserves copy, layout, event order, permission timing, ad placement, and navigation. Confirm pure modules have no React/browser imports and hooks return no JSX.

- [ ] **Step 5: Commit integration cleanup**

```bash
git add src README.md
git commit -m "refactor: complete project concern separation"
```
