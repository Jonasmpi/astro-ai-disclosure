---
"@jonasmpi/astro-ai-disclosure": minor
---

Add sidecar metadata: declare an image once, next to the asset.

Put a `.ai.json` file beside an image and every usage picks it up, with no `ai` prop on the page:

```text
src/assets/hero.webp
src/assets/hero.webp.ai.json
```

```json
{ "kind": "generated", "scope": "deepfake", "provider": "OpenAI", "model": "GPT Image" }
```

The integration scans `srcDir` for sidecars and exposes them as `virtual:ai-image-manifest`, keyed by
each image's absolute source path. An inline `ai` prop still wins — a page may legitimately say
something more specific about one usage.

Sidecars are validated when they are read: an unknown `kind` or `scope`, a misspelled field, a
non-string value or invalid JSON stops the build and names the file. A declaration the author got
wrong is worse than no declaration, so none of it is silently ignored.

Editing a sidecar during `astro dev` takes effect without restarting the server.
