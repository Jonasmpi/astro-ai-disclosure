---
"@jonasmpi/astro-ai-disclosure": minor
---

Add the `AIPicture` component.

`AIPicture` wraps `astro:assets` `<Picture>` and inherits its full prop type, so `formats`,
`fallbackFormat` and `pictureAttributes` work alongside the usual optimization options. Disclosure
behaviour is identical to `AIImage`.

```astro
import AIPicture from "@jonasmpi/astro-ai-disclosure/AIPicture.astro";

<AIPicture
  src={photo}
  alt="…"
  formats={["avif", "webp"]}
  ai={{ kind: "generated", scope: "deepfake" }}
/>
```

Both components now render a shared internal frame, so their wrapper element and badge markup are
byte-identical and cannot drift apart.

Two changes to the surface added in the previous release, neither of which has shipped to npm:

- CSS classes are renamed from `ai-image*` to `ai-disclosure*`, since they are no longer specific to
  `AIImage`. Anyone styling the badge should target the new names.
- The `./components` subpath is removed. It exported nothing — `.astro` files cannot be safely
  re-exported from a `.ts` barrel shipped as source — and an empty module in a public API is worse
  than no module. Import the components from `./AIImage.astro` and `./AIPicture.astro`.
