import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

import { enforcementPlugin } from "./enforcement";
import { VIRTUAL_MANIFEST_TYPES, manifestPlugin } from "./manifest";
import type { ValidationMode } from "./types";
import { resolveOptions, toVirtualConfig } from "./options";
import type { AIDisclosureOptions } from "./types";
import { VIRTUAL_CONFIG_TYPES, virtualConfigPlugin } from "./virtual-config";

export * from "./types";
export { DEFAULT_LABELS, containsAI, resolveLabel, shouldDisclose } from "./disclosure";
export { imageFsPath, resolveBadge, resolveDisclosure } from "./badge";
export {
  AIDisclosureValidationError,
  describeImage,
  isRemoteImage,
  reportIssue,
  validateDisclosure,
} from "./validation";
export type { ValidationIssue, ValidationRuleName } from "./validation";
export type { BadgeView, DisclosureDataAttributes, DisclosureOverrides } from "./badge";
export {
  AIDisclosureConfigError,
  DEFAULT_OPTIONS,
  DEFAULT_VALIDATION,
  mergeLabels,
  resolveOptions,
} from "./options";
export { VIRTUAL_CONFIG_ID } from "./virtual-config";
export { FORBIDDEN_BINDINGS, findForbiddenImports } from "./enforcement";
export {
  AIDisclosureSidecarError,
  SIDECAR_SUFFIX,
  VIRTUAL_MANIFEST_ID,
  buildManifest,
  parseSidecar,
} from "./manifest";
export type { ForbiddenImport } from "./enforcement";

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
 * the result to components through `virtual:astro-ai-disclosure/config` and
 * registers the plugin that forbids direct `astro:assets` imports.
 */
export default function aiDisclosure(options: AIDisclosureOptions = {}): AstroIntegration {
  const config = resolveOptions(options);

  return {
    name: INTEGRATION_NAME,
    hooks: {
      "astro:config:setup": ({ command, config: astroConfig, updateConfig }) => {
        // `preview` serves a finished build, so it is held to build's rules.
        const mode: ValidationMode = command === "dev" ? "development" : "build";

        // `enforcement: "off"` yields no plugin at all rather than a no-op one.
        const enforcement = enforcementPlugin({
          enforcement: config.enforcement,
          exclude: config.exclude,
        });

        updateConfig({
          vite: {
            plugins: [
              virtualConfigPlugin(toVirtualConfig(config, mode)),
              manifestPlugin(fileURLToPath(astroConfig.srcDir)),
              ...(enforcement ? [enforcement] : []),
            ],
          },
        });
      },
      "astro:config:done": ({ injectTypes }) => {
        injectTypes({
          filename: "config.d.ts",
          content: VIRTUAL_CONFIG_TYPES,
        });
        injectTypes({
          filename: "manifest.d.ts",
          content: VIRTUAL_MANIFEST_TYPES,
        });
      },
    },
  };
}
