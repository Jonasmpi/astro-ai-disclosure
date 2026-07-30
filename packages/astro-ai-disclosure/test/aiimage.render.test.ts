import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import AIImage from "../src/components/AIImage.astro";
import type { AIDisclosure } from "../src/types";

/**
 * A stand-in for an imported local image. `AIImage` passes it straight to
 * `<Image>`, so only the shape matters here.
 */
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

async function render(props: Record<string, unknown>): Promise<string> {
  return container.renderToString(AIImage, {
    props: { src, alt: "A test photograph", ...props },
  });
}

const countOf = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

describe("AIImage — badge presence follows the policy", () => {
  it("renders a badge for an in-scope generated image", async () => {
    const html = await render({ ai: { kind: "generated", scope: "deepfake" } });
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(1);
    expect(html).toContain('role="note"');
  });

  it("renders no badge under eu-article-50 for a not-in-scope image", async () => {
    const html = await render({
      ai: { kind: "generated", scope: "not-in-scope" },
      policy: "eu-article-50",
    });
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(0);
    expect(html).not.toContain('role="note"');
  });

  it("renders a badge for the same image under the site's all-ai policy", async () => {
    const html = await render({ ai: { kind: "generated", scope: "not-in-scope" } });
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(1);
  });

  it("renders no badge without metadata", async () => {
    const html = await render({});
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(0);
  });

  it("always renders the image itself", async () => {
    for (const props of [{}, { ai: { kind: "generated", scope: "deepfake" } }]) {
      expect(countOf(await render(props), /<img/g)).toBe(1);
    }
  });
});

describe("AIImage — reads the central config", () => {
  it("uses the configured language for the label", async () => {
    const html = await render({ ai: { kind: "generated", scope: "deepfake" } });
    // "Von KI erzeugt" is the label override in vitest.config.ts, not a default.
    expect(html).toContain("Von KI erzeugt");
    expect(html).not.toContain("AI-generated");
  });

  it("uses the configured badge position", async () => {
    const html = await render({ ai: { kind: "generated", scope: "deepfake" } });
    expect(html).toContain("ai-disclosure--top-left");
  });

  it("lets a prop override the configured position", async () => {
    const html = await render({
      ai: { kind: "generated", scope: "deepfake" },
      badgePosition: "bottom-right",
    });
    expect(html).toContain("ai-disclosure--bottom-right");
    expect(html).not.toContain("ai-disclosure--top-left");
  });

  it("lets a prop override the configured language", async () => {
    const html = await render({
      ai: { kind: "generated", scope: "deepfake" },
      language: "en",
    });
    expect(html).toContain("AI-generated");
  });
});

describe("AIImage — data attributes", () => {
  const ai: AIDisclosure = {
    kind: "modified",
    scope: "deepfake",
    provider: "OpenAI",
    model: "GPT Image",
    createdAt: "2026-07-20",
  };

  it("mirrors the declaration onto the wrapper", async () => {
    const html = await render({ ai });
    expect(html).toContain('data-ai-kind="modified"');
    expect(html).toContain('data-ai-scope="deepfake"');
    expect(html).toContain('data-ai-provider="OpenAI"');
    expect(html).toContain('data-ai-model="GPT Image"');
    expect(html).toContain('data-ai-created-at="2026-07-20"');
  });

  it("keeps the attributes when the badge is withheld", async () => {
    const html = await render({
      ai: { kind: "generated", scope: "not-in-scope" },
      policy: "eu-article-50",
    });
    expect(countOf(html, /ai-disclosure__badge/g)).toBe(0);
    expect(html).toContain('data-ai-kind="generated"');
  });

  it("emits no data-ai attributes without metadata", async () => {
    expect(await render({})).not.toContain("data-ai-");
  });
});

describe("AIImage — accessibility", () => {
  it("labels the badge with the resolved description", async () => {
    const html = await render({
      ai: { kind: "generated", scope: "deepfake", description: "Synthetic scene" },
    });
    expect(html).toContain('aria-label="Von KI erzeugt. Synthetic scene"');
    expect(html).toContain('title="Von KI erzeugt. Synthetic scene"');
  });

  it("hides the decorative AI glyph from assistive technology", async () => {
    const html = await render({ ai: { kind: "generated", scope: "deepfake" } });
    expect(html).toContain('aria-hidden="true"');
  });

  it("keeps the author's alt text on the image", async () => {
    const html = await render({ ai: { kind: "generated", scope: "deepfake" } });
    expect(html).toContain('alt="A test photograph"');
  });
});

describe("AIImage — passes image props through", () => {
  it("forwards the consumer's class to the image, not the wrapper", async () => {
    const html = await render({ class: "rounded", ai: { kind: "none", scope: "not-in-scope" } });
    expect(html).toMatch(/<img[^>]*class="[^"]*rounded/);
  });

  it("forwards optimization props such as widths and sizes", async () => {
    const html = await render({
      widths: [640, 960],
      sizes: "(max-width: 768px) 100vw, 640px",
      ai: { kind: "generated", scope: "deepfake" },
    });
    expect(html).toContain("srcset");
    expect(html).toContain('sizes="(max-width: 768px) 100vw, 640px"');
  });
});
