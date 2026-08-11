# 0039 — The platform is the headless primitive everywhere it has one

- **Status:** Accepted
- **Date:** 2026-08-09
- **Task:** TASK-DESIGN-003
- **Relates to:** `SN-DS-080`, which asks for "headless primitives (Radix or equivalent)"

## Context

The nine foundation form controls — Input, Textarea, Select, Combobox, DatePicker, TimePicker,
Checkbox, Radio, Switch — needed accessible behaviour from somewhere. `SN-DS-080` names Radix, and
allows an equivalent.

Radix would have been the default reading. It is not what this repo should carry, for reasons that
are specific to who uses this product rather than general preference.

## Decision

**Eight of the nine are the platform's own control, styled. One is written by hand.**

| Control | Built on |
|---|---|
| Input, Textarea | `<input>`, `<textarea>` |
| Select | `<select>` |
| DatePicker, TimePicker | `<input type="date">`, `<input type="time">` |
| Checkbox, Radio | `<input type="checkbox">`, `<input type="radio">` |
| Switch | `<button role="switch">` |
| Combobox | written here |

Radix is not added as a dependency.

### Why

**For most of these, Radix is not a better primitive — it is a worse one.** A `<select>` on the
Android phones this product is used on opens the system picker: scrollable with a thumb, legible in
sunlight, already translated into the user's language, and rendered by the OS rather than by our
JavaScript. `<input type="date">` opens the system calendar, which knows the locale's week start and
the user's preferred input method. A JS listbox replaces all of that with something we would have to
re-earn, and it arrives only after the bundle does.

**The cost is paid on the wrong connection.** The Radix packages needed for select, combobox,
checkbox, radio, switch and popover come to tens of kilobytes before styling, on a product whose
users are on mid-range devices and metered data. That is a real download for behaviour the platform
already ships.

**The one place the platform has nothing is the Combobox** — a text field that filters a listbox.
There is no native equivalent, so it is written here with its own keyboard contract: arrows move,
Enter commits, Escape closes without changing the selection. That is roughly 120 lines, and it is
the only place we take on the accessibility burden ourselves.

Adopting Radix for one control while the other eight are native would have meant two different
keyboard models and two different focus behaviours in one form.

### What we give up

Radix would give the Combobox a maintained, widely-tested implementation of a genuinely fiddly
pattern. Ours is tested here but is new code, and combobox accessibility is easy to get subtly
wrong. If the hand-written one accumulates bugs, adopting a headless combobox for that single
control is the cheap reversal — the contract is `ComboboxProps` and nothing outside this file
depends on how it is built.

We also give up styling control over the picker surfaces: a native `<select>` renders its options
the way the OS wants, so the design system styles the closed control and not the open list. That is
accepted deliberately, and is the same trade as the one above.

## Consequences

- `SN-DS-080`'s parenthetical is satisfied by the "or equivalent" clause, on the reading that the
  platform's own controls are headless primitives — behaviour without opinion about appearance,
  which is exactly what the requirement asks for.
- All nine carry `"use client"`. Choosing the platform control does not make a field renderable on
  the server: every one of them attaches a change handler to a host element unconditionally, and a
  function prop cannot cross the boundary. Left without the directive they would still be client
  components in practice, but only a caller that tried it would find out — as a build error inside
  the design system rather than at the page that misused it.
- `Select` cannot render an option's `description`, which `SelectOption` declares. Native `<option>`
  has nowhere to put it. Callers needing it want `Combobox`. Recorded as an open point.
- A native date input's value is a calendar day with no timezone. `date-value.ts` converts using
  local parts rather than `toISOString`, which would move a date picked in a negative-offset zone to
  the day before.
