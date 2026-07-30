import { describe, expect, it } from "vitest";

import { resolveBadge } from "../src/badge";
import { resolveOptions, toVirtualConfig } from "../src/options";
import type { AIDisclosure, VirtualDisclosureConfig } from "../src/types";

/** The package defaults: eu-article-50, en, bottom-right. */
const defaultConfig: VirtualDisclosureConfig = toVirtualConfig(resolveOptions());

/** A site configured the way the demo is. */
const siteConfig: VirtualDisclosureConfig = toVirtualConfig(
  resolveOptions({
    policy: "all-ai",
    defaultLanguage: "de",
    badge: { position: "top-left" },
    labels: { de: { generated: "Von KI erzeugt" } },
  }),
);

const generatedDeepfake: AIDisclosure = {
  kind: "generated",
  scope: "deepfake",
  provider: "OpenAI",
  model: "GPT Image",
  createdAt: "2026-07-20",
  description: "Synthetic visualisation",
};

describe("resolveBadge — central config is the fallback", () => {
  it("takes policy, language and position from the config when no props override them", () => {
    const view = resolveBadge({ ai: generatedDeepfake }, siteConfig);
    expect(view.position).toBe("top-left");
    expect(view.label).toBe("Von KI erzeugt");
    expect(view.show).toBe(true);
  });

  it("uses the package defaults when the config is default", () => {
    const view = resolveBadge({ ai: generatedDeepfake }, defaultConfig);
    expect(view.position).toBe("bottom-right");
    expect(view.label).toBe("AI-generated");
  });
});

describe("resolveBadge — per-image props override the config", () => {
  it("overrides the policy", () => {
    const ai: AIDisclosure = { kind: "generated", scope: "not-in-scope" };
    // Site policy all-ai would show it; the stricter override does not.
    expect(resolveBadge({ ai }, siteConfig).show).toBe(true);
    expect(resolveBadge({ ai, policy: "eu-article-50" }, siteConfig).show).toBe(false);
  });

  it("overrides the language", () => {
    expect(resolveBadge({ ai: generatedDeepfake, language: "en" }, siteConfig).label).toBe(
      "AI-generated",
    );
    expect(resolveBadge({ ai: generatedDeepfake, language: "de" }, defaultConfig).label).toBe(
      "KI-generiert",
    );
  });

  it("overrides the badge position", () => {
    for (const badgePosition of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      expect(resolveBadge({ ai: generatedDeepfake, badgePosition }, siteConfig).position).toBe(
        badgePosition,
      );
    }
  });

  it("resolves each override independently of the others", () => {
    const view = resolveBadge(
      { ai: generatedDeepfake, language: "en", badgePosition: "bottom-left" },
      siteConfig,
    );
    // policy still from the config, the other two overridden
    expect(view.show).toBe(true);
    expect(view.label).toBe("AI-generated");
    expect(view.position).toBe("bottom-left");
  });

  it("honours a per-image custom label over any resolved one", () => {
    const view = resolveBadge(
      { ai: { ...generatedDeepfake, label: "Synthetic image" } },
      siteConfig,
    );
    expect(view.label).toBe("Synthetic image");
  });
});

describe("resolveBadge — the three canonical scenarios", () => {
  const scenarios = [
    {
      name: "in-scope generated: badge under both policies",
      ai: { kind: "generated", scope: "deepfake" },
      euArticle50: true,
      allAi: true,
    },
    {
      name: "voluntary labelling: badge under all-ai only",
      ai: { kind: "generated", scope: "not-in-scope" },
      euArticle50: false,
      allAi: true,
    },
    {
      name: "assisted photo: badge under all-ai only",
      ai: { kind: "assisted", scope: "not-in-scope" },
      euArticle50: false,
      allAi: true,
    },
  ] as const satisfies ReadonlyArray<{
    name: string;
    ai: AIDisclosure;
    euArticle50: boolean;
    allAi: boolean;
  }>;

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      expect(resolveBadge({ ai: scenario.ai, policy: "eu-article-50" }, defaultConfig).show).toBe(
        scenario.euArticle50,
      );
      expect(resolveBadge({ ai: scenario.ai, policy: "all-ai" }, defaultConfig).show).toBe(
        scenario.allAi,
      );
    });
  }
});

