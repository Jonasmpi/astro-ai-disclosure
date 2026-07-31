# `@jonasmpi/astro-ai-disclosure`

Consistent, accessible **AI-disclosure labelling for images in Astro** — built with the transparency
obligations of **EU AI Act Article 50** in mind.

You record what AI did to an image. The package decides whether that needs a visible label, renders
an accessible badge when it does, and stops an unlabelled image reaching a page by accident.

> **Status: pre-release, `v0.4.0` in the repository.** Components, policy modes, build enforcement,
> sidecar metadata, validation rules and the compliance report are all implemented, covered by 314
> tests. Publishing to npm is waiting on the npm account — see [Releasing](#releasing).

```astro
---
import AIImage from "@jonasmpi/astro-ai-disclosure/AIImage.astro";
import hero from "../assets/hero.jpg";
---

<AIImage
  src={hero}
  alt="A monitored mining operation"
  widths={[640, 960, 1440]}
  ai={{ kind: "generated", scope: "deepfake", provider: "OpenAI" }}
/>
```

## Documentation

**[Full documentation is in the package README](./packages/astro-ai-disclosure/README.md)** —
install, options reference, component props, the policy matrix, styling and accessibility.

In short:

- `<AIImage>` / `<AIPicture>` wrap `astro:assets` and inherit their full prop types.
- `kind` (what AI did) is kept separate from `scope` (how it is classified). Collapsing them into
  one boolean is the mistake this package exists to prevent.
- Two policy modes: `eu-article-50` (default) labels only what is declared in scope; `all-ai` labels
  any declared AI involvement.
- **Sidecars:** a `.ai.json` next to an asset declares it once for every usage. Matched by absolute
  source path, so same-named images in different folders keep their own declarations.
- **Validation:** an undeclared image warns in dev and fails the build; `review-required` always
  fails; a remote image needs inline metadata, since no sidecar can describe it.
- **Compliance report:** every build writes `dist/ai-image-disclosure-report.json` listing each
  image, its declaration, whether a badge was shown and on which pages.
- Direct `astro:assets` `Image` / `Picture` imports fail the build.
- German and English labels built in; `labels` deep-merges over them.

## Repository layout

```text
packages/astro-ai-disclosure/   the integration package
examples/demo/                  Astro 7 example site — integration test and living documentation
```

The demo has a page per feature and its build doubles as the package's integration test. It is also
the only place the enforcement plugin is exercised against a real Astro build.

## Local development

```bash
pnpm install
pnpm lint          # eslint
pnpm format:check  # prettier
pnpm typecheck     # tsc for the package, astro check for the demo
pnpm test          # vitest, including Astro Container API render tests
pnpm build         # package (tsup) then demo (astro build)

pnpm --filter demo dev
```

Requires Node `>=22` and pnpm `>=10`.

`pnpm test` alone is not a sufficient gate — esbuild strips types without checking them, so several
real errors in this repo were caught only by `pnpm typecheck`. CI runs the full sequence.

## Contributing

One change = one branch = one squash-merged PR, with [Conventional
Commits](https://www.conventionalcommits.org/). `main` is protected and always releasable.

Any PR that adds or changes logic must add Vitest tests for it in the same PR. Component rendering is
covered through the Astro Container API and by asserting against the built demo's HTML.

## Releasing

Versioning and publishing run on [Changesets](https://github.com/changesets/changesets).

1. A PR with a user-facing change adds a changeset:

   ```bash
   pnpm changeset
   ```

   Pick patch/minor/major and describe the change — the text becomes the changelog entry.
   Tooling-only PRs need no changeset.

2. Merging to `main` makes the release workflow open or update a version PR titled
   `chore: version packages`, which applies the pending changesets: bumps the version, rewrites
   `CHANGELOG.md`, deletes the consumed changeset files.

3. Merging _that_ PR publishes to npm and pushes the tag — once publishing is enabled.

### Publishing is currently disabled

The release workflow's publish step is gated on the `NPM_PUBLISH_ENABLED` repository variable, which
is not set. Until it is, the workflow only maintains the version PR: version bumps and changelog
entries accumulate in the repository and go out together later. A useful side effect is that the
first npm release will be a real version rather than a `0.0.0` placeholder.

To enable it, once:

```bash
npm login
cd packages/astro-ai-disclosure
npm publish --access public      # creates the package on npm
```

Then configure the trusted publisher on npmjs.com (repository `Jonasmpi/astro-ai-disclosure`,
workflow `release.yml`) — it requires the package to exist, which is why the first publish is manual
— and set `NPM_PUBLISH_ENABLED` to `true` under Settings → Secrets and variables → Actions →
Variables. Publishing uses npm trusted publishing (OIDC), so no npm token is stored in this
repository.

GitHub Settings → Actions → General must also allow Actions to create pull requests, or the release
workflow cannot open the version PR.

## Design notes

- [Machine-readable provenance (C2PA)](./docs/provenance.md) — why the package does not preserve or
  re-sign C2PA manifests, with the measurements behind that decision.

## Legal note

This package helps you _declare_ AI involvement consistently. It does not detect AI content, and the
policy modes and label texts it ships are an **implementation interpretation, not legal advice**.
Whether a specific image falls under Article 50 remains your judgement, recorded in `scope`.

## License

[MIT](./LICENSE) © [Jonas Szalanczi](https://github.com/Jonasmpi)
