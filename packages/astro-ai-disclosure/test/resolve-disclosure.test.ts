import { describe, expect, it } from "vitest";

import { imageFsPath, resolveDisclosure } from "../src/badge";
import type { AIDisclosure, AIImageManifest } from "../src/types";

const inline: AIDisclosure = { kind: "generated", scope: "deepfake", description: "inline" };
const fromSidecar: AIDisclosure = {
  kind: "assisted",
  scope: "not-in-scope",
  description: "sidecar",
};

/** Mimics Astro's asset import, which returns a Proxy answering `fsPath`. */
function astroImage(fsPath: string, src = "/_astro/photo.HASH.jpg") {
  return new Proxy(
    { src, width: 100, height: 100, format: "jpg" },
    {
      get(target, name, receiver) {
        if (name === "fsPath") return fsPath;
        return Reflect.get(target, name, receiver);
      },
    },
  );
}

const manifest: AIImageManifest = { "/src/assets/photo.jpg": fromSidecar };

describe("imageFsPath", () => {
  it("reads fsPath through Astro's proxy", () => {
    expect(imageFsPath(astroImage("/src/assets/photo.jpg"))).toBe("/src/assets/photo.jpg");
  });

  it("reads it from a plain object too", () => {
    expect(imageFsPath({ fsPath: "/a/b.jpg" })).toBe("/a/b.jpg");
  });

  /**
   * `fsPath` is not part of Astro's public ImageMetadata type. If a future
   * version stops exposing it this test still passes, but sidecar resolution
   * quietly stops — so the demo assertions and the round-trip test below are
   * what actually guard the behaviour.
   */
  it("returns undefined when Astro does not expose it", () => {
    expect(imageFsPath({ src: "/_astro/photo.HASH.jpg", width: 1, height: 1 })).toBeUndefined();
  });

  it("returns undefined for remote images and other non-objects", () => {
    expect(imageFsPath("https://example.com/photo.jpg")).toBeUndefined();
    expect(imageFsPath(undefined)).toBeUndefined();
    expect(imageFsPath(null)).toBeUndefined();
    expect(imageFsPath(42)).toBeUndefined();
  });

  it("treats an empty fsPath as absent", () => {
    expect(imageFsPath({ fsPath: "" })).toBeUndefined();
  });
});

describe("resolveDisclosure — precedence", () => {
  it("prefers an inline declaration over the sidecar", () => {
    const image = astroImage("/src/assets/photo.jpg");
    expect(resolveDisclosure(inline, image, manifest)).toBe(inline);
  });

  it("falls back to the sidecar when nothing is inline", () => {
    const image = astroImage("/src/assets/photo.jpg");
    expect(resolveDisclosure(undefined, image, manifest)).toEqual(fromSidecar);
  });

  it("resolves nothing when neither source has anything", () => {
    const image = astroImage("/src/assets/unlabelled.jpg");
    expect(resolveDisclosure(undefined, image, manifest)).toBeUndefined();
  });

  it("resolves nothing for an image with no fsPath", () => {
    expect(resolveDisclosure(undefined, { src: "/_astro/x.jpg" }, manifest)).toBeUndefined();
  });

  it("resolves nothing for a remote image", () => {
    expect(resolveDisclosure(undefined, "https://example.com/x.jpg", manifest)).toBeUndefined();
  });

  it("treats an empty manifest as no sidecars", () => {
    expect(resolveDisclosure(undefined, astroImage("/src/assets/photo.jpg"), {})).toBeUndefined();
  });

  it("defaults the manifest argument so callers may omit it", () => {
    expect(resolveDisclosure(undefined, astroImage("/a/b.jpg"))).toBeUndefined();
    expect(resolveDisclosure(inline, astroImage("/a/b.jpg"))).toBe(inline);
  });

  // The whole point of keying on fsPath rather than src: two images with the
  // same filename in different folders must not share a declaration.
  it("distinguishes same-named images in different folders", () => {
    const twoFolders: AIImageManifest = {
      "/src/assets/blog/hero.jpg": { kind: "generated", scope: "deepfake" },
      "/src/assets/about/hero.jpg": { kind: "assisted", scope: "not-in-scope" },
    };
    expect(
      resolveDisclosure(undefined, astroImage("/src/assets/blog/hero.jpg"), twoFolders)?.kind,
    ).toBe("generated");
    expect(
      resolveDisclosure(undefined, astroImage("/src/assets/about/hero.jpg"), twoFolders)?.kind,
    ).toBe("assisted");
  });

  // src differs between dev and build; fsPath does not.
  it("matches regardless of what src looks like", () => {
    const build = astroImage("/src/assets/photo.jpg", "/_astro/photo.DxP4TsXp.jpg");
    const dev = astroImage("/src/assets/photo.jpg", "/@fs/src/assets/photo.jpg?origWidth=100");
    expect(resolveDisclosure(undefined, build, manifest)).toEqual(fromSidecar);
    expect(resolveDisclosure(undefined, dev, manifest)).toEqual(fromSidecar);
  });
});
