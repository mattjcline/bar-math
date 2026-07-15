# iOS-compatible name autocomplete

## Problem

The Closing-name field and each bartender-row Name field use `<input list="known-users">` paired with a shared `<datalist id="known-users">` (`src/App.tsx:289`, `:313-317`, `:421`) to suggest known staff names. iOS Safari doesn't implement `<datalist>` at all — the `list` attribute is silently ignored, so iPhone/iPad users (the primary device for this app, per CLAUDE.md's mobile-first framing) never see suggestions. There's no CSS/HTML fix; this needs a hand-built dropdown.

## Component: `src/NameAutocomplete.tsx`

A new, small controlled component, reused by both fields that need name suggestions:

```ts
type NameAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
};
```

Renders the same plain `<input type="text">` these fields use today (no attribute or styling changes to the input itself — critically, its `font-size` stays at the existing `1rem`/16px, so the iOS auto-zoom rule stays satisfied without any new work), wrapped in a `position: relative` container, plus a conditionally-rendered dropdown list of matching names positioned directly below it.

**Interaction:**
- Focus → dropdown opens, showing all suggestions if the field is empty, or the filtered list if it already has a value.
- Typing → live-filters via `filterSuggestions` (see below), dropdown stays open, no matches → dropdown doesn't render.
- Tapping/clicking a suggestion → fills the field via `onChange` and closes the dropdown. The option's handler is attached to `onMouseDown` with `preventDefault()`, not `onClick` — this is what makes the tap register *before* the input's `onBlur` fires and closes the dropdown first (the standard mobile-safe combobox pattern; without it, blur beats click and the tap does nothing).
- Blur that isn't a suggestion tap → closes the dropdown.
- ArrowDown/ArrowUp → move a highlighted index through the visible suggestions (wrapping at the ends); Enter → select the highlighted suggestion; Escape → close the dropdown without changing the value. This preserves the keyboard navigation desktop users get today from native `<datalist>`, since the plan is to replace it everywhere (see below), not just on iOS.

**Internal state:** `isOpen: boolean`, `highlightedIndex: number`. No external state management — matches this app's plain-`useState` convention.

## Matching: `filterSuggestions` in `src/utils.ts`

```ts
export function filterSuggestions(suggestions: string[], query: string): string[]
```

Lives in `utils.ts` (this project's established home for pure, unit-tested logic — see `customRound`, `fmt`, and the kitchen-tip-out functions added for Tempest) so it's testable independent of the component's DOM/interaction behavior.

Internally wraps `fuse.js`: `new Fuse(suggestions, { threshold: 0.4 }).search(query)`, mapped back to plain strings. `fuse.js` is added as a dependency (`npm install fuse.js`) — this project's first non-CRA-scaffold, non-Supabase dependency. A fresh `Fuse` instance is constructed on every call rather than memoized; staff lists are small (a handful of names per bar), so this is cheap enough to run on every keystroke without `useMemo`, consistent with this app's no-memoization style.

One explicit special case: `fuse.js`'s `.search("")` returns no results, but the desired behavior is to show the *full* suggestion list when a field is focused and empty. So `filterSuggestions` returns `suggestions` unchanged when `query.trim() === ""`, and otherwise delegates to Fuse.

## `App.tsx` changes

- `const activeNames = users.map((u) => u.name);` computed once, reused by both call sites below (`users` is already fetched on mount, unchanged).
- The Closing field's `<input list="known-users" ... />` becomes `<NameAutocomplete value={closingName} onChange={setClosingName} suggestions={activeNames} placeholder="Your name" />`.
- Each bartender row's `<input list="known-users" ... />` becomes `<NameAutocomplete value={b.name} onChange={(v) => updateBartender(b.id, "name", v)} suggestions={activeNames} placeholder="Bartender name" />`.
- The now-unused `<datalist id="known-users">...</datalist>` block is deleted entirely — this is a full replacement of the native mechanism, on every platform, not an iOS-only fallback layered on top of it. One code path to maintain; the custom dropdown is at least as capable as native `<datalist>` on desktop too (arrow-key nav is preserved, per above).
- The bartender row is a CSS grid (`grid-template-columns: 1fr 80px 28px`); `NameAutocomplete`'s wrapper `div` must be `width: 100%` with no added vertical margin, so it drops into the existing grid cell exactly like the plain `<input>` did today, without shifting the Hours input or the remove button.

## Styling

New classes in `src/App.css`: `.autocomplete` (the `position: relative` wrapper), `.autocomplete-list` (`position: absolute`, `left: 0`, `right: 0`, dark card-matching background/border, scrollable if the list is long, `z-index` above surrounding content), `.autocomplete-option` (padding, hover and keyboard-highlighted states). Colors reuse the existing dark-theme palette already used by `.field input` (`#0d0d0f` background, `#2a2a36` border, `#e0e0ec` text, `#5050a0` accent for the highlighted option) rather than introducing new ones.

Because the dropdown is absolutely positioned within a `position: relative` wrapper constrained to `left: 0; right: 0` (i.e. the input's own width), it cannot cause horizontal overflow at narrow viewport widths — no additional width-clamping logic needed.

## Testing approach

This project has no component-level test harness (no React Testing Library usage anywhere despite the dependency being installed), and this feature doesn't introduce one — consistent with the precedent set by the Tempest kitchen-tip-out work. `filterSuggestions` gets real Jest unit tests in `src/utils.test.ts` (empty query returns everything, a subsequence/typo query still matches, a clearly-unrelated query returns nothing). The interactive parts of `NameAutocomplete` (focus/blur/keyboard/tap-to-select) are verified by driving the actual running app in a browser — same approach used for the admin footer link and will be used for the Tempest work.

## Out of scope

- No changes to which names are suggested — still `users` filtered to `is_active` at fetch time in `App.tsx`, unchanged.
- No persistence of "recently used" names or any ranking beyond Fuse's own relevance ordering.
- No changes to the admin panel's own `<select>`-based dropdowns (Bar Settings, Staff, Reports) — this only replaces the two `<input list="known-users">` usages in the calculator.
