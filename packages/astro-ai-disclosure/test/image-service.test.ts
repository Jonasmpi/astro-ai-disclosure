import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import service, {
  AI_KIND_PARAM,
  AI_LABEL_PARAM,
  ASTRO_DEFAULT_HASH_PROPS,
  appendAIParams,
  badgeGeometry,
  bakeBadge,
  defaultBakedLabel,
  escapeXml,
  readAIProps,
  renderBadgeSvg,
} from "../src/image-service";

/** A plain image of a known solid colour, so composited pixels are detectable. */
async function solidImage(width: number, height = Math.round(width * 0.6)): Promise<Uint8Array> {
  const png = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

/** Fraction of pixels darker than mid-grey — the badge is near-black on white. */
async function darkPixelRatio(image: Uint8Array): Promise<number> {
  const { data, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (const value of data) if (value < 128) dark += 1;
  return dark / (info.width * info.height);
}

/** Bottom-right quadrant, where the badge is composited. */
async function bottomRightDarkRatio(image: Uint8Array): Promise<number> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const cropped = await sharp(image)
    .extract({
      left: Math.floor(width / 2),
      top: Math.floor(height / 2),
      width: Math.floor(width / 2),
      height: Math.floor(height / 2),
    })
    .toBuffer();
  return darkPixelRatio(new Uint8Array(cropped));
}

/**
 * The Sharp service defines no `propertiesToHash`, so providing one replaces
 * Astro's default rather than extending it. If that default ever changes, this
 * fails rather than silently letting two transforms collide onto one file.
 */
describe("propertiesToHash", () => {
  it("matches Astro's current default, plus the custom props", () => {
    // `astro/dist/assets/consts.js` is not an exported subpath, so the value is
    // read off disk. Reading it at all is the point: if Astro changes its
    // default list this test fails, instead of two transforms silently
    // colliding onto one output file.
    const sharpEntry = fileURLToPath(import.meta.resolve("astro/assets/services/sharp"));
    const constsPath = join(dirname(sharpEntry), "..", "consts.js");
    const source = readFileSync(constsPath, "utf8");

    const match = /DEFAULT_HASH_PROPS = \[([\s\S]*?)\]/.exec(source);
    expect(match, "could not find DEFAULT_HASH_PROPS in Astro's source").not.toBeNull();

    const astroDefault = [...match![1]!.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    expect(astroDefault.length).toBeGreaterThan(0);
    expect([...ASTRO_DEFAULT_HASH_PROPS]).toEqual(astroDefault);
    expect(service.propertiesToHash).toEqual([...astroDefault, AI_KIND_PARAM, AI_LABEL_PARAM]);
  });

  it("keeps the properties that distinguish otherwise-identical transforms", () => {
    // Appendix E's sketch dropped these three; two images differing only in
    // `fit` would then hash to the same filename.
    for (const property of ["fit", "position", "background"]) {
      expect(service.propertiesToHash).toContain(property);
    }
  });

  it("hashes the custom props, so two labels cannot share one file", () => {
    expect(service.propertiesToHash).toContain(AI_KIND_PARAM);
    expect(service.propertiesToHash).toContain(AI_LABEL_PARAM);
  });
});

describe("escapeXml", () => {
  it("escapes every character that would break the SVG", () => {
    expect(escapeXml(`<&>'"`)).toBe("&lt;&amp;&gt;&apos;&quot;");
  });

  it("leaves ordinary label text alone", () => {
    expect(escapeXml("KI-generiert")).toBe("KI-generiert");
  });

  it("keeps a label containing markup from escaping its attribute", () => {
    const svg = renderBadgeSvg("</text><script>x</script>", badgeGeometry(800, "x"));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;/text&gt;");
  });
});

describe("badgeGeometry", () => {
  it("scales the font with the image width", () => {
    expect(badgeGeometry(400, "AI-generated").fontSize).toBeLessThan(
      badgeGeometry(1600, "AI-generated").fontSize,
    );
  });

  it("keeps small variants legible with a floor", () => {
    expect(badgeGeometry(120, "AI-generated").fontSize).toBeGreaterThanOrEqual(12);
  });

  it("caps the size so a huge image is not dominated by the badge", () => {
    expect(badgeGeometry(8000, "AI-generated").fontSize).toBeLessThanOrEqual(48);
  });

  it("widens with the label", () => {
    expect(badgeGeometry(800, "AI-generated").width).toBeLessThan(
      badgeGeometry(800, "Mit KI-Unterstützung").width,
    );
  });

  it("never produces a zero-sized badge", () => {
    for (const width of [1, 50, 320, 1440, 8000]) {
      const geometry = badgeGeometry(width, "AI");
      expect(geometry.width).toBeGreaterThan(0);
      expect(geometry.height).toBeGreaterThan(0);
    }
  });
});

describe("defaultBakedLabel", () => {
  it("matches the visible overlay labels", () => {
    expect(defaultBakedLabel("generated")).toBe("AI-generated");
    expect(defaultBakedLabel("modified")).toBe("AI-modified");
    expect(defaultBakedLabel("assisted")).toBe("AI-assisted");
  });
});

describe("readAIProps", () => {
  it("reads both props", () => {
    expect(readAIProps({ aiKind: "generated", aiLabel: "Custom" })).toEqual({
      aiKind: "generated",
      aiLabel: "Custom",
    });
  });

  it("ignores empty and non-string values", () => {
    expect(readAIProps({ aiKind: "", aiLabel: 5 })).toEqual({});
    expect(readAIProps({})).toEqual({});
  });
});

describe("appendAIParams — the dev/on-demand round trip", () => {
  it("leaves a URL alone when there is nothing to add", () => {
    expect(appendAIParams("/_image?href=a.jpg", {})).toBe("/_image?href=a.jpg");
  });

  it("appends to a URL that already has a query", () => {
    const url = appendAIParams("/_image?href=a.jpg&w=320", { aiKind: "generated" });
    expect(url).toContain("href=a.jpg");
    expect(url).toContain("aiKind=generated");
  });

  it("adds a query to a URL that has none", () => {
    expect(appendAIParams("/_image", { aiKind: "modified" })).toBe("/_image?aiKind=modified");
  });

  it("encodes labels that contain URL-significant characters", () => {
    const url = appendAIParams("/_image", { aiLabel: "Mit KI & mehr?" });
    const parsed = new URL(url, "https://example.test");
    expect(parsed.searchParams.get(AI_LABEL_PARAM)).toBe("Mit KI & mehr?");
  });

  it("round-trips through URLSearchParams unchanged", () => {
    for (const label of ["AI-generated", "Mit KI verändert", "a=b&c", "100% AI"]) {
      const url = new URL(
        appendAIParams("/_image", { aiKind: "generated", aiLabel: label }),
        "https://x.test",
      );
      expect(url.searchParams.get(AI_LABEL_PARAM)).toBe(label);
      expect(url.searchParams.get(AI_KIND_PARAM)).toBe("generated");
    }
  });
});

describe("bakeBadge — real pixels", () => {
  it("changes the image", async () => {
    const original = await solidImage(600);
    const { data } = await bakeBadge(original, "AI-generated");
    expect(Buffer.compare(Buffer.from(data), Buffer.from(original))).not.toBe(0);
  });

  it("preserves the image dimensions", async () => {
    const original = await solidImage(600, 400);
    const { data } = await bakeBadge(original, "AI-generated");
    const meta = await sharp(data).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(400);
  });

  it("darkens the bottom-right corner, where the badge sits", async () => {
    const original = await solidImage(600);
    const { data } = await bakeBadge(original, "AI-generated");
    expect(await bottomRightDarkRatio(original)).toBe(0);
    expect(await bottomRightDarkRatio(data)).toBeGreaterThan(0.01);
  });

  /**
   * The step's acceptance criterion: a baked label has to survive at every
   * responsive width, not just the one it was tuned on.
   */
  it("bakes a visible label at every responsive width", async () => {
    for (const width of [320, 640, 960, 1440, 1920]) {
      const original = await solidImage(width);
      const { data } = await bakeBadge(original, "AI-generated");
      const ratio = await darkPixelRatio(data);
      expect(ratio, `width ${width} produced no visible badge`).toBeGreaterThan(0.001);
    }
  });

  it("bakes a wider mark for a longer label", async () => {
    const original = await solidImage(800);
    const short = await bakeBadge(original, "AI");
    const long = await bakeBadge(original, "Mit KI-Unterstützung");
    expect(await darkPixelRatio(long.data)).toBeGreaterThan(await darkPixelRatio(short.data));
  });

  it("handles a label with non-ASCII characters", async () => {
    const original = await solidImage(600);
    const { data } = await bakeBadge(original, "KI-generiert · Mit KI verändert");
    expect(await darkPixelRatio(data)).toBeGreaterThan(0.001);
  });
});

describe("service.transform", () => {
  const imageConfig = { service: { entrypoint: "", config: {} } } as never;

  it("returns the optimized image untouched when no aiKind is set", async () => {
    const original = await solidImage(400);
    const result = await service.transform(
      original,
      { src: "/a.png", format: "png" } as never,
      imageConfig,
    );
    expect(await darkPixelRatio(result.data)).toBe(0);
  });

  it("bakes the badge when aiKind is set", async () => {
    const original = await solidImage(400);
    const result = await service.transform(
      original,
      { src: "/a.png", format: "png", aiKind: "generated" } as never,
      imageConfig,
    );
    expect(await darkPixelRatio(result.data)).toBeGreaterThan(0.001);
  });

  it("keeps the format the base service produced", async () => {
    const original = await solidImage(400);
    const result = await service.transform(
      original,
      { src: "/a.png", format: "png", aiKind: "generated" } as never,
      imageConfig,
    );
    expect(result.format).toBe("png");
  });
});
