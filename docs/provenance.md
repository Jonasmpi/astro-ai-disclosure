# Machine-readable provenance (C2PA): findings and decision

**Status: rejected for now — no code shipped.** Revisit if Astro gains metadata-preserving
transforms or a signing story.

Investigated 2026-07-31 against Astro 7.1.6, Sharp 0.35.3 / libvips 8.18.3.

## The question

The visible badge this package renders is a claim a human can read. A machine-readable provenance
standard — [C2PA](https://c2pa.org/) — makes the same claim verifiable: a signed manifest, embedded
in the file, asserting who made the image and how. Could the package preserve or recreate one
through Astro's image pipeline?

## What the evidence shows

### 1. Astro already discards all metadata

Every image in the demo's build output, produced by Astro's stock Sharp service with no involvement
from this package:

```text
abstract-ai-visual._KC5yJPY_Z1gHs8U.webp   exif=false  xmp=false  icc=false
lakeside-terrace.CAo32R7x_1PqvdU.webp      exif=false  xmp=false  icc=false
```

Sharp strips metadata on re-encode unless asked not to:

```text
original                        exif=true   xmp=true
sharp resize (defaults)         exif=false  xmp=false
sharp resize + keepMetadata()   exif=true   xmp=true
our bakeBadge()                 exif=false  xmp=false
```

So provenance is already gone in a stock Astro site, before this package is involved. Our baked
transform behaves the same way as Astro's own.

### 2. Sharp cannot carry a C2PA manifest even if asked

C2PA manifests live in JUMBF boxes, not in EXIF or XMP. Sharp's metadata surface is:

```text
keepExif, keepGainMap, keepIccProfile, keepMetadata, keepXmp,
withDensity, withExif, withExifMerge, withGainMap, withIccProfile, withXmp
```

There is no JUMBF or C2PA support at any level. `keepMetadata()` preserves EXIF, XMP, IPTC and ICC —
not a manifest libvips never parsed.

### 3. Optimization invalidates the manifest anyway

This is the decisive point, and it is not about metadata handling at all. A C2PA manifest contains a
hash of the pixel data. Resizing one of the demo photographs to 960px and encoding it as WebP — the
ordinary thing Astro does to every image — changes **85.9 %** of the pixel bytes:

```text
original           sha256: 90c9c4f84a3eb043
after astro resize sha256: 0a897fb473841c13
```

Any hash-based assertion over those pixels fails. Preserving the manifest byte-for-byte would
therefore be worse than dropping it: the file would carry a manifest that every validator rejects,
which reads as tampering rather than as absence.

This applies to **every** responsive variant Astro generates, whether or not this package bakes a
badge into it. Baked mode is not the obstacle.

## Why re-signing is not a way out

The manifest could in principle be regenerated per variant, asserting "derived from X, resized by
Astro". That requires signing, and signing requires an identity:

- A signing certificate would have to live in CI, as a long-lived secret — the opposite of the
  direction this project took for npm publishing, which uses short-lived OIDC precisely to avoid
  storing credentials.
- A self-signed manifest is not a neutral outcome. Most validators surface it as untrusted, and an
  untrusted claim about AI provenance is worse than a clear visible label plus no claim.
- Correct C2PA assertions describe _what happened to the image_. This package knows what the author
  **declared**, not what a generator actually did. Signing a declaration as though it were an
  observation would misrepresent the evidence — the same reason `kind` and `scope` are recorded
  rather than inferred.

## Decision

**Reject** for the foreseeable future. Do not preserve, forge, or re-sign C2PA manifests.

Nothing about this weakens the package's actual claim. What it offers is a visible, accessible label
plus a machine-readable declaration in the markup:

- `data-ai-*` attributes on every image, present whether or not a badge is shown
- `dist/ai-image-disclosure-report.json`, a sorted, diffable record of what the site declares
- a baked label that survives the file leaving the page

That is an honest account of what the author asserted. It does not pretend to be cryptographic proof
of what a model did, which is what C2PA exists to provide and what this pipeline cannot deliver.

## What would change the answer

- Sharp or libvips gaining JUMBF support **and** Astro exposing a metadata-preserving transform.
- A C2PA profile for derived renditions that binds to the original asset rather than to the
  delivered pixels, making per-variant re-signing unnecessary.
- The consumer holding their own signing identity and wanting the package to call out to it — a
  plausible future opt-in, but a different feature from anything here.

## Behaviour pinned by tests

`test/provenance.test.ts` asserts the current behaviour so it cannot drift unnoticed: metadata is
stripped by the baked transform, exactly as Astro's own service strips it. Should that ever change,
the test fails and this document gets revisited rather than quietly becoming wrong.
