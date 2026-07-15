# iOS-Compatible Name Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<datalist>`-based name suggestions on the Closing-name and bartender-name fields (which iOS Safari silently ignores) with a custom, fuzzy-matching dropdown that works on every platform.

**Architecture:** A new pure function `filterSuggestions` (in `src/utils.ts`, wrapping `fuse.js`) does the matching; a new small controlled component `src/NameAutocomplete.tsx` renders the input + dropdown and owns the open/highlight/keyboard-nav state; `src/App.tsx` swaps both `<input list="known-users">` usages for it and deletes the now-unused `<datalist>`.

**Tech Stack:** React 19 + TypeScript (Create React App), `fuse.js` (new dependency), Jest via `react-scripts test`.

Spec: `docs/superpowers/specs/2026-07-15-ios-name-autocomplete-design.md`

## Global Constraints

- Every new/changed `input` must stay at `font-size >= 16px` (iOS Safari auto-zoom rule). This plan doesn't change the input's own styling — it's still styled by the existing `.bartender-row input` / `.closing-field input` descendant selectors in `src/App.css`, which already set `font-size: 1rem` — but the new dropdown itself must not introduce anything under 16px either (see Task 2).
- No horizontal overflow at 375px/390px viewport widths after this change (checked in Task 4).
- This codebase has no component-level test harness (no React Testing Library usage anywhere despite the dependency being installed), and this plan doesn't introduce one. TDD applies to `filterSuggestions`, the one piece of genuinely pure logic here. `NameAutocomplete`'s interactive behavior (focus/blur/keyboard/tap-to-select) is verified by driving the real running app in a browser (Task 4), matching the precedent set by this project's other recent UI work.
- Keep the existing `useState` + inline-derivation style; no `useMemo`, no new state-management abstractions.
- `fuse.js` is this project's first non-CRA-scaffold, non-Supabase dependency — add it with a normal `npm install`, no lockfile surgery.

---

### Task 1: `filterSuggestions` pure function

**Files:**
- Modify: `package.json` (add `fuse.js` dependency)
- Modify: `src/utils.ts`
- Create (or extend, if it already exists — see Step 1 note): `src/utils.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces (used by Task 2): `export function filterSuggestions(suggestions: string[], query: string): string[]`

- [ ] **Step 1: Install `fuse.js`**

Run: `npm install fuse.js@^7.5.0`
Expected: `package.json` gains `"fuse.js": "^7.5.0"` under `"dependencies"`; `package-lock.json` updates.

- [ ] **Step 2: Write the failing tests**

Check whether `src/utils.test.ts` already exists (it may, if the separate Tempest kitchen-tip-out plan ran first — that plan also creates this file). If it exists, add the `import` for `filterSuggestions` to the existing import line from `"./utils"` and append the `describe` block below to the end of the file. If it doesn't exist, create it with exactly this content:

```ts
import { filterSuggestions } from "./utils";

