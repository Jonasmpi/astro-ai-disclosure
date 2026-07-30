import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import AIImage from "../src/components/AIImage.astro";
import AIPicture from "../src/components/AIPicture.astro";
import type { AIDisclosure } from "../src/types";

const src = {
  src: "/_test/photo.jpg",
  width: 1600,
  height: 900,
  format: "jpg",
} as const;

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

async function renderPicture(props: Record<string, unknown> = {}): Promise<string> {
  return container.renderToString(AIPicture, {
    props: { src, alt: "A test photograph", ...props },
  });
}

async function renderImage(props: Record<string, unknown> = {}): Promise<string> {
  return container.renderToString(AIImage, {
    props: { src, alt: "A test photograph", ...props },
  });
}

const countOf = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

const generatedDeepfake: AIDisclosure = { kind: "generated", scope: "deepfake" };

describe("AIPicture — renders a picture with sources", () => {
  it("emits a <picture> with <source> elements and a fallback <img>", async () => {
    const html = await renderPicture({ formats: ["avif", "webp"] });
    expect(html).toContain("<picture");
    expect(countOf(html, /<source/g)).toBeGreaterThanOrEqual(2);
    expect(countOf(html, /<img/g)).toBe(1);
  });

  it("honours the requested formats", async () => {
    const html = await renderPicture({ formats: ["avif", "webp"] });
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
  });

  it("forwards pictureAttributes to the <picture> element", async () => {
    const html = await renderPicture({ pictureAttributes: { class: "hero" } });
    expect(html).toMatch(/<picture[^>]*class="[^"]*hero/);
  });

  it("forwards widths and sizes to the sources", async () => {
    const html = await renderPicture({
      widths: [640, 960],
      sizes: "(max-width: 768px) 100vw, 640px",
    });
    expect(html).toContain("srcset");
    expect(html).toContain('sizes="(max-width: 768px) 100vw, 640px"');
  });
});

describe("AIPicture — disclosure behaves exactly as on AIImage", () => {
  it("renders a badge for an in-scope generated image", async () => {
    const html = await renderPicture({ ai: generatedDeepfake });
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(1);
    expect(html).toContain('role="note"');
  });

  it("renders no badge under eu-article-50 for a not-in-scope image", async () => {
    const html = await renderPicture({
      ai: { kind: "generated", scope: "not-in-scope" },
      policy: "eu-article-50",
    });
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(0);
  });

  it("renders no badge without metadata", async () => {
    expect(countOf(await renderPicture(), /ai-disclosure__badge/g)).toBe(0);
  });

  it("mirrors the declaration onto the wrapper", async () => {
    const html = await renderPicture({
      ai: { ...generatedDeepfake, provider: "OpenAI", model: "GPT Image" },
    });
    expect(html).toContain('data-ai-kind="generated"');
    expect(html).toContain('data-ai-scope="deepfake"');
    expect(html).toContain('data-ai-provider="OpenAI"');
    expect(html).toContain('data-ai-model="GPT Image"');
  });

  it("reads language and position from the central config", async () => {
    const html = await renderPicture({ ai: generatedDeepfake });
    expect(html).toContain("Von KI erzeugt");
    expect(html).toContain("ai-disclosure--top-left");
  });

  it("lets per-image props override the config", async () => {
    const html = await renderPicture({
      ai: generatedDeepfake,
      language: "en",
      badgePosition: "bottom-right",
    });
    expect(html).toContain("AI-generated");
    expect(html).toContain("ai-disclosure--bottom-right");
  });
});

/**
 * The point of extracting `DisclosureFrame` is that the two components cannot
 * drift apart. These compare their actual output rather than trusting that.
 */
describe("AIPicture and AIImage share one frame", () => {
  const frameOf = (html: string) => html.match(/<span class="ai-disclosure[\s\S]*?>/)?.[0] ?? "";
  const badgeOf = (html: string) =>
    html.match(/<span class="ai-disclosure__badge[\s\S]*?<\/span><\/span>/)?.[0] ?? "";

  it("produces an identical wrapper element", async () => {
    const [picture, image] = await Promise.all([
      renderPicture({ ai: generatedDeepfake }),
      renderImage({ ai: generatedDeepfake }),
    ]);
    expect(frameOf(picture)).not.toBe("");
    expect(frameOf(picture)).toBe(frameOf(image));
  });

  it("produces identical badge markup", async () => {
    const [picture, image] = await Promise.all([
      renderPicture({ ai: { ...generatedDeepfake, description: "Synthetic scene" } }),
      renderImage({ ai: { ...generatedDeepfake, description: "Synthetic scene" } }),
    ]);
    expect(badgeOf(picture)).not.toBe("");
    expect(badgeOf(picture)).toBe(badgeOf(image));
  });

  it("agrees on badge visibility across the policy matrix", async () => {
    const cases: ReadonlyArray<[AIDisclosure, "eu-article-50" | "all-ai"]> = [
      [{ kind: "generated", scope: "deepfake" }, "eu-article-50"],
      [{ kind: "generated", scope: "not-in-scope" }, "eu-article-50"],
      [{ kind: "assisted", scope: "not-in-scope" }, "all-ai"],
      [{ kind: "none", scope: "not-in-scope" }, "all-ai"],
      [{ kind: "modified", scope: "review-required" }, "eu-article-50"],
    ];

    for (const [ai, policy] of cases) {
      const [picture, image] = await Promise.all([
        renderPicture({ ai, policy }),
        renderImage({ ai, policy }),
      ]);
      expect(countOf(picture, /ai-disclosure__badge/g)).toBe(
        countOf(image, /ai-disclosure__badge/g),
      );
    }
  });
});
