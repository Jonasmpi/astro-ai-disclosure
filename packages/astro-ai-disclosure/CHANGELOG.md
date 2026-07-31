# @jonasmpi/astro-ai-disclosure

## 0.1.0

### Minor Changes

- 6725e33: Add build enforcement against direct `astro:assets` imports.

  The integration now registers a Vite plugin that refuses `import { Image }` and `import { Picture }`
  from `astro:assets`, so an unlabelled image cannot reach a page by accident. Aliases
  (`{ Image as Hero }`) and namespace imports (`* as assets`) are caught too.

  `getImage` and `inferRemoteSize` stay allowed — they return image data rather than markup — as do
  type-only imports, which are erased before anything renders.

  Controlled by the existing options: `enforcement: "off" | "warn" | "error"` (default `error`) and
  `exclude: RegExp[]` for files that must be let through. The package's own components are always
  exempt, and third-party code under `node_modules` is never flagged.

  The diagnostic names the offending binding, the file, the replacement components and both escape
  hatches.

- dc6eabc: Add the `AIImage` component.

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

- eca02a0: Accept and validate integration options, and expose them to components.

  `aiDisclosure()` now takes `policy`, `defaultLanguage`, `labels`, `badge.position`, `enforcement` and
  `exclude`. Options are validated when the Astro config is read, so a typo fails immediately with a
  message naming the option, the offending value and the allowed set — rather than being silently
  ignored. `labels` deep-merges over the built-in German and English text, so overriding one string
  keeps the rest.

  The resolved config reaches components through the new `virtual:astro-ai-disclosure/config` module.
  Its ambient type declaration is injected automatically, so no `types` entry is needed in the
  consumer's `tsconfig.json`. `enforcement` and `exclude` stay build-time only.

- b2c8cd6: Add the `AIPicture` component.

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

- c791bb5: Add the AI-disclosure type vocabulary and policy helpers.

  `AIImageKind`, `LegalScope`, `AIDisclosure`, `DisclosurePolicy` and the integration option types are
  available from the package root and from the `./types` subpath. The pure helpers `shouldDisclose()`,
  `resolveLabel()` and `containsAI()`, plus the built-in German and English labels in
  `DEFAULT_LABELS`, are exported from the package root.

  `scope: "review-required"` discloses under both policies: an image nobody has classified yet fails
  safe rather than silently going unlabelled.

### Patch Changes

- 96e8203: Document the package properly for its first release: install and quick start, the `kind` versus
  `scope` distinction, the full policy matrix, an options and props reference, build enforcement,
  styling hooks, accessibility notes and the Article 50 links with the not-legal-advice disclaimer.

  Includes the `MissingSharp` workaround pnpm users need, which is a property of pnpm's isolated
  `node_modules` rather than of this package.
