---
"@jonasmpi/astro-ai-disclosure": patch
---

Document that `sizes` must describe the width the image actually renders at, and that overriding the
frame's own `max-width` needs to match the specificity Astro's scoped selector gives it.

No behaviour change. The frame sets `max-width: 100%`, so the rendered width comes from the
surrounding layout; a `sizes` value that disagrees makes the browser fetch an undersized source and
upscale it, with nothing in the build to warn you.
