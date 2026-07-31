import type { ImageTransform, LocalImageService } from "astro";
import sharpService from "astro/assets/services/sharp";
import sharp from "sharp";

import { euIconDataUri } from "./eu-icon";
import type { DisclosableKind } from "./types";

/**
 * Astro's own default, copied because the Sharp service does not define
 * `propertiesToHash` — so supplying one replaces the default outright rather
 * than extending it.
 *
 * Getting this wrong is silent and serious: omit `fit` and two images differing
 * only in `fit` hash to the same filename, and the second reuses the first's
 * pixels. `test/image-service.test.ts` compares this list against Astro's real
 * default and fails if it ever changes.
 */
export const ASTRO_DEFAULT_HASH_PROPS = [
  "src",
  "width",
  "height",
  "format",
  "quality",
  "fit",
  "position",
  "background",
] as const;

/** Query parameters carrying the custom props through dev/on-demand URLs. */
export const AI_KIND_PARAM = "aiKind";
export const AI_LABEL_PARAM = "aiLabel";
export const AI_ICON_PARAM = "aiIcon";

/** The extra transform properties this service understands. */
export interface AITransformProps {
  aiKind?: DisclosableKind;
  aiLabel?: string;
  /** `"eu"` composites the official mark into the badge. */
  aiIcon?: string;
}

type AITransform = ImageTransform & AITransformProps;

/** Escapes text for inclusion in SVG. */
export function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

/** Geometry of a baked badge, derived from the image it sits on. */
export interface BadgeGeometry {
  /** Side length of the official mark, or 0 when no icon is shown. */
  iconSize: number;
  /** Gap between the mark and the text. */
  iconGap: number;
  width: number;
  height: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
  radius: number;
  margin: number;
}

/**
 * Sizes the badge relative to the image.
 *
 * Baked labels are composited per responsive width, so a fixed pixel size would
 * be unreadable on a 320px variant and lost on a 1440px one. The floor keeps
 * small variants legible; the cap stops the badge dominating large ones.
 */
export function badgeGeometry(imageWidth: number, label: string, withIcon = false): BadgeGeometry {
  const fontSize = Math.min(48, Math.max(12, Math.round(imageWidth * 0.028)));
  const paddingX = Math.round(fontSize * 0.7);
  const paddingY = Math.round(fontSize * 0.45);
  // Average glyph advance for the bundled sans stack, measured empirically.
  const textWidth = Math.round(label.length * fontSize * 0.58);
  // The mark is square and sits at cap height, with a gap before the text.
  const iconSize = withIcon ? Math.round(fontSize * 1.15) : 0;
  const iconGap = withIcon ? Math.round(fontSize * 0.4) : 0;

  return {
    iconSize,
    iconGap,
    width: textWidth + iconSize + iconGap + paddingX * 2,
    height: fontSize + paddingY * 2,
    fontSize,
    paddingX,
    paddingY,
    radius: Math.round(fontSize * 0.28),
    margin: Math.max(6, Math.round(fontSize * 0.5)),
  };
}

/** Renders the badge as an SVG overlay for compositing. */
export function renderBadgeSvg(label: string, geometry: BadgeGeometry, icon = false): string {
  const text = escapeXml(label);
  const textX = geometry.paddingX + geometry.iconSize + geometry.iconGap;
  const iconY = Math.round((geometry.height - geometry.iconSize) / 2);
  // Sharp rasterises nested <image> with a data: href, so the official mark
  // composites without a second Sharp pass.
  const mark = icon
    ? `<image x="${geometry.paddingX}" y="${iconY}" width="${geometry.iconSize}" height="${geometry.iconSize}" href="${euIconDataUri("white")}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.width}" height="${geometry.height}">
  <rect width="100%" height="100%" rx="${geometry.radius}" fill="rgba(0,0,0,0.78)"/>
  ${mark}
  <text x="${textX}" y="${geometry.paddingY + Math.round(geometry.fontSize * 0.8)}"
        fill="#ffffff" font-family="DejaVu Sans, Arial, Helvetica, sans-serif"
        font-size="${geometry.fontSize}" font-weight="600">${text}</text>
</svg>`;
}

/** The label to bake when none was supplied explicitly. */
export function defaultBakedLabel(kind: DisclosableKind): string {
  switch (kind) {
    case "generated":
      return "AI-generated";
    case "modified":
      return "AI-modified";
    default:
      return "AI-assisted";
  }
}

