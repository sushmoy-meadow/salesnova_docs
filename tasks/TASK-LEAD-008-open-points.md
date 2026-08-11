# TASK-LEAD-008 open points

## AC-LEAD-010.1 — frontend viewport redirect

The backend query engine and response contract are implemented, but the criterion
requires a browser viewport under lg to redirect /leads/grid to /leads/table
and show a one-time notice. Close this point with a frontend/browser test that
opens the grid route at the narrow viewport and asserts the redirect plus notice.

## Deferred backend filter dependencies

The query endpoint rejects `group_ids`, `stage`, `follow_up_bucket`, sub-team,
custom-field, and saved-filter predicates until their owning schemas/services are
available. Close this point by adding those joins or ports and their query tests.
Phone search currently uses local digit stripping and canonical suffix matching;
replace it with the approved libphonenumber port when that dependency is present.
