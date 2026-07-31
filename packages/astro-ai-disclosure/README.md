# `@jonasmpi/astro-ai-disclosure`

Consistent, accessible **AI-disclosure labelling for images in Astro** — built with the transparency
obligations of **EU AI Act Article 50** in mind.

You record what AI did to an image. The package decides whether that needs a visible label, renders
an accessible badge when it does, and stops an unlabelled image reaching a page by accident.

> **Not yet on npm.** Publishing is pending; until then, see
> [the repository](https://github.com/Jonasmpi/astro-ai-disclosure) for how to try it from source.

## Install

```bash
pnpm add @jonasmpi/astro-ai-disclosure
# or
npx astro add @jonasmpi/astro-ai-disclosure
```

```ts
// astro.config.ts
import aiDisclosure from "@jonasmpi/astro-ai-disclosure";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [aiDisclosure()],
});
```

Requires **Astro `^7.0.0`** and **Node `>=22`**.

> **pnpm users:** Astro's image optimization needs `sharp`, and pnpm's isolated `node_modules` stops
> Astro reaching its own bundled copy. If the build fails with `MissingSharp`, add it explicitly:
> `pnpm add -D sharp`.

## Quick start

```astro
---
import AIImage from "@jonasmpi/astro-ai-disclosure/AIImage.astro";
import hero from "../assets/hero.jpg";
---

<AIImage
  src={hero}
  alt="A monitored mining operation"
  widths={[640, 960, 1440]}
  sizes="(max-width: 768px) 100vw, 1200px"
  ai={{ kind: "generated", scope: "deepfake", provider: "OpenAI", model: "GPT Image" }}
/>
```

`AIImage` wraps `astro:assets` `<Image>` and inherits its full prop type, so every optimization
option keeps working. `AIPicture` does the same for `<Picture>`.

## The two axes: `kind` and `scope`

These are deliberately separate, and collapsing them into a single `isAI` boolean is the mistake this
package exists to prevent. An image can be entirely AI-generated without attracting the same
obligation as a deepfake.

**`kind` — what AI actually did (technical):**

| Value       | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `none`      | No AI involvement. An explicit declaration, not an absence. |
| `assisted`  | Ordinary AI-supported editing — denoise, colour correction. |
| `modified`  | An existing image materially altered by AI.                 |
| `generated` | Synthesised by an AI system.                                |

**`scope` — how it is classified for disclosure (a judgement you record):**

| Value             | Meaning                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| `not-in-scope`    | No visible label required.                                                      |
| `deepfake`        | Resembles a real person, place, entity or event closely enough to seem genuine. |
| `creative-work`   | Part of an evidently artistic or fictional work.                                |
| `review-required` | Not yet assessed.                                                               |

The package never infers either value. It only acts on what you declare.

## Policy modes

```ts
aiDisclosure({ policy: "eu-article-50" }); // default
aiDisclosure({ policy: "all-ai" }); // recommended for organisation-wide consistency
```

| `kind`                                | `scope`           | `eu-article-50` | `all-ai`  |
| ------------------------------------- | ----------------- | --------------- | --------- |
| `none`                                | any               | no badge        | no badge  |
| `assisted` / `modified` / `generated` | `not-in-scope`    | no badge        | **badge** |
| `assisted` / `modified` / `generated` | `deepfake`        | **badge**       | **badge** |
| `assisted` / `modified` / `generated` | `creative-work`   | **badge**       | **badge** |
| `assisted` / `modified` / `generated` | `review-required` | **badge**       | **badge** |

`review-required` discloses under both policies on purpose: "nobody has classified this yet" is not
the same as "not in scope", and staying silent risks missing an obligation while labelling only
restates what `kind` already declares.

## The three canonical cases

**In scope — badge under both policies.** A photorealistic synthetic image that could be taken for a
real scene:

```astro
<AIImage
  src={miningSite}
  alt="A monitored mining operation"
  ai={{ kind: "generated", scope: "deepfake", provider: "OpenAI", model: "GPT Image" }}
/>
```

**Voluntary labelling — badge only under `all-ai`.** A clearly fictional illustration that nobody
would mistake for a photograph:

```astro
<AIImage
  src={abstractVisual}
  alt="Abstract illustration of an industrial AI system"
  ai={{ kind: "generated", scope: "not-in-scope", provider: "OpenAI" }}
/>
```

**Ordinary editing — no badge under `eu-article-50`.** A real photograph with routine retouching:

```astro
<AIImage
  src={teamPhoto}
  alt="The team"
  ai={{ kind: "assisted", scope: "not-in-scope", description: "Colour correction" }}
/>
```

In all three the declaration is written into the markup as `data-ai-*` attributes, **even when no
badge is shown** — withholding a visible label does not withhold the declaration.

## Options

```ts
aiDisclosure({
  policy: "all-ai",
  defaultLanguage: "de",
  labels: { de: { generated: "Von KI erzeugt" } },
  badge: { position: "top-left" },
  enforcement: "error",
  exclude: [/legacy/],
});
```

| Option            | Type                                                           | Default                                   | Notes                                            |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `policy`          | `"eu-article-50" \| "all-ai"`                                  | `"eu-article-50"`                         | Which declarations get a visible label.          |
| `defaultLanguage` | `"de" \| "en"`                                                 | `"en"`                                    | Language for the built-in labels.                |
| `labels`          | `{ de?: {…}, en?: {…} }`                                       | built-ins                                 | Deep-merged; override one string, keep the rest. |
| `badge.position`  | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"bottom-right"`                          | Badge corner.                                    |
| `enforcement`     | `"off" \| "warn" \| "error"`                                   | `"error"`                                 | See below.                                       |
| `exclude`         | `RegExp[]`                                                     | `[]`                                      | Files exempt from enforcement.                   |
| `missingMetadata` | severity, or `{ development?, build? }`                        | `{ development: "warn", build: "error" }` | Image with no declaration at all.                |
| `reviewRequired`  | severity, or `{ development?, build? }`                        | `"error"`                                 | Declaration still says `review-required`.        |
| `remoteImages`    | `"allow" \| "require-explicit-metadata"`                       | `"require-explicit-metadata"`             | Remote `src` with no inline `ai`.                |

Options are validated when the Astro config is read, so a typo fails immediately with a message
naming the option, the value received and the allowed set — rather than being silently ignored.

Built-in labels:

| `kind`      | `en`         | `de`                 |
| ----------- | ------------ | -------------------- |
| `generated` | AI-generated | KI-generiert         |
| `modified`  | AI-modified  | Mit KI verändert     |
| `assisted`  | AI-assisted  | Mit KI-Unterstützung |

## Component props

Both components accept everything their `astro:assets` counterpart does, plus:

| Prop            | Type               | Notes                                              |
| --------------- | ------------------ | -------------------------------------------------- |
| `ai`            | `AIDisclosure`     | The declaration. Omitted means "nothing declared". |
| `policy`        | `DisclosurePolicy` | Overrides the configured policy for this image.    |
| `language`      | `Language`         | Overrides the configured language.                 |
| `badgePosition` | `BadgePosition`    | Overrides the configured corner.                   |

`AIDisclosure` fields: `kind` and `scope` (both required), plus optional `provider`, `model`,
`createdAt`, `description` and `label`. A `label` overrides the generated badge text.

## Sidecar metadata

Declaring an image on every usage gets repetitive. Put a `.ai.json` next to the asset instead and
every usage picks it up:

```text
src/assets/hero.webp
src/assets/hero.webp.ai.json
```

```json
{ "kind": "generated", "scope": "deepfake", "provider": "OpenAI", "model": "GPT Image" }
```

```astro
<AIImage src={hero} alt="…" />
<!-- no ai prop needed -->
```

An inline `ai` prop still wins, so a page can say something more specific about one usage. Sidecars
are matched to images by absolute source path, so `blog/hero.jpg` and `about/hero.jpg` keep separate
declarations. Editing one during `astro dev` takes effect without a restart.

A malformed sidecar — unknown `kind` or `scope`, a misspelled field, invalid JSON — stops the build
and names the file. A declaration the author got wrong is worse than none.

## Validation

Declaring nothing is not the same as declaring no AI, and these rules keep the difference honest:

| Rule              | Fires when                                  | dev     | build                  |
| ----------------- | ------------------------------------------- | ------- | ---------------------- |
| `missingMetadata` | No inline `ai` prop and no sidecar          | `warn`  | `error`                |
| `reviewRequired`  | Declaration says `scope: "review-required"` | `error` | `error`                |
| `remoteImages`    | Remote `src` with no inline `ai`            | \-      | error unless `"allow"` |

`missingMetadata` differs by mode deliberately: an image you have not got round to declaring should
not interrupt you mid-edit, but it must not reach production. Each rule takes a bare severity or a
per-mode object:

```ts
aiDisclosure({
  missingMetadata: { development: "warn", build: "error" }, // the default
  reviewRequired: "error",
  remoteImages: "require-explicit-metadata",
});
```

To satisfy the rule for an image with no AI involvement, say so:

```astro
<AIImage src={photo} alt="…" ai={{ kind: "none", scope: "not-in-scope" }} />
```

Remote images get their own rule because the fix differs — a sidecar cannot describe a file that is
not on disk, so the metadata has to be inline.

## Compliance report

Every build writes `dist/ai-image-disclosure-report.json` and prints a summary:

```text
AI disclosure: 3 image(s), 11 declaration(s), 14 usage(s), 9 labelled
  kind: assisted=4, generated=6, none=1
  scope: creative-work=2, deepfake=3, not-in-scope=6
  report: ai-image-disclosure-report.json
```

Each entry records one image **and one declaration** — the same asset declared differently on
different pages produces separate entries, each listing the pages it appears on:

```json
{
  "image": "/…/src/assets/hero.webp",
  "kind": "generated",
  "scope": "deepfake",
  "provider": "OpenAI",
  "badge": true,
  "policy": "eu-article-50",
  "pages": ["/", "/about/"],
  "usages": 2
}
```

The summary counts by kind and scope and lists anything needing attention: `undeclared`,
`awaitingReview`, and `conflicting` — images declared more than one way, which may be deliberate but
is worth a look.

Entries are sorted, so two builds of the same site produce identical files and the report can be
committed or diffed as compliance evidence.

## Build enforcement

Direct `astro:assets` imports are refused, so an unlabelled image cannot reach a page by accident:

```
[@jonasmpi/astro-ai-disclosure] Direct astro:assets imports are not allowed: `Image`.

Images must go through this package so their AI-disclosure metadata is handled consistently:
  import AIImage from "@jonasmpi/astro-ai-disclosure/AIImage.astro";
```

Caught: `Image`, `Picture`, aliases (`{ Image as Hero }`) and namespace imports (`* as assets`).
Allowed: `getImage` and `inferRemoteSize` (they return data, not markup), type-only imports, and
anything matching `exclude`.

Set `enforcement: "warn"` while migrating an existing site, or `"off"` to disable it.

## Styling

The badge is plain markup with stable class names:

```css
.ai-disclosure {
} /* wrapper, also carries the data-ai-* attributes */
.ai-disclosure__badge {
} /* the badge itself */
.ai-disclosure__symbol {
} /* the "AI" glyph */
.ai-disclosure--top-left {
} /* one per corner */
```

The wrapper carries `data-ai-kind`, `data-ai-scope` and, when provided, `data-ai-provider`,
`data-ai-model` and `data-ai-created-at` — useful for auditing what a built site actually declares:

```bash
grep -o 'data-ai-kind="[^"]*"' dist/**/*.html | sort | uniq -c
```

## Accessibility

The badge is a `role="note"` with an `aria-label` combining the visible label and your `description`.
The decorative "AI" glyph is `aria-hidden`. `provider` and `model` are deliberately left out of the
accessible name — they would need prefixes no label set translates, and a screen-reader name should
stay short. Both remain available as `data-ai-*`. A `forced-colors` fallback keeps the badge legible
in high-contrast mode.

## Legal note

This package helps you _declare_ AI involvement consistently and label it legibly. It does not detect
AI content, and it cannot tell you whether a given image falls under Article 50 — that judgement is
yours, recorded in `scope`.

The policy modes and label texts are an **implementation interpretation, not legal advice**.

- [Guidelines on transparency obligations](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
- [Article 50 FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [EU icons for labelling AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content)

## Links

- [Source, issues and full documentation](https://github.com/Jonasmpi/astro-ai-disclosure)
- [Changelog](https://github.com/Jonasmpi/astro-ai-disclosure/blob/main/packages/astro-ai-disclosure/CHANGELOG.md)

## License

[MIT](./LICENSE) © [Jonas Szalanczi](https://github.com/Jonasmpi)
