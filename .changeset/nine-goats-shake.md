---
"@jonasmpi/astro-ai-disclosure": minor
---

Emit a compliance report at the end of every build.

`dist/ai-image-disclosure-report.json` lists every image the build rendered — kind, scope, provider,
model, whether a badge was shown, under which policy, and on which pages — alongside a console
summary.

Entries are grouped by image **and declaration**, not by image alone. The same asset can legitimately
be declared differently in different contexts, and a report that kept only the first would state
something the site does not actually say. Images carrying more than one declaration are listed under
`summary.conflicting` so a reviewer can decide whether the difference is intended.

The summary also lists `undeclared` and `awaitingReview` images. Entries are sorted, so repeated
builds of the same site produce identical files and the report can be committed or diffed as
evidence.
