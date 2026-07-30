import { getViteConfig } from "astro/config";
import type { ViteUserConfig } from "vitest/config";

import { resolveOptions, toVirtualConfig } from "./src/options";
import { virtualConfigPlugin } from "./src/virtual-config";

/**
 * `getViteConfig` gives the tests Astro's own Vite setup, so `.astro` files
 * compile and `astro:assets` resolves — without it the Container API tests
 * cannot import a component.
 *
 * The virtual config plugin is registered with deliberately non-default options,
 * because outside a real Astro build nothing else provides
 * `virtual:astro-ai-disclosure/config` — and non-defaults let the render tests
 * prove the component reads central config rather than falling back to
 * built-ins that happen to match.
 */
const config = {
  plugins: [
    virtualConfigPlugin(
      toVirtualConfig(
        resolveOptions({
          policy: "all-ai",
          defaultLanguage: "de",
          badge: { position: "top-left" },
          labels: { de: { generated: "Von KI erzeugt" } },
        }),
      ),
    ),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
} satisfies ViteUserConfig;

export default getViteConfig(
  // `satisfies ViteUserConfig` above type-checks `test` against Vitest's own
  // config type. The cast is needed only because pnpm resolves separate `vite`
  // copies for Astro and Vitest, so Vitest's augmentation of Vite's UserConfig
  // does not reach the type Astro's parameter refers to.
  config as Parameters<typeof getViteConfig>[0],
  // This package is a library, not a site. Pointing srcDir at the fixtures
  // directory (which holds an empty `pages/`) stops Astro warning about a
  // missing pages directory on every test run.
  { srcDir: "./test/fixtures" },
);
