# TASK-SEC-009 — open points

Both acceptance criteria are tested. Two gaps in the coverage are worth stating rather than leaving
to be discovered.

## Endpoints that declare no input are not covered

`StrictFormRequest` compares a payload against a rule set. An endpoint that reads nothing has no
rule set — `GET members/{membership}/capabilities` takes its argument from the path — so an unknown
query parameter there is ignored exactly as it was before this task.

That is the smaller half of the risk: the parameter reaches no validator and no query, so it is
inert. It is still a place where the server accepts something it does not read.

**What would close it:** the first list endpoint brings a filter layer, and that layer declares its
own allowlist of sortable and filterable keys — at which point the same refusal applies to query
strings on endpoints with no body. Doing it now would mean writing an allowlist with no filters to
list.

## "CI fails on a deliberately introduced query in a test PR" is asserted, not performed

The criterion names an experiment: open a pull request with a concatenated query and watch the build
go red. What is automated here is both halves of that, separately — `ConcatenatedSqlScannerTest`
feeds the scanner ten shapes of concatenated SQL and asserts each is caught, and asserts that
`.github/workflows/ci.yml` runs `scripts/check-concatenated-sql.php` as its own step.

Those two together are the mechanism the experiment would exercise. What they do not prove is that
the workflow file is syntactically valid and the step actually executes on GitHub, which only a real
run can show.

**What would close it:** the next pull request that touches anything. The step runs on every PR, so
the first green build after this merges is the confirmation — and a red one on a branch with a
deliberate `whereRaw("id = $id")` is a two-minute check anybody can do by hand.

## The scanner reads shapes, not intent

It flags a variable in a raw sink's first argument. It cannot tell a variable holding user input
from one holding a constant defined three lines above, so it refuses both, and the `@builds-schema`
declaration is the release valve for the cases where refusing is wrong.

That trade is deliberate — a scanner that tried to trace where a variable came from would be a
static analyser, and one that guessed would be worse than none. But it does mean the exemption is
the thing to watch: it is file-scoped, and a file that acquires a query later inherits a weaker rule
for `statement()` than it should have.

**What would close it:** if the exemption list grows past a handful of files, narrow it from
file-scoped to call-scoped — an annotation on the line rather than in the docblock. Seven files did
not justify that today.
