# `@jonasmpi/astro-ai-disclosure`

Consistent, accessible **AI-disclosure labelling for images in Astro** — built with the transparency
obligations of **EU AI Act Article 50** in mind.

> ## ⚠️ Pre-release — not usable yet
>
> This version is a **placeholder**. It registers an Astro integration that does nothing: there are
> no components, no configuration and no disclosure badge yet. It exists so the package name is
> reserved and the release pipeline can be verified end to end.
>
> Wait for **`v0.1.0`** before installing this for real.

## What it will do

- `<AIImage>` / `<AIPicture>` wrappers around `astro:assets` that render a visible, accessible
  disclosure badge from structured AI metadata.
- Central policy configuration — `eu-article-50` (default) or `all-ai`.
- Build-time enforcement that forbids direct `astro:assets` `<Image>` / `<Picture>` imports.
- Sidecar `.ai.json` metadata with validation and a compliance report (v0.2).
- Optional "baked" labels via a custom Sharp image service, so the label survives downloading the
  image (v0.3).

## Requirements

- Astro `^7.0.0` (peer dependency)
- Node `>=22`

## Legal note

This package helps you _declare_ AI involvement consistently. It does not detect AI content, and the
legal texts and policy modes it ships are an **implementation interpretation, not legal advice**.
Assessing whether a specific image falls under Article 50 remains your responsibility.

## Links

- [Source, issues and full documentation](https://github.com/Jonasmpi/astro-ai-disclosure)
- [Changelog](https://github.com/Jonasmpi/astro-ai-disclosure/blob/main/packages/astro-ai-disclosure/CHANGELOG.md)

## License

[MIT](./LICENSE) © [Jonas Szalanczi](https://github.com/Jonasmpi)
