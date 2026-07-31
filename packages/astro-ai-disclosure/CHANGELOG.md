# @jonasmpi/astro-ai-disclosure

## 0.6.0

### Minor Changes

- c939820: Add the official EU icon as an opt-in badge glyph.

  Set `badge.icon: "eu"`, or `badgeIcon="eu"` per image, to use the Commission's AI mark in place of
  the built-in "AI" glyph. It renders in overlay mode and is composited into the pixels in baked mode.

  The Commission makes the icons "publicly available for everyone to use freely, without the need for
  attribution", so the mark is bundled — about 1 kB of SVG, embedded as a `data:` URI so its paths
  cannot collide with page styles. Note the Commission's own caveat: using the icons is optional, the
  Article 50 labelling obligations are not.

  Only the basic disc is bundled. The two wordmarks the Commission publishes carry their own text,
  which inside a badge that already shows a label would duplicate it rather than sit in it as a glyph.

## 0.5.0

### Minor Changes

- 2148aaf: Add baked labels via a custom Sharp image service.

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

## 0.4.1

### Patch Changes

- 5562ec7: Document the sidecar workflow, the validation rules and the report format, completing the
  documentation for metadata at scale.

## 0.4.0

### Minor Changes

- 9ce51c9: Emit a compliance report at the end of every build.

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

## 0.3.0

### Minor Changes

- 2648b9b: Validate that images are actually declared.

  Declaring nothing is not the same as declaring no AI. Three rules make the difference enforceable:

  | Rule              | Fires when                                  | dev                    | build   |
  | ----------------- | ------------------------------------------- | ---------------------- | ------- |
  | `missingMetadata` | No inline `ai` prop and no sidecar          | `warn`                 | `error` |
  | `reviewRequired`  | Declaration says `scope: "review-required"` | `error`                | `error` |
  | `remoteImages`    | Remote `src` with no inline `ai`            | error unless `"allow"` | same    |

  `missingMetadata` differs by mode on purpose: an image you have not got round to declaring should not
  interrupt you mid-edit, but it must not reach production. Each rule accepts a bare severity
  (`"off" | "warn" | "error"`) or a per-mode object `{ development, build }`.

  Remote images get their own rule because the fix differs — a sidecar cannot describe a file that is
  not on disk, so the message says to pass an `ai` prop rather than suggesting a sidecar.

  To satisfy the rules for an image with no AI involvement, declare it:
  `ai={{ kind: "none", scope: "not-in-scope" }}`.

## 0.2.0

### Minor Changes

- 58265d1: Add sidecar metadata: declare an image once, next to the asset.

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
