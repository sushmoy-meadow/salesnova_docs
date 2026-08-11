# TASK-DESIGN-005 — open points

Every acceptance criterion has a test behind it. The points below are things this repo cannot close
on its own, or decisions taken here that the next task inherits.

## Cannot be tested here

### A wall cannot yet be driven from a real API failure

`AccessWall` takes a semantic `kind`, and `accessWallKindFor(status)` maps `403 | 423 | 425` onto it.
Nothing can call that mapper today: `postEnvelope` in `src/lib/auth/api-envelope.ts` discards
`response.status` and `ApiFailure` has no field for it. So the wire → wall path is proved only from
`accessWallKindFor` inwards, never end to end.

**What would close it:** `ApiFailure` gains the status (or a semantic denial code) and the query
error mapper calls `accessWallKindFor`. That file is being edited by the signup work in the same
working tree, so it was left alone here rather than merged blind.

### `trace_id` has no source

`ErrorState` renders a selectable trace id and the criterion is met at the component. But
`05-api-design.md` puts `trace_id` on every error response and `failureSchema` does not parse it, so
no caller can supply a real one.

**What would close it:** `trace_id: z.string().optional()` on `failureSchema` and `traceId?: string`
on `ApiFailure`. Same file, same reason for leaving it.

### The skeleton does not match the shape it stands in for

`SN-DS-042` wants zero layout shift, which means the skeleton matching the final layout.
`LoadingState` renders a fixed number of equal bars and cannot know the target shape.

**What would close it:** TASK-DESIGN-006 owns skeleton parity; the shape should arrive as a prop and
be asserted against a rendered reference rather than a count of placeholder rows.

### Selection of the trace id is not asserted

`select-all` makes the trace id one-click selectable. A jsdom test can only assert the class name,
which proves nothing about selectability and breaks if the utility is renamed, so the assertion was
dropped. Real coverage is a browser test that selects the node and reads the selection.

### Nothing renders a transition yet

The overlay mounts in its final state, so the 200ms sheet/modal transition of `SN-DS-050` is not
implemented — the classes that implied it were removed rather than left reading as if it were done.
A sheet does not yet show where it came from.

**What would close it:** TASK-DESIGN-012, which owns the motion system.

## Decided here

- **`degraded` and `denied`, not `partial-degraded` and `permission-denied`.** The spec's names are
  longer and one of them is wrong: `denied` covers permission, plan *and* flag, where
  `permission-denied` names only the first. Grepping the spec identifier will not find the code.
- **`animate-pulse` stays, at 2s.** `SN-DS-050` caps motion at 300ms and `SN-DS-051` forbids
  decorative loops. A skeleton shimmer is feedback that something is still coming, not decoration,
  and a 300ms pulse would read as a flicker. `motion-reduce:animate-none` covers the users for whom
  it is a problem. Worth confirming when the motion system lands.
- **`ErrorState` requires its retry**, reversing ADR-0037. Reasoning in ADR-0038.
- **`AccordionItem.content` stays a `ReactNode`, not a thunk.** A thunk would let the accordion skip
  building collapsed panels, which is a real saving for panels holding tables. It would also stop
  any Server Component from rendering an accordion, for the same reason `TableColumn` carries a
  `field` name beside `render`. The boundary is worth more than the saving.

## Not done, deliberately

The following belong to files another session holds uncommitted, and were left rather than merged
blind:

- Eight call sites hand-roll the primary CTA class chain that `ActionControl` now owns
  (`src/app/error.tsx`, `not-found.tsx`, `page.tsx`, `src/components/invite/*`,
  `src/components/signup/*`). Four are convertible now; the four form buttons need the real `Button`
  primitive, which does not exist yet.
- `SignupNotice` is `Banner tone="danger"` with different padding.
- `ConnectivityBanner`, `StaleDataIndicator` and `PendingSyncIndicator` each render a warning their
  own way, and the design system now owns what a warning notice looks like. Only `ConnectivityBanner`
  is a `Banner`; the other two are waiting on `Toast` and `Badge`.

## Owed by the first screen that consumes this

- A `dataSurfaceStateFrom({ query, filters, failure })` mapper. Nothing in `src/` builds a
  `DataSurfaceState` today, so its real inputs are not yet known and it was not written on spec.
- `useListUrlState` has no `clearFilters()`, which `EmptyFilteredState` and the contracted
  `FilterBar` both want.
- `DegradedNotice` and `StaleDataIndicator` say the same thing two ways; a screen using
  `useOfflineRead` currently has no guidance on which to reach for.
- `Overlay` renders its backdrop in place rather than through a portal. Any ancestor with
  `transform`, `filter` or `contain` re-parents the containing block and clips it. No such ancestor
  exists yet.
