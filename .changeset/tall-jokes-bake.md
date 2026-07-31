---
"@jonasmpi/astro-ai-disclosure": minor
---

Add baked labels via a custom Sharp image service.

An overlay badge is CSS over the image and disappears the moment the file is downloaded. Baked mode
composites the label into the pixels instead:

```ts
export default defineConfig({
  image: { service: { entrypoint: "@jonasmpi/astro-ai-disclosure/image-service" } },
  integrations: [aiDisclosure({ badge: { mode: "baked" } })],
});
```

Selectable per image with `badgeMode="baked"`. The service wraps Astro's Sharp service, so images
without a baked label pass through untouched, and the label is drawn once per responsive width,
scaled to the variant it sits on.

Baked mode requires this image service — external providers cannot composite — produces a separate
cached file per labelled variant, and always places the label bottom-right regardless of
`badgePosition`. `sharp` is an optional peer dependency.
