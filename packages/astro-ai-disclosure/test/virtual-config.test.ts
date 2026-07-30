import { describe, expect, it } from "vitest";

import { resolveOptions, toVirtualConfig } from "../src/options";
import {
  RESOLVED_VIRTUAL_CONFIG_ID,
  VIRTUAL_CONFIG_ID,
  VIRTUAL_CONFIG_TYPES,
  serializeVirtualConfig,
  virtualConfigPlugin,
} from "../src/virtual-config";

const virtualConfig = () => toVirtualConfig(resolveOptions({ policy: "all-ai" }));

/** Calls a Vite plugin hook that may be a function or an object form. */
function callHook<T>(hook: unknown, ...args: unknown[]): T {
  if (typeof hook !== "function") throw new Error("expected a function hook");
  return (hook as (...a: unknown[]) => T).call({}, ...args);
}

describe("module ids", () => {
  it("uses the documented specifier", () => {
    expect(VIRTUAL_CONFIG_ID).toBe("virtual:astro-ai-disclosure/config");
  });

  it("NUL-prefixes the resolved id, per Rollup convention", () => {
    expect(RESOLVED_VIRTUAL_CONFIG_ID).toBe("\0virtual:astro-ai-disclosure/config");
    expect(RESOLVED_VIRTUAL_CONFIG_ID.startsWith("\0")).toBe(true);
  });
});

describe("serializeVirtualConfig", () => {
  it("emits a default export that evaluates back to the config", () => {
    const config = virtualConfig();
    const source = serializeVirtualConfig(config);
    expect(source.startsWith("export default Object.freeze(")).toBe(true);

    const json = source.replace(/^export default Object\.freeze\(/, "").replace(/\);\n$/, "");
    expect(JSON.parse(json)).toEqual(config);
  });

  it("freezes the export so one component cannot mutate shared config", () => {
    expect(serializeVirtualConfig(virtualConfig())).toContain("Object.freeze");
  });
});

describe("virtualConfigPlugin", () => {
  it("resolves only its own specifier", () => {
    const plugin = virtualConfigPlugin(virtualConfig());
    expect(callHook(plugin.resolveId, VIRTUAL_CONFIG_ID)).toBe(RESOLVED_VIRTUAL_CONFIG_ID);
    expect(callHook(plugin.resolveId, "virtual:something-else")).toBeUndefined();
    expect(callHook(plugin.resolveId, "./local.ts")).toBeUndefined();
  });

  it("loads only the resolved id, not the bare specifier", () => {
    const plugin = virtualConfigPlugin(virtualConfig());
    expect(callHook<string>(plugin.load, RESOLVED_VIRTUAL_CONFIG_ID)).toContain("export default");
    // The bare specifier must go through resolveId first.
    expect(callHook(plugin.load, VIRTUAL_CONFIG_ID)).toBeUndefined();
    expect(callHook(plugin.load, "\0virtual:other")).toBeUndefined();
  });

  it("serves the config it was constructed with", () => {
    const plugin = virtualConfigPlugin(toVirtualConfig(resolveOptions({ defaultLanguage: "de" })));
    const source = callHook<string>(plugin.load, RESOLVED_VIRTUAL_CONFIG_ID);
    expect(source).toContain('"defaultLanguage": "de"');
  });

  it("has a namespaced plugin name", () => {
    expect(virtualConfigPlugin(virtualConfig()).name).toBe("astro-ai-disclosure:virtual-config");
  });

  it("round-trips a resolve then load", () => {
    const plugin = virtualConfigPlugin(virtualConfig());
    const resolved = callHook<string>(plugin.resolveId, VIRTUAL_CONFIG_ID);
    expect(callHook<string>(plugin.load, resolved)).toContain('"policy": "all-ai"');
  });
});

describe("VIRTUAL_CONFIG_TYPES", () => {
  it("declares the module under the same specifier the plugin serves", () => {
    expect(VIRTUAL_CONFIG_TYPES).toContain(`declare module "${VIRTUAL_CONFIG_ID}"`);
  });

  it("types the default export via the package's public types entrypoint", () => {
    expect(VIRTUAL_CONFIG_TYPES).toContain(
      'import("@jonasmpi/astro-ai-disclosure/types").VirtualDisclosureConfig',
    );
    expect(VIRTUAL_CONFIG_TYPES).toContain("export default config");
  });
});