describe("resolveBadge — data attributes", () => {
  it("mirrors every provided field", () => {
    expect(resolveBadge({ ai: generatedDeepfake }, defaultConfig).data).toEqual({
      "data-ai-kind": "generated",
      "data-ai-scope": "deepfake",
      "data-ai-provider": "OpenAI",
      "data-ai-model": "GPT Image",
      "data-ai-created-at": "2026-07-20",
    });
  });

  it("omits fields that were not provided rather than emitting empty ones", () => {
    expect(
      resolveBadge({ ai: { kind: "assisted", scope: "not-in-scope" } }, defaultConfig).data,
    ).toEqual({
      "data-ai-kind": "assisted",
      "data-ai-scope": "not-in-scope",
    });
  });

  it("emits attributes even when no badge is shown — the declaration still stands", () => {
    const view = resolveBadge(
      { ai: { kind: "generated", scope: "not-in-scope" }, policy: "eu-article-50" },
      defaultConfig,
    );
    expect(view.show).toBe(false);
    expect(view.data["data-ai-kind"]).toBe("generated");
    expect(view.data["data-ai-scope"]).toBe("not-in-scope");
  });

  it("emits attributes for an explicit kind=none declaration", () => {
    const view = resolveBadge({ ai: { kind: "none", scope: "not-in-scope" } }, siteConfig);
    expect(view.show).toBe(false);
    expect(view.data["data-ai-kind"]).toBe("none");
  });

  it("emits nothing at all without metadata", () => {
    const view = resolveBadge({}, siteConfig);
    expect(view.data).toEqual({});
    expect(view.show).toBe(false);
    expect(view.label).toBe("");
    expect(view.description).toBe("");
  });
});

describe("resolveBadge — accessible description", () => {
  it("combines the label and the author's description", () => {
    expect(resolveBadge({ ai: generatedDeepfake }, defaultConfig).description).toBe(
      "AI-generated. Synthetic visualisation",
    );
  });

  it("falls back to the label alone when there is no description", () => {
    expect(
      resolveBadge({ ai: { kind: "generated", scope: "deepfake" } }, defaultConfig).description,
    ).toBe("AI-generated");
  });

  // Deliberate deviation from the kickoff draft: provider and model are not in
  // the accessible name — they would need untranslated "Provider:" prefixes and
  // would bloat the screen-reader announcement. They stay in data-ai-*.
  it("leaves provider and model out of the accessible name", () => {
    const description = resolveBadge({ ai: generatedDeepfake }, defaultConfig).description;
    expect(description).not.toContain("OpenAI");
    expect(description).not.toContain("GPT Image");
  });

  it("uses the resolved language for the description's label part", () => {
    expect(resolveBadge({ ai: generatedDeepfake }, siteConfig).description).toBe(
      "Von KI erzeugt. Synthetic visualisation",
    );
  });

  it("never leaves a dangling separator when parts are missing", () => {
    const view = resolveBadge({ ai: { kind: "modified", scope: "deepfake" } }, defaultConfig);
    expect(view.description).toBe("AI-modified");
    expect(view.description.endsWith(".")).toBe(false);
  });
});

describe("resolveBadge — does not mutate its inputs", () => {
  it("leaves the config untouched", () => {
    const snapshot = structuredClone(siteConfig);
    resolveBadge({ ai: generatedDeepfake, language: "en", badgePosition: "top-right" }, siteConfig);
    expect(siteConfig).toEqual(snapshot);
  });

  it("leaves the metadata untouched", () => {
    const ai = structuredClone(generatedDeepfake);
    resolveBadge({ ai }, siteConfig);
    expect(ai).toEqual(generatedDeepfake);
  });
});
