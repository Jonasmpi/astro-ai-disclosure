import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { EU_ICON_BLACK, EU_ICON_WHITE, euIconDataUri, euIconSvg } from "../src/eu-icon";
import { badgeGeometry, bakeBadge, renderBadgeSvg } from "../src/image-service";

describe("the bundled mark", () => {
  it("keeps the official square viewBox", () => {
    for (const svg of [EU_ICON_WHITE, EU_ICON_BLACK]) {
      expect(svg).toContain('viewBox="0 0 566.93 566.93"');
    }
  });

  it("carries the three official paths", () => {
    for (const svg of [EU_ICON_WHITE, EU_ICON_BLACK]) {
      expect([...svg.matchAll(/<path /g)]).toHaveLength(3);
    }
  });

  /**
   * The published files colour themselves through an internal `<style>` with
   * generic `.cls-1` / `.cls-2` names. Two copies inlined on one page would
   * fight over those, so they are rewritten to direct fills.
   */
  it("has no internal stylesheet or class names to collide", () => {
    for (const svg of [EU_ICON_WHITE, EU_ICON_BLACK]) {
      expect(svg).not.toContain("<style");
      expect(svg).not.toContain("cls-");
      expect(svg).not.toContain("class=");
    }
  });

  it("inverts the two colourways", () => {
    expect(EU_ICON_WHITE).toContain('fill="#ffffff"');
    expect(EU_ICON_WHITE).toContain('fill="#1d1d1b"');
    expect(EU_ICON_BLACK).toContain('fill="#1d1d1b"');
    expect(EU_ICON_BLACK).toContain('fill="#ffffff"');
    expect(EU_ICON_WHITE).not.toBe(EU_ICON_BLACK);
  });

  it("preserves the evenodd fill rule the disc needs", () => {
    expect(EU_ICON_WHITE).toContain('fill-rule="evenodd"');
  });

  it("stays small enough to bundle", () => {
    expect(EU_ICON_WHITE.length).toBeLessThan(2000);
  });

  it("defaults to the white variant, which suits the dark badge", () => {
    expect(euIconSvg()).toBe(EU_ICON_WHITE);
    expect(euIconSvg("black")).toBe(EU_ICON_BLACK);
  });
});

describe("euIconDataUri", () => {
  it("produces a decodable svg+xml URI", () => {
    const uri = euIconDataUri();
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(uri.slice("data:image/svg+xml,".length))).toBe(EU_ICON_WHITE);
  });

  it("escapes characters that would break an attribute", () => {
    const uri = euIconDataUri();
    expect(uri).not.toContain('"');
    expect(uri).not.toContain("<");
    expect(uri).not.toContain("#");
  });

  it("is smaller than the base64 equivalent", () => {
    const base64 = `data:image/svg+xml;base64,${Buffer.from(EU_ICON_WHITE).toString("base64")}`;
    expect(euIconDataUri().length).toBeLessThan(base64.length);
  });
});

describe("baked badge geometry with the mark", () => {
  it("reserves no room when no icon is shown", () => {
    const geometry = badgeGeometry(800, "AI-generated", false);
    expect(geometry.iconSize).toBe(0);
    expect(geometry.iconGap).toBe(0);
  });

  it("widens the badge to fit the mark", () => {
    const without = badgeGeometry(800, "AI-generated", false);
    const withIcon = badgeGeometry(800, "AI-generated", true);
    expect(withIcon.iconSize).toBeGreaterThan(0);
    expect(withIcon.width).toBeGreaterThan(without.width);
  });

  it("scales the mark with the image, like the text", () => {
    expect(badgeGeometry(320, "AI-generated", true).iconSize).toBeLessThan(
      badgeGeometry(1600, "AI-generated", true).iconSize,
    );
  });

  it("embeds the mark only when asked", () => {
    const geometry = badgeGeometry(800, "AI-generated", true);
    expect(renderBadgeSvg("AI-generated", geometry, true)).toContain("<image");
    expect(renderBadgeSvg("AI-generated", geometry, false)).not.toContain("<image");
  });

  it("shifts the text right to make room for the mark", () => {
    const geometry = badgeGeometry(800, "AI-generated", true);
    const withIcon = /<text x="(\d+)"/.exec(renderBadgeSvg("AI-generated", geometry, true));
    const without = /<text x="(\d+)"/.exec(
      renderBadgeSvg("AI-generated", badgeGeometry(800, "AI-generated", false), false),
    );
    expect(Number(withIcon?.[1])).toBeGreaterThan(Number(without?.[1]));
  });
});

/** A solid white image, so anything composited is detectable. */
async function solidImage(width: number): Promise<Uint8Array> {
  const png = await sharp({
    create: {
      width,
      height: Math.round(width * 0.6),
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

async function darkRatio(image: Uint8Array): Promise<number> {
  const { data, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (const value of data) if (value < 128) dark += 1;
  return dark / (info.width * info.height);
}

/**
 * Sharp has to rasterise the nested `<image href="data:…">`. If it silently
 * skipped it the badge would still render, just without the mark — so this
 * compares against the same badge baked without one.
 */
describe("the mark in baked pixels", () => {
  it("composites more ink than the same badge without it", async () => {
    const original = await solidImage(800);
    const plain = await bakeBadge(original, "AI-generated", false);
    const withIcon = await bakeBadge(original, "AI-generated", true);
    expect(await darkRatio(withIcon.data)).toBeGreaterThan(await darkRatio(plain.data));
  });

  it("produces different pixels, not merely a wider box", async () => {
    const original = await solidImage(800);
    const plain = await bakeBadge(original, "AI-generated", false);
    const withIcon = await bakeBadge(original, "AI-generated", true);
    expect(Buffer.compare(Buffer.from(plain.data), Buffer.from(withIcon.data))).not.toBe(0);
  });

  it("renders at every responsive width", async () => {
    for (const width of [320, 640, 1440]) {
      const { data } = await bakeBadge(await solidImage(width), "AI-generated", true);
      expect(await darkRatio(data), `width ${width}`).toBeGreaterThan(0.001);
    }
  });
});
