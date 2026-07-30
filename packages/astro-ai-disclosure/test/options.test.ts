import { describe, expect, it } from "vitest";

import { DEFAULT_LABELS } from "../src/disclosure";
import {
  AIDisclosureConfigError,
  DEFAULT_OPTIONS,
  mergeLabels,
  resolveOptions,
  toVirtualConfig,
} from "../src/options";

describe("resolveOptions — defaults", () => {
  it("applies every documented default when given nothing", () => {
    expect(resolveOptions()).toEqual({
      policy: "eu-article-50",
      defaultLanguage: "en",
      labels: DEFAULT_LABELS,
      badge: { position: "bottom-right" },
      enforcement: "error",
      exclude: [],
    });
  });

  it("treats an empty object the same as no argument", () => {
    expect(resolveOptions({})).toEqual(resolveOptions());
  });

  it("keeps the documented package defaults — eu-article-50 and en", () => {
    expect(DEFAULT_OPTIONS.policy).toBe("eu-article-50");
    expect(DEFAULT_OPTIONS.defaultLanguage).toBe("en");
    expect(DEFAULT_OPTIONS.enforcement).toBe("error");
    expect(DEFAULT_OPTIONS.badgePosition).toBe("bottom-right");
  });
});

describe("resolveOptions — accepted values", () => {
  it("carries through every valid option", () => {
    const exclude = [/legacy/, /vendor/];
    expect(
      resolveOptions({
        policy: "all-ai",
        defaultLanguage: "de",
        badge: { position: "top-left" },
        enforcement: "warn",
        exclude,
      }),
    ).toEqual({
      policy: "all-ai",
      defaultLanguage: "de",
      labels: DEFAULT_LABELS,
      badge: { position: "top-left" },
      enforcement: "warn",
      exclude,
    });
  });

  it("accepts all four badge positions", () => {
    for (const position of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      expect(resolveOptions({ badge: { position } }).badge.position).toBe(position);
    }
  });

  it("accepts all three enforcement modes", () => {
    for (const enforcement of ["off", "warn", "error"] as const) {
      expect(resolveOptions({ enforcement }).enforcement).toBe(enforcement);
    }
  });

  it("copies exclude rather than aliasing the caller's array", () => {
    const exclude = [/a/];
    const resolved = resolveOptions({ exclude });
    exclude.push(/b/);
    expect(resolved.exclude).toHaveLength(1);
  });
});

describe("resolveOptions — rejects bad input", () => {
  const cases: ReadonlyArray<[string, () => unknown, string]> = [
    ["unknown policy", () => resolveOptions({ policy: "eu-art-50" as never }), "`policy`"],
    [
      "unknown language",
      () => resolveOptions({ defaultLanguage: "fr" as never }),
      "`defaultLanguage`",
    ],
    [
      "unknown badge position",
      () => resolveOptions({ badge: { position: "centre" as never } }),
      "`badge.position`",
    ],
    [
      "unknown enforcement",
      () => resolveOptions({ enforcement: "fail" as never }),
      "`enforcement`",
    ],
    ["non-array exclude", () => resolveOptions({ exclude: /a/ as never }), "`exclude`"],
    ["non-RegExp in exclude", () => resolveOptions({ exclude: ["a" as never] }), "`exclude[0]`"],
    ["non-object options", () => resolveOptions([] as never), "options object"],
  ];

  for (const [name, run, expectedFragment] of cases) {
    it(`throws on ${name}, naming the offending option`, () => {
      expect(run).toThrow(AIDisclosureConfigError);
      expect(run).toThrow(expectedFragment);
    });
  }

  it("prefixes messages with the package name so the source is obvious", () => {
    expect(() => resolveOptions({ policy: "nope" as never })).toThrow(
      /^\[@jonasmpi\/astro-ai-disclosure\]/,
    );
  });

  it("reports the invalid value and the allowed set", () => {
    expect(() => resolveOptions({ policy: "nope" as never })).toThrow(
      'Invalid `policy`: "nope". Expected one of "eu-article-50", "all-ai".',
    );
  });
});

describe("mergeLabels", () => {
  it("returns the built-ins when given nothing", () => {
    expect(mergeLabels(undefined)).toEqual(DEFAULT_LABELS);
  });

  it("overrides one string without dropping the others", () => {
    const merged = mergeLabels({ de: { generated: "Von KI erzeugt" } });
    expect(merged.de).toEqual({
      generated: "Von KI erzeugt",
      modified: "Mit KI verändert",
      assisted: "Mit KI-Unterstützung",
    });
  });

  it("leaves untouched languages fully intact", () => {
    expect(mergeLabels({ de: { generated: "x" } }).en).toEqual(DEFAULT_LABELS.en);
  });

  it("merges both languages at once", () => {
    const merged = mergeLabels({ de: { assisted: "A" }, en: { modified: "B" } });
    expect(merged.de.assisted).toBe("A");
    expect(merged.de.generated).toBe(DEFAULT_LABELS.de.generated);
    expect(merged.en.modified).toBe("B");
    expect(merged.en.generated).toBe(DEFAULT_LABELS.en.generated);
  });

  it("does not mutate DEFAULT_LABELS", () => {
    const before = structuredClone(DEFAULT_LABELS);
    mergeLabels({ en: { generated: "mutated?" } });
    expect(DEFAULT_LABELS).toEqual(before);
  });

  it("returns objects that are not aliases of DEFAULT_LABELS", () => {
    const merged = mergeLabels(undefined);
    merged.en.generated = "local change";
    expect(DEFAULT_LABELS.en.generated).toBe("AI-generated");
  });

  it("rejects an unknown label kind", () => {
    expect(() => mergeLabels({ en: { none: "nope" } as never })).toThrow(
      "Unknown label kind `labels.en.none`",
    );
  });

  it("rejects an empty or non-string label", () => {
    expect(() => mergeLabels({ en: { generated: "" } })).toThrow("`labels.en.generated`");
    expect(() => mergeLabels({ en: { generated: 42 as never } })).toThrow("`labels.en.generated`");
  });

  it("rejects a non-object language entry", () => {
    expect(() => mergeLabels({ en: "AI" as never })).toThrow("`labels.en`");
  });
});

describe("toVirtualConfig", () => {
  it("keeps what components need", () => {
    const resolved = resolveOptions({ policy: "all-ai", defaultLanguage: "de" });
    expect(toVirtualConfig(resolved)).toEqual({
      policy: "all-ai",
      defaultLanguage: "de",
      labels: DEFAULT_LABELS,
      badge: { position: "bottom-right" },
    });
  });

  it("drops the build-time-only options", () => {
    const virtual = toVirtualConfig(resolveOptions({ enforcement: "warn", exclude: [/x/] }));
    expect(virtual).not.toHaveProperty("enforcement");
    expect(virtual).not.toHaveProperty("exclude");
  });

  it("produces something JSON can round-trip losslessly", () => {
    const virtual = toVirtualConfig(resolveOptions({ exclude: [/x/] }));
    expect(JSON.parse(JSON.stringify(virtual))).toEqual(virtual);
  });
});
