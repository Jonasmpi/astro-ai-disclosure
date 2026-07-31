import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AIDisclosureSidecarError,
  RESOLVED_VIRTUAL_MANIFEST_ID,
  SIDECAR_SUFFIX,
  VIRTUAL_MANIFEST_ID,
  VIRTUAL_MANIFEST_TYPES,
  buildManifest,
  findSidecars,
  imagePathForSidecar,
  manifestPlugin,
  parseSidecar,
  serializeManifest,
} from "../src/manifest";

const valid = { kind: "generated", scope: "deepfake" };

describe("parseSidecar — accepts well-formed declarations", () => {
  it("reads the two required fields", () => {
    expect(parseSidecar(JSON.stringify(valid), "a.ai.json")).toEqual(valid);
  });

  it("reads every optional field", () => {
    const full = {
      kind: "modified",
      scope: "creative-work",
      provider: "OpenAI",
      model: "GPT Image",
      createdAt: "2026-07-20",
      description: "A note",
      label: "Custom",
    };
    expect(parseSidecar(JSON.stringify(full), "a.ai.json")).toEqual(full);
  });

  it("accepts an explicit kind=none declaration", () => {
    const none = { kind: "none", scope: "not-in-scope" };
    expect(parseSidecar(JSON.stringify(none), "a.ai.json")).toEqual(none);
  });

  it("accepts every kind and scope", () => {
    for (const kind of ["none", "assisted", "modified", "generated"]) {
      for (const scope of ["not-in-scope", "deepfake", "creative-work", "review-required"]) {
        expect(parseSidecar(JSON.stringify({ kind, scope }), "a.ai.json")).toEqual({ kind, scope });
      }
    }
  });
});

describe("parseSidecar — rejects rather than repairs", () => {
  const bad: ReadonlyArray<[string, string, string]> = [
    ["malformed JSON", "{ nope", "not valid JSON"],
    ["a JSON array", "[]", "expected a JSON object"],
    ["null", "null", "expected a JSON object"],
    ["a missing kind", '{"scope":"deepfake"}', "invalid `kind`"],
    ["a missing scope", '{"kind":"generated"}', "invalid `scope`"],
    ["an unknown kind", '{"kind":"synthetic","scope":"deepfake"}', "invalid `kind`"],
    ["an unknown scope", '{"kind":"generated","scope":"maybe"}', "invalid `scope`"],
    ["a non-string provider", '{"kind":"none","scope":"not-in-scope","provider":5}', "`provider`"],
    [
      "an empty description",
      '{"kind":"none","scope":"not-in-scope","description":""}',
      "`description`",
    ],
    ["an unknown field", '{"kind":"none","scope":"not-in-scope","kinds":"typo"}', "unknown field"],
  ];

  for (const [name, raw, fragment] of bad) {
    it(`rejects ${name}`, () => {
      expect(() => parseSidecar(raw, "/src/assets/photo.jpg.ai.json")).toThrow(
        AIDisclosureSidecarError,
      );
      expect(() => parseSidecar(raw, "/src/assets/photo.jpg.ai.json")).toThrow(fragment);
    });
  }

  it("names the offending file in the message", () => {
    expect(() => parseSidecar("{ nope", "/src/assets/photo.jpg.ai.json")).toThrow(
      "/src/assets/photo.jpg.ai.json",
    );
  });

  // A misspelled field is the whole reason to reject rather than ignore: the
  // author meant to record something, and silence would hide that they failed.
  it("lists the allowed fields when one is unknown", () => {
    expect(() => parseSidecar('{"kind":"none","scope":"not-in-scope","modell":"x"}', "a")).toThrow(
      '"modell"',
    );
    expect(() => parseSidecar('{"kind":"none","scope":"not-in-scope","modell":"x"}', "a")).toThrow(
      '"model"',
    );
  });
});

describe("imagePathForSidecar", () => {
  it("strips the sidecar suffix", () => {
    expect(imagePathForSidecar("/a/photo.jpg.ai.json")).toBe("/a/photo.jpg");
    expect(imagePathForSidecar("/a/b.c/image.webp.ai.json")).toBe("/a/b.c/image.webp");
  });

  it("uses the documented suffix", () => {
    expect(SIDECAR_SUFFIX).toBe(".ai.json");
  });
});

