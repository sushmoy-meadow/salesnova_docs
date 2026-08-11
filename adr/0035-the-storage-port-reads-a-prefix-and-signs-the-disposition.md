# ADR-0035 — The storage port reads a prefix, and the disposition is signed rather than requested

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Uploads go direct to storage: the client asks for a signed URL, PUTs the bytes at the bucket, and
registers the key afterwards. The API never sees the file. That is deliberate — proxying bytes
through PHP costs a worker for the length of a mobile upload — but it leaves two guarantees with
nowhere obvious to live.

The first is that a file is what it says it is. A name and a content type are both set by whoever
is uploading, so `payload.exe` renamed to `photo.png` and declared `image/png` satisfies every
check that only reads the request. The one thing that cannot be forged is the file's leading bytes,
and at signing time those do not exist yet.

The second is that an uploaded file, once served, cannot run as the application. A PDF opened
inline carries a scripting engine; an HTML file opened inline is a same-origin script. Both are
harmless from a host that holds nothing and dangerous from the host that holds the session.

The storage port as first drafted made both impossible to satisfy. It exposed presigned upload,
presigned download and delete, and its docblock said in as many words that nothing returns bytes —
the reasoning being that a bucket readable without a signature is one nobody notices is public.

## Decision

**The port gains a bounded `readPrefix($key, $bytes)`, and `presignedDownloadUrl` takes the
content disposition as an argument that is signed into the URL.**

`readPrefix` returns the first bytes of an object to the application. It is not a hole in the
original reasoning: the object stays unreadable without a signature, the read is answered to the
server rather than to a caller, and sixteen bytes is not a download. Verifying a declared type
against the file is not possible without looking at the file, and the alternative — trusting the
declaration — is the thing being defended against.

The disposition is an argument rather than a response header because on S3 it is
`response-content-disposition`, a query parameter inside the signature. A URL minted with
`attachment` cannot be edited into one that renders; a URL minted without it can have any
disposition appended by whoever holds the link. Deciding it at signing time is what makes it
binding.

Two rules sit on top. Anything not on a short renderable list — images only — downloads rather
than opens, PDF included. And a presigned URL whose host is the application's own is refused
outright rather than returned, because a rewrite would void the signature and serving assets from
the session's origin is the condition the disposition was defending against.

## Consequences

An adapter has one more method to implement and a parameter to sign, and a deployment that points
storage at the application host fails loudly at the first download instead of quietly serving
assets same-origin.

Verification is split across two moments, which is the honest shape: the name, the type and the
size are judged before a byte moves, so a rejected upload costs the user nothing, and the bytes are
judged when they exist. A caller that registers a key without asking for the second check gets no
protection from it — the guard is a service, not a middleware, and wiring it into the registration
path is the endpoint's job.

Formats that lead with nothing distinctive — CSV, plain text — can only be checked negatively: they
are admitted unless the bytes are recognisably some other format. The extension allowlist and the
attachment disposition carry the risk that leaves.
