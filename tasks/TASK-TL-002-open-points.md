# TASK-TL-002 — Open points

## PostgreSQL partition verification

The migration creates `timeline_event` as a PostgreSQL range-partitioned table on
`occurred_at` and provisions the current month plus the three-month runway. The feature test
contains both checks, but this checkout uses SQLite, so PostgreSQL-only assertions are skipped.

Close this point by running `tests/Feature/Timeline/TimelineEventSchemaTest.php` against PostgreSQL
and confirming the partition strategy is range (`r`), the partition key is `occurred_at`, and the
current plus three future monthly partitions exist.
