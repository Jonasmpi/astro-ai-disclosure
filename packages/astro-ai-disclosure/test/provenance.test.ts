import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { bakeBadge } from "../src/image-service";

/**
 * Pins the findings recorded in `docs/provenance.md`.
 *
 * The decision to reject C2PA rests on facts about Sharp and about image
 * optimization. If any of them stops holding, these fail and the document gets
 * revisited rather than quietly becoming wrong.
 */

/** A JPEG carrying EXIF and XMP, standing in for provenance metadata. */
async function imageWithMetadata(): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: "#888888" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "Test Author", Software: "provenance-probe" } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><probe>stand-in</probe></x:xmpmeta>')
    .toBuffer();
}

describe("Sharp's metadata surface", () => {
  it("has no C2PA or JUMBF support at any level", () => {
    const api = Object.getOwnPropertyNames(sharp.prototype);
    expect(api.filter((name) => /c2pa|jumbf/i.test(name))).toEqual([]);
  });

  it("still exposes the EXIF/XMP APIs the document describes", () => {
    const api = Object.getOwnPropertyNames(sharp.prototype);
    for (const method of ["keepMetadata", "keepExif", "keepXmp", "withExif", "withXmp"]) {
      expect(api, `sharp.${method} disappeared`).toContain(method);
    }
  });
});

describe("metadata through the pipeline", () => {
  it("survives only when Sharp is explicitly asked", async () => {
    const original = await imageWithMetadata();

    const stripped = await sharp(original).resize(200).jpeg().toBuffer();
    expect((await sharp(stripped).metadata()).exif).toBeUndefined();

    const kept = await sharp(original).resize(200).keepMetadata().jpeg().toBuffer();
    expect((await sharp(kept).metadata()).exif).toBeDefined();
  });

  /**
   * Our baked transform matches Astro's own behaviour rather than diverging.
   * Preserving EXIF here would silently start shipping camera and GPS data that
   * a stock Astro site drops.
   */
  it("is stripped by the baked transform, as Astro strips it too", async () => {
    const { data } = await bakeBadge(new Uint8Array(await imageWithMetadata()), "AI-generated");
    const metadata = await sharp(data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });
});

describe("why a manifest cannot survive optimization", () => {
  /**
   * The decisive fact: a C2PA manifest hashes the pixels, and ordinary
   * optimization rewrites them. This is true of Astro's own resizing, with no
   * baked badge involved.
   */
  it("resizing and re-encoding rewrites most pixel bytes", async () => {
    // Detail, not a flat colour: a solid fill resizes losslessly and would make
    // this test claim the opposite of what it means to. Seeded, so the
    // measurement is stable between runs.
    const width = 800;
    const height = 600;
    const pixels = Buffer.alloc(width * height * 3);
    let seed = 42;
    for (let index = 0; index < pixels.length; index += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      pixels[index] = seed % 256;
    }
    const photo = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg()
      .toBuffer();

    const raw = (buffer: Buffer) =>
      sharp(buffer).resize(200, 150, { fit: "fill" }).raw().toBuffer();

    const optimized = await sharp(photo).resize(400).webp({ quality: 80 }).toBuffer();
    const before = await raw(photo);
    const after = await raw(optimized);

    let differing = 0;
    for (let index = 0; index < before.length; index += 1) {
      if (before[index] !== after[index]) differing += 1;
    }

    // Not a threshold worth tuning — the point is that it is nowhere near zero,
    // so any hash-based assertion over the delivered pixels fails.
    expect(differing / before.length).toBeGreaterThan(0.5);
  });
});
