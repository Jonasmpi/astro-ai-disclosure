---
"@jonasmpi/astro-ai-disclosure": minor
---

Add the `AIImage` component.

`AIImage` wraps `astro:assets` `<Image>` and inherits its full prop type, so `widths`, `sizes`,
`format`, `quality` and the rest keep working. When the policy calls for it, it renders an accessible
disclosure badge — `role="note"` with an `aria-label`, a decorative AI glyph hidden from assistive
technology, four corner positions and a `forced-colors` fallback.

```astro
import AIImage from "@jonasmpi/astro-ai-disclosure/AIImage.astro";

<AIImage src={photo} alt="…" ai={{ kind: "generated", scope: "deepfake" }} />
```

`policy`, `language` and `badgePosition` props override the central configuration per image. The
declaration is always mirrored onto the wrapper as `data-ai-*` attributes, **including when no badge
is shown** — withholding a visible label does not withhold the declaration.

`provider` and `model` are not part of the badge's accessible name; they would need untranslated
prefixes and would lengthen the screen-reader announcement. They remain available as `data-ai-*`.
