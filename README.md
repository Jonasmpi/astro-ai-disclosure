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

## Releasing

Versioning and publishing run on [Changesets](https://github.com/changesets/changesets).

1. Any PR with a user-facing change adds a changeset in the same PR:

   ```bash
   pnpm changeset
   ```

   Pick the package, pick patch/minor/major, and describe the change — the text lands in the
   changelog. Tooling-only PRs (CI, lint config) need no changeset.

2. Merging such a PR to `main` makes the release workflow open or update a version PR titled
   `chore: version packages`. It applies the pending changesets: bumps the version, rewrites
   `CHANGELOG.md` and deletes the consumed changeset files.

3. Merging _that_ PR publishes the package to npm and pushes the git tag. No manual `npm publish`.

### One-time setup

| What                        | Where                                               | Why                                                                                                                                             |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN` secret          | Settings → Secrets and variables → Actions          | An npm **automation** token for an account owning the `@jonasmpi` scope. Granular tokens work too, if scoped to read/write this package.        |
| Allow Actions to create PRs | Settings → Actions → General → Workflow permissions | Without it the release workflow cannot open the version PR and fails with `GitHub Actions is not permitted to create or approve pull requests`. |

The token must be an _automation_ token (or a granular token with publishing rights) — a classic
"publish" token with 2FA required will fail in CI, because there is nobody to answer the 2FA prompt.

## Legal note

This package helps you _declare_ AI involvement consistently. It does not detect AI content, and the
legal texts and policy modes it ships are an **implementation interpretation, not legal advice**.
Assessing whether a specific image falls under Article 50 remains your responsibility.

## License

[MIT](./LICENSE) © [Jonas Szalanczi](https://github.com/Jonasmpi)
