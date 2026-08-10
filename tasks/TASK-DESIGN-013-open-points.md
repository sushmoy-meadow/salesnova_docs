# TASK-DESIGN-013 — open points

## 1. "Layout matches the specified breakpoint table at each width" — measured statically, not visually

**What is closed.** The table is data in `src/lib/design-system/breakpoints.ts`, its widths are
asserted against the `--breakpoint-*` declarations Tailwind's own theme emits, and the shell's tests
derive the variant prefix they expect from it — `stepWhere(step => step.navigation !== "bottom")`
returns `md`, and that string is what the bar's `md:hidden` and the sidebar's `md:flex` are checked
for. A test also fails any variant prefix in a shell source that the table does not name. So the
table and the classes can no longer drift apart in silence.

**What is not.** jsdom has no layout engine and no media queries, so nothing here renders the page
at 767px and looks. Every assertion is about which class is present, not about what the browser then
does with it — a class could be present and overridden, or generate no CSS at all.

**What would close it:** the same Playwright sweep TASK-DESIGN-018 owns, at 375 / 700 / 800 / 1100 /
1400, asserting the bar is out of the page above `md`, the sidebar is in it, and the content column
stops at 1440. That is one spec file once an e2e harness exists; it does not exist yet, and standing
one up for this task alone would decide TASK-DESIGN-018's harness for it.

## 2. The badge counts are a prop, and nothing fills it

`AppShell` takes `counts` and both navigations render it. Nothing computes it: the follow-up queue
and the WhatsApp inbox have no endpoints in the generated client yet, and the authenticated layout
that would own the query does not exist — every route in the tree today is public. The criterion
says "live badge counts", and what is built is everything up to the wire.

**What would close it:** the authenticated layout, fetching the two counts and passing them down.
The shape they arrive in is already fixed — `NavCounts` is keyed by `NavItemId` — and `countFor`
ignores a number sent for an uncounted destination, so a wrong caller cannot put a badge on Leads.

## 3. `md` is "collapsible" in the specification and is not collapsible here

The table calls the `md` sidebar collapsible, which in every product that has one means a rail of
icons with a toggle. This repo has no icon set — no library chosen, no glyphs drawn — and a rail
that hid its labels for icons that do not exist renders as a column of empty 48px boxes. So the
labels show at every width the sidebar is on screen, and the rail sizes to them until `lg` pins it
to 160px.

That is a deliberate substitution, not an oversight, and it is recorded in ADR-0048. Collapsing is
worth revisiting when there is something to collapse to; if it comes back it also needs a decision
about whether the state is remembered per reader, which the current shape does not have to answer.

## 4. `DesktopOnly` has no consumers, so the constraint on its children is prose

Both halves render and CSS picks one, which means the phone mounts the desktop subtree behind
`display:none` — no layout, no paint, but React still mounts it and its effects still run. For the
three named surfaces (the grid, bulk operations, rule building) that is exactly the kind of subtree
that would fetch on mount, so the phone would pay for a request it can never see the result of.

None of the three exists yet, so there is nothing to test against and no call site to grep. The
constraint is stated in the component's own comment and in ADR-0048: pass markup, not a subtree that
loads. **What would close it:** when the first of the three lands, a test over `DesktopOnly` call
sites in the same style as the shell's `matchMedia` grep — or, better, the honest fix the ADR names,
which is a separate route rather than a hidden subtree.
