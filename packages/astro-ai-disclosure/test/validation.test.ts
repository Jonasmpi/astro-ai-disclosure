import { describe, expect, it, vi } from "vitest";

import { resolveOptions, toVirtualConfig } from "../src/options";
import type { AIDisclosure, ResolvedValidationRules } from "../src/types";
import {
  AIDisclosureValidationError,
  describeImage,
  isRemoteImage,
  reportIssue,
  validateDisclosure,
} from "../src/validation";

const strict: ResolvedValidationRules = {
  missingMetadata: "error",
  reviewRequired: "error",
  remoteImages: "require-explicit-metadata",
};

const local = (fsPath = "/src/assets/photo.jpg") => ({ fsPath, src: "/_astro/photo.HASH.jpg" });
const declared: AIDisclosure = { kind: "generated", scope: "deepfake" };

describe("isRemoteImage", () => {
  it("recognises http and https URLs", () => {
    expect(isRemoteImage("https://example.com/a.jpg")).toBe(true);
    expect(isRemoteImage("http://example.com/a.jpg")).toBe(true);
    expect(isRemoteImage("HTTPS://EXAMPLE.COM/a.jpg")).toBe(true);
  });

  it("does not treat local assets or public paths as remote", () => {
    expect(isRemoteImage(local())).toBe(false);
    expect(isRemoteImage("/logo.png")).toBe(false);
    expect(isRemoteImage("./photo.jpg")).toBe(false);
    expect(isRemoteImage(undefined)).toBe(false);
  });
});

