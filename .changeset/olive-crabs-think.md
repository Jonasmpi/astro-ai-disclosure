---
"@jonasmpi/astro-ai-disclosure": patch
---

Document why the package does not emit or preserve C2PA provenance manifests.

A manifest hashes the pixel data, and Astro's ordinary resizing rewrites most of it — measured at
85.9% of pixel bytes for one of the demo photographs — so a preserved manifest would fail every
validator, reading as tampering rather than as absence. Sharp has no JUMBF support at any level, and
re-signing per variant would require a signing certificate in CI plus a claim about what a model
actually did, which this package cannot honestly make from a declaration.

No behaviour changes. Tests now pin the facts the decision rests on, so it cannot quietly go stale.
