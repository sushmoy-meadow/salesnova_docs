# TASK-DESIGN-003 — open points

Implement foundation form-control components. All three acceptance criteria have tests behind them.
What follows is what those tests can reach and what they cannot, plus two decisions taken without
asking.

## Not testable in this repo

### The three pointer states are asserted as rules, not as pixels

`hover`, `focus-visible` and `active` are CSS variants. jsdom attaches no stylesheet, so
`form-controls.test.tsx` asserts that every one of the nine controls carries the rule for each of the
five non-resting states, and `control-classes.test.ts` asserts each rule reaches through its own
variant prefix and that no two states resolve to the same appearance. What is not verified is that a
real browser then paints them differently.

**Closes with:** a Playwright run that focuses and hovers one control per shape (box, choice mark,
switch track) and compares computed `border-color` and `background-color` between states. Also the
only way to confirm `prefers-reduced-motion: reduce` actually suppresses the loading pulse — the
`@utility transition-micro` media block and `motion-reduce:animate-none` are both untested at
runtime.

### The native pickers are the platform's, and jsdom has none of them

`<select>`, `<input type="date">` and `<input type="time">` were chosen precisely because a phone
opens the system picker for them (see ADR-0039). jsdom implements none of that: the date and time
tests drive the inputs by typing, which exercises the value contract and not the picker. Likewise
`field-sizing-content` — the platform auto-resize the Textarea relies on — has no jsdom
implementation, so `autoResize` is only asserted as a class.

**Closes with:** the same Playwright run, on a real Chromium and ideally one Android device, checking
that the pickers open and that a typed value round-trips through them.

### Contrast is checked at the token level, not per rendered control

`globals.test.ts` computes WCAG relative luminance and holds `border-strong` at 3:1 against both
`surface` and `surface-raised`, which is the pair a resting control actually uses. It does not check
the composite — a control on an unusual background, or the knob against the switch track.

**Closes with:** an axe or Playwright contrast sweep over a page that renders all nine.

## Decided without asking

### `SelectOption.description` has nowhere to go in a native `<select>`

The contract declares it; a native `<option>` renders text only. `Select` drops it rather than
faking a listbox. `Combobox` renders it, and is the control a caller wanting descriptions should
reach for. Recorded in ADR-0039 rather than changing the D-02 contract, which is another task's.

### The controls are not spreadable from `register()`

`FieldProps` carries `name`, `onBlur` and `ref` so a react-hook-form field can be wired up, but
`onChange` reports the value first where `register()`'s expects the event. The two are wired field by
field until a second form needs it; an adapter written now would be an abstraction ahead of its
second use. The docstring on `FieldProps` used to claim the spread worked — corrected.

### All nine carry `"use client"`

Choosing the platform control does not make a field server-renderable: each attaches a change handler
to a host element unconditionally. Left without the directive they would still be client components
in practice, but only a caller that tried would find out. See ADR-0039.
