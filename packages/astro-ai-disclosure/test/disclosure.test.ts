import { describe, expect, it } from "vitest";

import { DEFAULT_LABELS, containsAI, resolveLabel, shouldDisclose } from "../src/disclosure";
import type {
  AIDisclosure,
  AIImageKind,
  DisclosurePolicy,
  Labels,
  Language,
  LegalScope,
} from "../src/types";

const KINDS: readonly AIImageKind[] = ["none", "assisted", "modified", "generated"];
const SCOPES: readonly LegalScope[] = [
  "not-in-scope",
  "deepfake",
  "creative-work",
  "review-required",
];
const POLICIES: readonly DisclosurePolicy[] = ["eu-article-50", "all-ai"];
const LANGUAGES: readonly Language[] = ["de", "en"];

const ai = (kind: AIImageKind, scope: LegalScope): AIDisclosure => ({ kind, scope });

/**
 * The expectation is written independently of the implementation — as the rule
 * in prose, not as a second copy of the code — so a change in `shouldDisclose`
 * cannot silently drag the test along with it.
 */
function expectedDisclosure(kind: AIImageKind, scope: LegalScope, policy: DisclosurePolicy) {
  if (kind === "none") return false;
  if (policy === "all-ai") return true;
  return scope === "deepfake" || scope === "creative-work" || scope === "review-required";
}

describe("shouldDisclose — full policy matrix", () => {
  for (const policy of POLICIES) {
    for (const kind of KINDS) {
      for (const scope of SCOPES) {
        const expected = expectedDisclosure(kind, scope, policy);
        it(`${policy}: kind=${kind} scope=${scope} -> ${expected}`, () => {
          expect(shouldDisclose(ai(kind, scope), policy)).toBe(expected);
        });
      }
    }
  }

  it("covers every combination", () => {
    expect(KINDS.length * SCOPES.length * POLICIES.length).toBe(32);
  });
});

describe("shouldDisclose — the rules the matrix encodes", () => {
  it("never discloses without metadata, under either policy", () => {
    for (const policy of POLICIES) {
      expect(shouldDisclose(undefined, policy)).toBe(false);
    }
  });

  it("never discloses kind=none, whatever the scope claims", () => {
    for (const policy of POLICIES) {
      for (const scope of SCOPES) {
        expect(shouldDisclose(ai("none", scope), policy)).toBe(false);
      }
    }
  });

  it("discloses every AI kind under all-ai, including not-in-scope", () => {
    for (const kind of ["assisted", "modified", "generated"] as const) {
      expect(shouldDisclose(ai(kind, "not-in-scope"), "all-ai")).toBe(true);
    }
  });

  it("stays silent for not-in-scope AI under eu-article-50", () => {
    for (const kind of ["assisted", "modified", "generated"] as const) {
      expect(shouldDisclose(ai(kind, "not-in-scope"), "eu-article-50")).toBe(false);
    }
  });

  it("discloses deepfake and creative-work under eu-article-50", () => {
    for (const scope of ["deepfake", "creative-work"] as const) {
      expect(shouldDisclose(ai("generated", scope), "eu-article-50")).toBe(true);
    }
  });

  // Deliberate deviation from the kickoff draft: an unreviewed image fails
  // safe. See the note on DISCLOSING_SCOPES in src/disclosure.ts.
  it("discloses review-required under eu-article-50 rather than staying silent", () => {
    expect(shouldDisclose(ai("generated", "review-required"), "eu-article-50")).toBe(true);
    expect(shouldDisclose(ai("assisted", "review-required"), "eu-article-50")).toBe(true);
  });

  it("still ignores review-required when no AI is declared", () => {
    expect(shouldDisclose(ai("none", "review-required"), "eu-article-50")).toBe(false);
  });
});

describe("containsAI", () => {
  it("is false for undefined and for kind=none", () => {
    expect(containsAI(undefined)).toBe(false);
    expect(containsAI(ai("none", "not-in-scope"))).toBe(false);
  });

  it("is true for every other kind", () => {
    for (const kind of ["assisted", "modified", "generated"] as const) {
      expect(containsAI(ai(kind, "not-in-scope"))).toBe(true);
    }
  });
});

describe("resolveLabel", () => {
  it("returns the built-in label for each kind and language", () => {
    expect(resolveLabel(ai("generated", "deepfake"), "en")).toBe("AI-generated");
    expect(resolveLabel(ai("modified", "deepfake"), "en")).toBe("AI-modified");
    expect(resolveLabel(ai("assisted", "deepfake"), "en")).toBe("AI-assisted");
    expect(resolveLabel(ai("generated", "deepfake"), "de")).toBe("KI-generiert");
    expect(resolveLabel(ai("modified", "deepfake"), "de")).toBe("Mit KI verändert");
    expect(resolveLabel(ai("assisted", "deepfake"), "de")).toBe("Mit KI-Unterstützung");
  });

  it("has a non-empty label for every disclosable kind in every language", () => {
    for (const language of LANGUAGES) {
      for (const kind of ["assisted", "modified", "generated"] as const) {
        expect(resolveLabel(ai(kind, "deepfake"), language)).not.toBe("");
      }
    }
  });

  it("returns an empty string when there is nothing to label", () => {
    expect(resolveLabel(undefined, "en")).toBe("");
    expect(resolveLabel(ai("none", "not-in-scope"), "en")).toBe("");
  });

  it("prefers an explicit label over the generated one", () => {
    expect(resolveLabel({ kind: "generated", scope: "deepfake", label: "Synthetic" }, "en")).toBe(
      "Synthetic",
    );
  });

  it("honours an explicit label even for kind=none", () => {
    expect(
      resolveLabel({ kind: "none", scope: "not-in-scope", label: "Photograph, unedited" }, "en"),
    ).toBe("Photograph, unedited");
  });

  it("ignores an empty explicit label and falls back to the default", () => {
    expect(resolveLabel({ kind: "generated", scope: "deepfake", label: "" }, "en")).toBe(
      "AI-generated",
    );
  });

  it("uses custom labels when supplied", () => {
    const custom: Labels = {
      ...DEFAULT_LABELS,
      en: { generated: "Made by AI", modified: "Touched by AI", assisted: "AI helped" },
    };
    expect(resolveLabel(ai("generated", "deepfake"), "en", custom)).toBe("Made by AI");
    // Unmodified language still resolves from the same object.
    expect(resolveLabel(ai("generated", "deepfake"), "de", custom)).toBe("KI-generiert");
  });

  it("does not mutate DEFAULT_LABELS", () => {
    const before = JSON.stringify(DEFAULT_LABELS);
    resolveLabel(ai("generated", "deepfake"), "en");
    resolveLabel({ kind: "generated", scope: "deepfake", label: "x" }, "de");
    expect(JSON.stringify(DEFAULT_LABELS)).toBe(before);
  });
});
