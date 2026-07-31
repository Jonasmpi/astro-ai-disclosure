import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Source-level assertions on the frame's stylesheet.
 *
 * These read the `.astro` file rather than rendered output because the Astro
 * Container API returns markup **without** the component's scoped `<style>` —
 * verified, not assumed. Every other visual test in this suite checks markup or
 * pixels, so a CSS regression is invisible to all of them. That is exactly how
 * the missing `height: auto` reached three releases.
 */
const frame = readFileSync(
  fileURLToPath(new URL("../src/components/DisclosureFrame.astro", import.meta.url)),
  "utf8",
);

/**
 * The declarations inside one rule, with comments stripped.
 *
 * Stripping matters: an earlier version of this file matched the words
 * "height: auto" inside the comment explaining why that declaration is needed,
 * so the guard passed while the declaration itself was missing.
 */
function ruleFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(frame);
  if (!match) throw new Error(`no rule found for ${selector}`);
  return (match[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("the image rule", () => {
  const rule = () => ruleFor(".ai-disclosure :global(img)");

  /**
   * Astro emits intrinsic `width`/`height` attributes on every `<Image>`. With
   * `max-width: 100%` but no `height: auto`, a constrained column shrinks the
   * width while the height stays pinned to the attribute, and the image renders
   * squashed.
   */
  it("pairs max-width with height:auto, or images distort", () => {
    expect(rule()).toMatch(/max-width:\s*100%/);
    expect(rule(), "max-width without height:auto squashes the image").toMatch(/height:\s*auto/);
  });

  it("keeps the image a block, so no baseline gap appears under it", () => {
    expect(rule()).toMatch(/display:\s*block/);
  });
});

describe("the frame rule", () => {
  it("establishes the positioning context the badge is placed against", () => {
    expect(ruleFor(".ai-disclosure")).toMatch(/position:\s*relative/);
  });
});

describe("badge positioning", () => {
  it("offsets the badge for all four corners", () => {
    for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
      expect(frame, `no rule for ${corner}`).toContain(`.ai-disclosure--${corner}`);
    }
  });

  it("keeps the badge above the image", () => {
    expect(ruleFor(".ai-disclosure__badge")).toMatch(/position:\s*absolute/);
    expect(ruleFor(".ai-disclosure__badge")).toMatch(/z-index/);
  });

  it("still degrades sensibly in forced-colors mode", () => {
    expect(frame).toContain("forced-colors: active");
  });
});
