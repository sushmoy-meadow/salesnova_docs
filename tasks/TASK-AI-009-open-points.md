# TASK-AI-009 — open points

Both acceptance criteria are tested. Two things about the review workflow are worth stating, because
neither is enforceable from inside this repository.

## Review is a branch protection rule, not a test

"A prompt change must go through the same review process as a code change" is satisfied by prompts
being files in the repository — they arrive through a pull request like anything else, and the
manifest makes the version change visible in that diff rather than only the paragraph edit.

What this repository cannot assert is that the pull request was actually reviewed. That is a GitHub
branch protection setting on `main`: required reviewers, and no direct pushes. If protection is off,
a prompt can reach production through an unreviewed commit and every test here still passes.

**What would close it:** confirming required-review protection on `main` and recording it wherever the
repository settings are documented. TASK-INFRA-* owns repository configuration; nothing in the
application can check it.

## The prompts themselves are unevaluated

Three prompts exist — lead parsing, message drafting, sequence drafting — written against what each
capability is specified to do. None has been run against a labelled set, so their quality is asserted
by nobody. That is deliberate: SN-AI-033 requires a measured baseline before a capability reaches a
customer, and building the harness is TASK-AI-010, the next task in this chain.

Until then the prompts are reviewed artefacts with correct versioning and no evidence they work.
Nothing calls them yet, so nothing is at risk; the order matters only if a capability ships before
AI-010 lands.

## One prompt per capability

`PromptLibrary` maps a capability to exactly one file. A capability that eventually needs variants —
per language, per industry, an A/B arm — will need a second key, and the version scheme already
carries the slug so two variants cannot collide. Nothing needs a variant today and adding the axis
before there is a second case would be a knob nobody sets.
