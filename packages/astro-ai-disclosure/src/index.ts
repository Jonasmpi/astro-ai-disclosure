import type { AstroIntegration } from "astro";

export * from "./types";
export { DEFAULT_LABELS, containsAI, resolveLabel, shouldDisclose } from "./disclosure";

/**
 * The integration name, identical to the published package name. Astro uses it
 * in logs and error messages, so it is exported for reuse in diagnostics.
 */
export const INTEGRATION_NAME = "@jonasmpi/astro-ai-disclosure";

/**
 * Astro integration for AI-disclosure labelling of images.
 *
 * Scaffold only: it registers under {@link INTEGRATION_NAME} and installs no
 * hooks yet. Options and the virtual config module arrive in step 1.2, build
 * enforcement in step 1.5.
 */
export default function aiDisclosure(): AstroIntegration {
  return {
    name: INTEGRATION_NAME,
    hooks: {},
  };
}