describe("filesystem scanning", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "aid-manifest-"));
    mkdirSync(join(root, "assets", "nested"), { recursive: true });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const writeSidecar = (relative: string, data: unknown) =>
    writeFileSync(join(root, relative), JSON.stringify(data), "utf8");

  it("finds sidecars at any depth", () => {
    writeSidecar("assets/a.jpg.ai.json", valid);
    writeSidecar("assets/nested/b.webp.ai.json", valid);
    expect(findSidecars(root)).toHaveLength(2);
  });

  it("ignores files that are not sidecars", () => {
    writeFileSync(join(root, "assets", "a.jpg"), "not json", "utf8");
    writeFileSync(join(root, "assets", "meta.json"), "{}", "utf8");
    expect(findSidecars(root)).toEqual([]);
  });

  it("returns an empty list for a directory that does not exist", () => {
    expect(findSidecars(join(root, "missing"))).toEqual([]);
  });

  it("keys the manifest by the absolute image path", () => {
    writeSidecar("assets/a.jpg.ai.json", valid);
    const manifest = buildManifest(root);
    const keys = Object.keys(manifest);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(join(root, "assets", "a.jpg"));
    expect(keys[0]?.startsWith("/")).toBe(true);
    expect(manifest[keys[0]!]).toEqual(valid);
  });

  it("distinguishes same-named images in different folders", () => {
    writeSidecar("assets/hero.jpg.ai.json", { kind: "generated", scope: "deepfake" });
    writeSidecar("assets/nested/hero.jpg.ai.json", { kind: "assisted", scope: "not-in-scope" });

    const manifest = buildManifest(root);
    expect(Object.keys(manifest)).toHaveLength(2);
    expect(manifest[join(root, "assets", "hero.jpg")]?.kind).toBe("generated");
    expect(manifest[join(root, "assets", "nested", "hero.jpg")]?.kind).toBe("assisted");
  });

  it("fails the whole build on one malformed sidecar", () => {
    writeSidecar("assets/a.jpg.ai.json", valid);
    writeFileSync(join(root, "assets", "b.jpg.ai.json"), "{ broken", "utf8");
    expect(() => buildManifest(root)).toThrow(AIDisclosureSidecarError);
  });

  it("produces an empty manifest when there are no sidecars", () => {
    expect(buildManifest(root)).toEqual({});
  });
});

describe("serializeManifest", () => {
  it("emits a frozen default export that parses back", () => {
    const manifest = { "/a/photo.jpg": { kind: "generated", scope: "deepfake" } } as const;
    const source = serializeManifest(manifest);
    expect(source.startsWith("export default Object.freeze(")).toBe(true);
    const json = source.replace(/^export default Object\.freeze\(/, "").replace(/\);\n$/, "");
    expect(JSON.parse(json)).toEqual(manifest);
  });
});

describe("manifestPlugin", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "aid-manifest-plugin-"));
    writeFileSync(join(root, "photo.jpg.ai.json"), JSON.stringify(valid), "utf8");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const call = <T>(hook: unknown, ...args: unknown[]): T =>
    (hook as (...a: unknown[]) => T).call({}, ...args);

  it("resolves only its own specifier", () => {
    const plugin = manifestPlugin(root);
    expect(call(plugin.resolveId, VIRTUAL_MANIFEST_ID)).toBe(RESOLVED_VIRTUAL_MANIFEST_ID);
    expect(call(plugin.resolveId, "virtual:something-else")).toBeUndefined();
  });

  it("serves the manifest at the resolved id", () => {
    const source = call<string>(manifestPlugin(root).load, RESOLVED_VIRTUAL_MANIFEST_ID);
    expect(source).toContain(join(root, "photo.jpg"));
    expect(source).toContain('"kind": "generated"');
  });

  it("does not serve the bare specifier", () => {
    expect(call(manifestPlugin(root).load, VIRTUAL_MANIFEST_ID)).toBeUndefined();
  });

  // Re-reading on load is what makes a sidecar edit visible in dev without a
  // restart; baking the manifest in at setup would not.
  it("re-reads the filesystem on every load", () => {
    const plugin = manifestPlugin(root);
    expect(call<string>(plugin.load, RESOLVED_VIRTUAL_MANIFEST_ID)).not.toContain("added.jpg");

    writeFileSync(join(root, "added.jpg.ai.json"), JSON.stringify(valid), "utf8");
    expect(call<string>(plugin.load, RESOLVED_VIRTUAL_MANIFEST_ID)).toContain(
      join(root, "added.jpg"),
    );
  });
});

describe("VIRTUAL_MANIFEST_TYPES", () => {
  it("declares the module the plugin serves", () => {
    expect(VIRTUAL_MANIFEST_TYPES).toContain(`declare module "${VIRTUAL_MANIFEST_ID}"`);
    expect(VIRTUAL_MANIFEST_TYPES).toContain(
      'import("@jonasmpi/astro-ai-disclosure/types").AIImageManifest',
    );
  });
});