/** Reads this service's custom props off a transform. */
export function readAIProps(options: Record<string, unknown>): AITransformProps {
  const kind = options[AI_KIND_PARAM];
  const label = options[AI_LABEL_PARAM];
  return {
    ...(typeof kind === "string" && kind !== "" && { aiKind: kind as DisclosableKind }),
    ...(typeof label === "string" && label !== "" && { aiLabel: label }),
    ...(options[AI_ICON_PARAM] === "eu" && { aiIcon: "eu" }),
  };
}

/** Appends the custom props to a URL produced by the base service. */
export function appendAIParams(url: string, props: AITransformProps): string {
  if (props.aiKind === undefined && props.aiLabel === undefined && props.aiIcon === undefined)
    return url;

  const separator = url.includes("?") ? "&" : "?";
  const params = new URLSearchParams();
  if (props.aiKind !== undefined) params.set(AI_KIND_PARAM, props.aiKind);
  if (props.aiLabel !== undefined) params.set(AI_LABEL_PARAM, props.aiLabel);
  if (props.aiIcon !== undefined) params.set(AI_ICON_PARAM, props.aiIcon);
  return `${url}${separator}${params.toString()}`;
}

/**
 * Composites the badge onto an already-optimized image.
 *
 * Exported so the pixel behaviour can be tested without going through Astro.
 */
export async function bakeBadge(
  image: Uint8Array,
  label: string,
  icon = false,
): Promise<{ data: Uint8Array; width: number }> {
  const pipeline = sharp(image);
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 1000;
  const height = metadata.height ?? Math.round(width * 0.6);

  const geometry = badgeGeometry(width, label, icon);
  const badge = Buffer.from(renderBadgeSvg(label, geometry, icon));

  // `top`/`left` are absolute offsets, and Sharp ignores `gravity` whenever
  // both are supplied — so the corner has to be computed rather than named.
  // The kickoff sketch passed `gravity: "southeast"` alongside them, which
  // silently placed the badge in the top-left instead.
  const left = Math.max(0, width - geometry.width - geometry.margin);
  const top = Math.max(0, height - geometry.height - geometry.margin);

  const composited = await pipeline.composite([{ input: badge, top, left }]).toBuffer();

  return { data: new Uint8Array(composited), width };
}

/**
 * Sharp image service that bakes the disclosure label into the pixels, so the
 * label survives someone downloading or re-sharing the image.
 *
 * Wraps Astro's Sharp service rather than replacing it: every transform still
 * goes through the default pipeline first, and images without `aiKind` are
 * returned untouched.
 */
const service: LocalImageService = {
  ...sharpService,

  propertiesToHash: [...ASTRO_DEFAULT_HASH_PROPS, AI_KIND_PARAM, AI_LABEL_PARAM, AI_ICON_PARAM],

  getURL(options, imageConfig) {
    const base = sharpService.getURL(options, imageConfig);
    const props = readAIProps(options as Record<string, unknown>);
    return typeof base === "string"
      ? appendAIParams(base, props)
      : Promise.resolve(base).then((resolved) => appendAIParams(resolved, props));
  },

  // Astro types this as `… | Promise<LocalImageTransform> | Promise<undefined>`,
  // which no `async` function can satisfy — every one returns
  // `Promise<T | undefined>`. The cast is on the signature, not the behaviour.
  parseURL: (async (url, imageConfig) => {
    const parsed = await sharpService.parseURL(url, imageConfig);
    if (!parsed) return undefined;

    const kind = url.searchParams.get(AI_KIND_PARAM);
    const label = url.searchParams.get(AI_LABEL_PARAM);
    const icon = url.searchParams.get(AI_ICON_PARAM);
    return {
      ...parsed,
      ...(kind && { [AI_KIND_PARAM]: kind }),
      ...(label && { [AI_LABEL_PARAM]: label }),
      ...(icon && { [AI_ICON_PARAM]: icon }),
    };
  }) as LocalImageService["parseURL"],

  async transform(inputBuffer, transformOptions, imageConfig) {
    const optimized = await sharpService.transform(inputBuffer, transformOptions, imageConfig);

    const { aiKind, aiLabel, aiIcon } = readAIProps(
      transformOptions as unknown as Record<string, unknown>,
    );
    if (aiKind === undefined) return optimized;

    const { data } = await bakeBadge(
      optimized.data,
      aiLabel ?? defaultBakedLabel(aiKind),
      aiIcon === "eu",
    );
    return { data, format: optimized.format };
  },
};

export type { AITransform };
export default service;