describe("filterSuggestions", () => {
  const names = ["Jonathan", "Bob", "Alice", "Matt", "Katie", "Steph"];

  it("returns every suggestion for an empty query", () => {
    expect(filterSuggestions(names, "")).toEqual(names);
  });

  it("is case-insensitive", () => {
    expect(filterSuggestions(names, "BOB")).toEqual(["Bob"]);
  });

  it("tolerates a typo", () => {
    expect(filterSuggestions(names, "jhonathan")).toEqual(["Jonathan"]);
  });

  it("matches an in-order subsequence", () => {
    expect(filterSuggestions(names, "mtt")).toEqual(["Matt"]);
  });

  it("returns nothing for a clearly unrelated query", () => {
    expect(filterSuggestions(names, "zzzzzzz")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `CI=true npx react-scripts test src/utils.test.ts --watchAll=false`
Expected: FAIL — `TypeError: (0 , _utils.filterSuggestions) is not a function` (CRA's Jest uses Babel to strip types without type-checking, so the failure is a runtime "not a function" error, not a TS error).

- [ ] **Step 4: Implement `filterSuggestions`**

Add to `src/utils.ts` (near the top, with the other imports):

```ts
import Fuse from "fuse.js";
```

Add the function anywhere after the existing exports:

```ts
export function filterSuggestions(suggestions: string[], query: string): string[] {
  if (query.trim() === "") return suggestions;
  const fuse = new Fuse(suggestions, { threshold: 0.4 });
  return fuse.search(query).map((result) => result.item);
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `CI=true npx react-scripts test src/utils.test.ts --watchAll=false`
Expected: PASS — all 5 tests in the `filterSuggestions` describe block pass (more if `utils.test.ts` already had other tests in it).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/utils.ts src/utils.test.ts
git commit -m "$(cat <<'EOF'
Add filterSuggestions, a fuzzy name matcher backed by fuse.js

Wraps fuse.js (this project's first non-Supabase/non-CRA dependency)
at threshold 0.4 — tolerates typos and in-order-subsequence queries
(e.g. "mtt" -> "Matt") without over-matching unrelated names. Empty
query returns every suggestion, since fuse.js itself returns nothing
for an empty search but the caller wants the full list shown on
focus. Feeds the NameAutocomplete component landing in the next
commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `NameAutocomplete` component + styling

**Files:**
- Create: `src/NameAutocomplete.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes (from Task 1): `filterSuggestions(suggestions: string[], query: string): string[]`
- Produces (used by Task 3): `export default function NameAutocomplete(props: { value: string; onChange: (value: string) => void; suggestions: string[]; placeholder?: string }): JSX.Element`

- [ ] **Step 1: Add the dropdown CSS**

Append to `src/App.css`:

```css
/* Name autocomplete */
.autocomplete {
  position: relative;
}

.autocomplete-list {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 20;
  margin: 0.25rem 0 0;
  padding: 0.3rem;
  list-style: none;
  background: #14141a;
  border: 1px solid #2a2a36;
  border-radius: 5px;
  max-height: 180px;
  overflow-y: auto;
}

.autocomplete-option {
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9rem;
  color: #e0e0ec;
  cursor: pointer;
}

.autocomplete-option:hover,
.autocomplete-option.highlighted {
  background: #5050a0;
  color: #fff;
}
```

(This doesn't touch `.bartender-row input` / `.closing-field input` — those are descendant selectors, so they keep styling the `<input>` wherever it's nested, including one level deeper inside the new `.autocomplete` wrapper. The input's own `font-size: 1rem` is unchanged.)

- [ ] **Step 2: Create the component**

Create `src/NameAutocomplete.tsx`:

```tsx
import { useState, type KeyboardEvent } from "react";
import { filterSuggestions } from "./utils";

type NameAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
};

export default function NameAutocomplete({ value, onChange, suggestions, placeholder }: NameAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const matches = filterSuggestions(suggestions, value);

  const selectMatch = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectMatch(matches[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="autocomplete">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && matches.length > 0 && (
        <ul className="autocomplete-list">
          {matches.map((name, i) => (
            <li
              key={name}
              className={`autocomplete-option ${i === highlightedIndex ? "highlighted" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMatch(name);
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Note the `onMouseDown` (not `onClick`) with `preventDefault()` on each option — this is what makes a tap register before the input's `onBlur` fires and closes the dropdown; without it, blur wins the race and taps do nothing on mobile.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors) — this checks the component compiles against Task 1's `filterSuggestions` signature, even though nothing calls `NameAutocomplete` yet.

- [ ] **Step 4: Commit**

```bash
git add src/NameAutocomplete.tsx src/App.css
git commit -m "$(cat <<'EOF'
Add NameAutocomplete, a custom dropdown replacing native datalist

iOS Safari silently ignores <datalist>, so the existing
<input list="known-users"> fields show no suggestions there. This
component reimplements the suggestion dropdown in JS: focus opens it,
typing filters via filterSuggestions, tapping/clicking or Enter
selects, arrow keys move a highlighted option (preserving the
keyboard nav desktop users get from native datalist), Escape closes.
Not yet wired into App.tsx.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `NameAutocomplete` into the calculator

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes (from Task 2): `NameAutocomplete` component.
- Produces: nothing (leaf consumer).

- [ ] **Step 1: Import the component**

Change:

```ts
import { customRound, fmt, fmtInt, getDefaultDate, nameKey, type Bar, type StaffUser } from "./utils";
```

to:

```ts
import { customRound, fmt, fmtInt, getDefaultDate, nameKey, type Bar, type StaffUser } from "./utils";
import NameAutocomplete from "./NameAutocomplete";
```

- [ ] **Step 2: Compute the shared suggestion list once**

Change:

```ts
  const hasZeroHourWarning = bartenders.some(
    (b) => nameKey(b.name) !== "" && (parseFloat(b.hours) || 0) === 0,
  );
```

to:

```ts
  const hasZeroHourWarning = bartenders.some(
    (b) => nameKey(b.name) !== "" && (parseFloat(b.hours) || 0) === 0,
  );
  const activeNames = users.map((u) => u.name);
```

- [ ] **Step 3: Replace the Closing-name input**

Change:

```tsx
            <div className="closing-field">
              <label>Closing:</label>
              <input
                type="text"
                list="known-users"
                placeholder="Your name"
                value={closingName}
                onChange={(e) => setClosingName(e.target.value)}
              />
            </div>
```

to:

```tsx
            <div className="closing-field">
              <label>Closing:</label>
              <NameAutocomplete
                value={closingName}
                onChange={setClosingName}
                suggestions={activeNames}
                placeholder="Your name"
              />
            </div>
```

- [ ] **Step 4: Delete the now-unused datalist**

Delete this block entirely:

```tsx
          <datalist id="known-users">
            {users.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
```

- [ ] **Step 5: Replace the bartender-row name input**

Change:

```tsx
                <div className={rowClass} key={b.id}>
                  <input
                    type="text"
                    list="known-users"
                    placeholder="Bartender name"
                    value={b.name}
                    onChange={(e) =>
                      updateBartender(b.id, "name", e.target.value)
                    }
                  />
```

to:

```tsx
                <div className={rowClass} key={b.id}>
                  <NameAutocomplete
                    value={b.name}
                    onChange={(v) => updateBartender(b.id, "name", v)}
                    suggestions={activeNames}
                    placeholder="Bartender name"
                  />
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors)

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
Use NameAutocomplete for Closing name and bartender name fields

Replaces both <input list="known-users"> usages and deletes the
<datalist> they shared. This is a full replacement, not an iOS-only
fallback -- one dropdown implementation on every platform.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check and test suite**

Run: `npx tsc --noEmit -p .`
Expected: no output

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: all tests pass, including the `filterSuggestions` suite from Task 1

- [ ] **Step 2: Drive the real app**

Start the dev server if not already running (`npm start`), unlock the calculator, and confirm:

- Focusing the Closing field with it empty shows a dropdown listing every active staff name.
- Typing a few letters filters the list live (including a fuzzy/typo case, e.g. a slight misspelling of a real staff name).
- Typing something matching no one closes/hides the dropdown.
- Clicking a suggestion fills the field and closes the dropdown.
- The same four behaviors hold for at least one bartender-row Name field, independently of the Closing field (i.e. opening one doesn't affect the other's state).
- ArrowDown/ArrowUp move a visibly highlighted option, Enter selects the highlighted one, Escape closes the dropdown without changing the field's value.
- Adding a second bartender row and using its Name field works identically to the first (confirms `activeNames` and the per-row `onChange` wiring are correct across dynamically-added rows).

- [ ] **Step 3: Mobile check**

At 375px and 390px viewport widths, with a dropdown open (at least 3-4 visible suggestions) on both the Closing field and a bartender row, confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth` (no horizontal overflow) and that the dropdown doesn't visually clip outside the input's own width.

- [ ] **Step 4: Layout regression check**

Confirm the bartender row's three-column grid (name / hours / remove button) still lines up correctly — the `NameAutocomplete` wrapper `div` should fill the grid's first `1fr` column exactly like the plain `<input>` did before, not compress or misalign the Hours input or the × button. Also confirm the Closing field still renders at its original compact width next to the Date field, not stretched full-width.

- [ ] **Step 5: Report results**

Summarize pass/fail for each check above. Any failures found here should be fixed with a small follow-up commit before considering the feature done — this task has no commit of its own since it changes no files when everything passes.