describe("describeImage", () => {
  it("prefers the source path, which is what the author can act on", () => {
    expect(describeImage(local("/src/assets/a.jpg"))).toBe("/src/assets/a.jpg");
  });

  it("falls back to a remote URL", () => {
    expect(describeImage("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });

  it("falls back to src when there is no fsPath", () => {
    expect(describeImage({ src: "/_astro/a.HASH.jpg" })).toBe("/_astro/a.HASH.jpg");
  });

  it("degrades to a placeholder rather than throwing", () => {
    expect(describeImage(undefined)).toBe("<unknown image>");
    expect(describeImage({})).toBe("<unknown image>");
  });
});

describe("validateDisclosure — a declared image is fine", () => {
  it("reports nothing for a normal declaration", () => {
    expect(validateDisclosure(declared, local(), strict)).toBeUndefined();
  });

  it("accepts an explicit kind=none declaration", () => {
    expect(
      validateDisclosure({ kind: "none", scope: "not-in-scope" }, local(), strict),
    ).toBeUndefined();
  });

  it("accepts a declared remote image", () => {
    expect(validateDisclosure(declared, "https://example.com/a.jpg", strict)).toBeUndefined();
  });
});

describe("validateDisclosure — missing metadata", () => {
  it("reports an undeclared local image", () => {
    const issue = validateDisclosure(undefined, local(), strict);
    expect(issue?.rule).toBe("missingMetadata");
    expect(issue?.severity).toBe("error");
    expect(issue?.message).toContain("/src/assets/photo.jpg");
  });

  it("suggests both ways to fix it, including the no-AI declaration", () => {
    const message = validateDisclosure(undefined, local(), strict)?.message ?? "";
    expect(message).toContain("`ai` prop");
    expect(message).toContain(".ai.json");
    expect(message).toContain('"kind": "none"');
  });

  it("honours the configured severity", () => {
    expect(
      validateDisclosure(undefined, local(), { ...strict, missingMetadata: "warn" })?.severity,
    ).toBe("warn");
    expect(
      validateDisclosure(undefined, local(), { ...strict, missingMetadata: "off" }),
    ).toBeUndefined();
  });
});

describe("validateDisclosure — review-required", () => {
  const pending: AIDisclosure = { kind: "generated", scope: "review-required" };

  it("reports an image still awaiting review", () => {
    const issue = validateDisclosure(pending, local(), strict);
    expect(issue?.rule).toBe("reviewRequired");
    expect(issue?.severity).toBe("error");
  });

  it("honours the configured severity", () => {
    expect(
      validateDisclosure(pending, local(), { ...strict, reviewRequired: "warn" })?.severity,
    ).toBe("warn");
    expect(
      validateDisclosure(pending, local(), { ...strict, reviewRequired: "off" }),
    ).toBeUndefined();
  });

  it("still applies when the declaration came from a sidecar", () => {
    expect(validateDisclosure(pending, local(), strict)?.rule).toBe("reviewRequired");
  });
});

describe("validateDisclosure — remote images", () => {
  const remote = "https://example.com/a.jpg";

  it("reports an undeclared remote image under its own rule, not missingMetadata", () => {
    const issue = validateDisclosure(undefined, remote, strict);
    expect(issue?.rule).toBe("remoteImages");
    expect(issue?.severity).toBe("error");
  });

  // The fix differs from a local image's, so the message must too.
  it("explains that a sidecar cannot help", () => {
    const message = validateDisclosure(undefined, remote, strict)?.message ?? "";
    expect(message).toContain("not on disk");
    expect(message).toContain("`ai` prop");
    expect(message).toContain('"allow"');
  });

  it("stays silent when remote images are allowed", () => {
    expect(
      validateDisclosure(undefined, remote, { ...strict, remoteImages: "allow" }),
    ).toBeUndefined();
  });

  it("does not fall through to missingMetadata when allowed", () => {
    const permissive: ResolvedValidationRules = {
      missingMetadata: "error",
      reviewRequired: "error",
      remoteImages: "allow",
    };
    expect(validateDisclosure(undefined, remote, permissive)).toBeUndefined();
  });
});

describe("reportIssue", () => {
  it("throws for an error", () => {
    const issue = validateDisclosure(undefined, local(), strict);
    expect(() => reportIssue(issue)).toThrow(AIDisclosureValidationError);
  });

  it("carries the rule name on the error", () => {
    try {
      reportIssue(validateDisclosure(undefined, local(), strict));
      expect.unreachable();
    } catch (error) {
      expect((error as AIDisclosureValidationError).rule).toBe("missingMetadata");
    }
  });

  it("warns without throwing for a warning", () => {
    const warn = vi.fn();
    const issue = validateDisclosure(undefined, local(), { ...strict, missingMetadata: "warn" });
    expect(() => reportIssue(issue, warn)).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("@jonasmpi/astro-ai-disclosure");
  });

  it("does nothing when there is no issue", () => {
    const warn = vi.fn();
    expect(() => reportIssue(undefined, warn)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * The rules that actually reach a component are collapsed for the current
 * command, so the dev-versus-build behaviour is decided here rather than by a
 * component guessing at runtime.
 */
describe("mode collapsing — the dev versus build difference", () => {
  it("warns about missing metadata in dev and fails the build", () => {
    const config = resolveOptions();
    expect(toVirtualConfig(config, "development").validation.missingMetadata).toBe("warn");
    expect(toVirtualConfig(config, "build").validation.missingMetadata).toBe("error");
  });

  it("fails on review-required in both modes", () => {
    const config = resolveOptions();
    expect(toVirtualConfig(config, "development").validation.reviewRequired).toBe("error");
    expect(toVirtualConfig(config, "build").validation.reviewRequired).toBe("error");
  });

  it("requires explicit metadata for remote images by default", () => {
    expect(toVirtualConfig(resolveOptions()).validation.remoteImages).toBe(
      "require-explicit-metadata",
    );
  });

  it("produces the documented end-to-end behaviour for an undeclared image", () => {
    const config = resolveOptions();
    const dev = toVirtualConfig(config, "development").validation;
    const build = toVirtualConfig(config, "build").validation;

    expect(validateDisclosure(undefined, local(), dev)?.severity).toBe("warn");
    expect(validateDisclosure(undefined, local(), build)?.severity).toBe("error");
  });

  it("lets a bare string set both modes at once", () => {
    const config = resolveOptions({ missingMetadata: "off" });
    expect(toVirtualConfig(config, "development").validation.missingMetadata).toBe("off");
    expect(toVirtualConfig(config, "build").validation.missingMetadata).toBe("off");
  });

  it("lets one mode be overridden without disturbing the other", () => {
    const config = resolveOptions({ missingMetadata: { development: "off" } });
    expect(toVirtualConfig(config, "development").validation.missingMetadata).toBe("off");
    expect(toVirtualConfig(config, "build").validation.missingMetadata).toBe("error");
  });
});

describe("option validation for the new rules", () => {
  it("rejects an unknown severity", () => {
    expect(() => resolveOptions({ missingMetadata: "loud" as never })).toThrow("`missingMetadata`");
  });

  it("rejects an unknown mode key", () => {
    expect(() => resolveOptions({ missingMetadata: { production: "error" } as never })).toThrow(
      "`missingMetadata.production`",
    );
  });

  it("rejects a bad severity inside a per-mode object", () => {
    expect(() => resolveOptions({ reviewRequired: { build: "loud" as never } })).toThrow(
      "`reviewRequired.build`",
    );
  });

  it("rejects an unknown remote policy", () => {
    expect(() => resolveOptions({ remoteImages: "ignore" as never })).toThrow("`remoteImages`");
  });
});
