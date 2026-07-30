import type { AstroIntegration } from "astro";

import { resolveOptions, toVirtualConfig } from "./options";
import type { AIDisclosureOptions } from "./types";
import { VIRTUAL_CONFIG_TYPES, virtualConfigPlugin } from "./virtual-config";

export * from "./types";
export { DEFAULT_LABELS, containsAI, resolveLabel, shouldDisclose } from "./disclosure";
export { AIDisclosureConfigError, DEFAULT_OPTIONS, mergeLabels, resolveOptions } from "./options";
export { VIRTUAL_CONFIG_ID } from "./virtual-config";

/**
 * The integration name, identical to the published package name. Astro uses it
 * in logs and error messages, so it is exported for reuse in diagnostics.
 */
export const INTEGRATION_NAME = "@jonasmpi/astro-ai-disclosure";

/**
 * Astro integration for AI-disclosure labelling of images.
 *
 * Resolves and validates the options eagerly, so a typo in `astro.config.ts`
 * fails while the config is being read rather than at first render, then exposes
 * the result to components through `virtual:astro-ai-disclosure/config`.
 *
 * The components themselves arrive in steps 1.3 and 1.4, build enforcement in
 * step 1.5 — `enforcement` and `exclude` are validated here but not yet acted on.
 */
export default function aiDisclosure(options: AIDisclosureOptions = {}): AstroIntegration {
  const config = resolveOptions(options);

  return {
    name: INTEGRATION_NAME,
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [virtualConfigPlugin(toVirtualConfig(config))],
          },
        });
      },
      "astro:config:done": ({ injectTypes }) => {
        injectTypes({
          filename: "config.d.ts",
          content: VIRTUAL_CONFIG_TYPES,
        });
      },
    },
  };
}
