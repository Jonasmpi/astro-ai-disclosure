import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LABELS } from "../src/disclosure";
import aiDisclosure, { AIDisclosureConfigError, INTEGRATION_NAME } from "../src/index";
import { RESOLVED_VIRTUAL_CONFIG_ID, VIRTUAL_CONFIG_ID } from "../src/virtual-config";

type LoadablePlugin = { name: string; load: (id: string) => string | undefined };

/**
 * Runs `astro:config:setup` with only the payload member the hook touches.
 *
 * The cast is on the argument, not the hook: Astro's payload has a dozen
 * members and building all of them would test the stub rather than the code.
 */
function runConfigSetup(integration: ReturnType<typeof aiDisclosure>) {
  const updateConfig = vi.fn();
  const hook = integration.hooks["astro:config:setup"];
  if (!hook) throw new Error("astro:config:setup hook missing");
  void hook({
    updateConfig,
    config: { srcDir: new URL("file:///project/src/") },
  } as unknown as Parameters<typeof hook>[0]);
  return updateConfig;
}

function pluginsFrom(updateConfig: ReturnType<typeof vi.fn>): LoadablePlugin[] {
  const passed = updateConfig.mock.calls[0]?.[0] as { vite: { plugins: LoadablePlugin[] } };
  return passed.vite.plugins;
}

function pluginFrom(updateConfig: ReturnType<typeof vi.fn>, name?: string): LoadablePlugin {
  const plugins = pluginsFrom(updateConfig);
  const plugin = name ? plugins.find((entry) => entry.name === name) : plugins[0];
  if (!plugin) throw new Error(`no plugin ${name ?? "[0]"} registered`);
  return plugin;
}

/** Evaluates the virtual module's source back into data. */
function servedConfig(plugin: LoadablePlugin): unknown {
  const source = plugin.load(RESOLVED_VIRTUAL_CONFIG_ID);
  if (source === undefined) throw new Error("plugin served nothing");
  return JSON.parse(
    source.replace(/^export default Object\.freeze\(/, "").replace(/\);\n$/, ""),
  ) as unknown;
}

describe("aiDisclosure — registration", () => {
  it("registers under the published package name", () => {
    expect(aiDisclosure().name).toBe(INTEGRATION_NAME);
    expect(INTEGRATION_NAME).toBe("@jonasmpi/astro-ai-disclosure");
  });

  it("installs exactly the hooks it needs", () => {
    expect(Object.keys(aiDisclosure().hooks).sort()).toEqual([
      "astro:build:done",
      "astro:config:done",
      "astro:config:setup",
    ]);
  });

  it("returns an independent object on every call", () => {
    expect(aiDisclosure()).not.toBe(aiDisclosure());
  });
});

describe("aiDisclosure — option validation timing", () => {
  it("rejects bad options while the config is read, not at render time", () => {
    expect(() => aiDisclosure({ policy: "nope" as never })).toThrow(AIDisclosureConfigError);
  });

  it("accepts valid options", () => {
    expect(() => aiDisclosure({ policy: "all-ai", defaultLanguage: "de" })).not.toThrow();
  });
});

describe("astro:config:setup", () => {
  it("registers the config, manifest and enforcement plugins", () => {
    const updateConfig = runConfigSetup(aiDisclosure());
    expect(updateConfig).toHaveBeenCalledOnce();
    expect(pluginsFrom(updateConfig).map((plugin) => plugin.name)).toEqual([
      "astro-ai-disclosure:virtual-config",
      "astro-ai-disclosure:manifest",
      "astro-ai-disclosure:enforcement",
    ]);
  });

  it("omits the enforcement plugin when enforcement is off", () => {
    const updateConfig = runConfigSetup(aiDisclosure({ enforcement: "off" }));
    expect(pluginsFrom(updateConfig).map((plugin) => plugin.name)).toEqual([
      "astro-ai-disclosure:virtual-config",
      "astro-ai-disclosure:manifest",
    ]);
  });

  it("bakes the resolved options into the served module", () => {
    const updateConfig = runConfigSetup(
      aiDisclosure({
        policy: "all-ai",
        defaultLanguage: "de",
        badge: { position: "top-left" },
        labels: { de: { generated: "Von KI erzeugt" } },
      }),
    );

    expect(servedConfig(pluginFrom(updateConfig))).toEqual({
      policy: "all-ai",
      defaultLanguage: "de",
      badge: { position: "top-left", mode: "overlay", icon: "none" },
      labels: {
        de: {
          generated: "Von KI erzeugt",
          modified: DEFAULT_LABELS.de.modified,
          assisted: DEFAULT_LABELS.de.assisted,
        },
        en: DEFAULT_LABELS.en,
      },
      validation: {
        missingMetadata: "error",
        reviewRequired: "error",
        remoteImages: "require-explicit-metadata",
      },
    });
  });

  it("serves the defaults when no options are given", () => {
    expect(servedConfig(pluginFrom(runConfigSetup(aiDisclosure())))).toEqual({
      policy: "eu-article-50",
      defaultLanguage: "en",
      badge: { position: "bottom-right", mode: "overlay", icon: "none" },
      labels: DEFAULT_LABELS,
      validation: {
        missingMetadata: "error",
        reviewRequired: "error",
        remoteImages: "require-explicit-metadata",
      },
    });
  });

  it("does not leak enforcement or exclude into the client module", () => {
    const updateConfig = runConfigSetup(aiDisclosure({ enforcement: "warn", exclude: [/secret/] }));
    const source = pluginFrom(updateConfig).load(RESOLVED_VIRTUAL_CONFIG_ID) ?? "";
    expect(source).not.toContain("enforcement");
    expect(source).not.toContain("secret");
  });
});

describe("astro:config:done", () => {
  it("injects the ambient declaration for the virtual module", () => {
    const injectTypes = vi.fn();
    const hook = aiDisclosure().hooks["astro:config:done"];
    if (!hook) throw new Error("astro:config:done hook missing");
    void hook({ injectTypes } as unknown as Parameters<typeof hook>[0]);

    expect(injectTypes).toHaveBeenCalledTimes(2);
    const calls = injectTypes.mock.calls.map(
      (call) => call[0] as { filename: string; content: string },
    );
    expect(calls.map((call) => call.filename)).toEqual(["config.d.ts", "manifest.d.ts"]);
    expect(calls[0]?.content).toContain(`declare module "${VIRTUAL_CONFIG_ID}"`);
    expect(calls[1]?.content).toContain('declare module "virtual:ai-image-manifest"');
  });
});
