# `@jonasmpi/astro-ai-disclosure`

Consistent, accessible **AI-disclosure labelling for images in Astro** — built with the transparency
obligations of **EU AI Act Article 50** in mind.

> **Status: early development (pre-`v0.1.0`).** Nothing is published to npm yet. The package is being
> built step by step; expect the API to change until `v0.1.0` is tagged.

## What it will do

- `<AIImage>` / `<AIPicture>` wrappers around `astro:assets` that render a visible, accessible
  disclosure badge from structured AI metadata.
- Central policy configuration via an Astro integration — `eu-article-50` (default) or `all-ai`.
- Build-time enforcement that forbids direct `astro:assets` `<Image>` / `<Picture>` imports.
- Sidecar `.ai.json` metadata with validation and a compliance report (v0.2).
- Optional "baked" labels via a custom Sharp image service, so the label survives downloading the
  image (v0.3).

## Requirements

- Astro `^7.0.0` (peer dependency)
- Node `>=22`
- pnpm `>=10` (this repo is a pnpm workspace)

## Repository layout

```text
packages/astro-ai-disclosure/   the integration package
examples/demo/                  Astro 7 example site (integration test + living documentation)
```

## Local development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Contributions follow a branch-based workflow: one step = one branch = one squash-merged PR, with
Conventional Commits and mandatory unit tests. `main` is protected and always releasable.

## Legal note

This package helps you _declare_ AI involvement consistently. It does not detect AI content, and the
legal texts and policy modes it ships are an **implementation interpretation, not legal advice**.
Assessing whether a specific image falls under Article 50 remains your responsibility.

## License

[MIT](./LICENSE) © [Jonas Szalanczi](https://github.com/Jonasmpi)
