import type { Plugin } from "vite";

import type { VirtualDisclosureConfig } from "./types";

/** The module specifier components import to read the central config. */
export const VIRTUAL_CONFIG_ID = "virtual:astro-ai-disclosure/config";

/**
 * Rollup convention: a resolved virtual id is prefixed with NUL so no other
 * plugin and no filesystem lookup mistakes it for a real file.
 */
export const RESOLVED_VIRTUAL_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;

/**
 * Renders the virtual module source.
 *
 * The config is plain JSON data by construction — {@link VirtualDisclosureConfig}
 * excludes the `RegExp`-bearing `exclude` option — so `JSON.stringify` is a
 * complete serialisation rather than a lossy shortcut. Frozen so a component
 * cannot mutate config that other components share.
 */
export function serializeVirtualConfig(config: VirtualDisclosureConfig): string {
  return `export default Object.freeze(${JSON.stringify(config, null, 2)});\n`;
}

/** The ambient declaration injected into the consumer's project. */
export const VIRTUAL_CONFIG_TYPES = `declare module "${VIRTUAL_CONFIG_ID}" {
  const config: import("@jonasmpi/astro-ai-disclosure/types").VirtualDisclosureConfig;
  export default config;
}
`;

/**
 * Vite plugin serving {@link VIRTUAL_CONFIG_ID}. Registered by the integration
 * in `astro:config:setup`; the config is baked in at that point, so the module
 * needs no runtime lookup.
 */
export function virtualConfigPlugin(config: VirtualDisclosureConfig): Plugin {
  const source = serializeVirtualConfig(config);

  return {
    name: "astro-ai-disclosure:virtual-config",
    resolveId(id) {
      return id === VIRTUAL_CONFIG_ID ? RESOLVED_VIRTUAL_CONFIG_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_VIRTUAL_CONFIG_ID ? source : undefined;
    },
  };
}
