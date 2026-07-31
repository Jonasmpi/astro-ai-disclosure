/**
 * The official EU icon for labelling AI-generated content.
 *
 * Source: https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content
 * Licence, quoted from that page: "These icons are made publicly available for
 * everyone to use freely, without the need for attribution to the Commission or
 * the AI Office." Using the icons is optional; the Article 50 labelling
 * obligations are not.
 *
 * The Commission publishes three marks - a basic "AI" disc plus two wordmarks
 * ("Fully AI-Generated", "Partially AI-Modified"). Only the disc is bundled:
 * the wordmarks are 3:1 strips carrying their own text, which would duplicate
 * the badge label rather than sit inside it as a glyph.
 *
 * The published files colour their paths through an internal style block using
 * generic cls-1 / cls-2 class names. Those are rewritten to direct fill
 * attributes here, because two inlined copies on one page would otherwise fight
 * over the same class names. The path data is verbatim.
 */

/** Which colourway of the mark to use. */
export type EUIconVariant = "white" | "black";

/** White disc with dark letters - for the package's dark badge. */
export const EU_ICON_WHITE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 566.93 566.93" role="presentation"><path fill="#ffffff" fill-rule="evenodd" d="M272.03,100.72c100.92,0,182.74,81.82,182.74,182.75s-81.82,182.74-182.74,182.74-182.75-81.82-182.75-182.74,81.82-182.75,182.75-182.75"/><path fill="#1d1d1b" d="M170.79,353.74c-1.08,0-2.05-.43-2.92-1.31-.88-.87-1.31-1.84-1.31-2.92,0-.67.07-1.27.2-1.81l47.34-129.32c.4-1.48,1.24-2.79,2.52-3.93,1.27-1.14,3.05-1.71,5.34-1.71h29.81c2.28,0,4.06.57,5.34,1.71,1.27,1.14,2.11,2.45,2.52,3.93l47.14,129.32c.27.54.4,1.14.4,1.81,0,1.08-.44,2.05-1.31,2.92s-1.91,1.31-3.12,1.31h-24.78c-2.01,0-3.52-.5-4.53-1.51-1.01-1.01-1.65-1.91-1.91-2.72l-7.86-20.55h-53.78l-7.65,20.55c-.27.81-.88,1.71-1.81,2.72-.94,1.01-2.55,1.51-4.83,1.51h-24.78ZM218.13,299.96h37.47l-18.93-53.18-18.53,53.18Z"/><path fill="#1d1d1b" d="M328.11,353.74c-1.48,0-2.69-.47-3.63-1.41-.94-.94-1.41-2.15-1.41-3.63v-130.93c0-1.48.47-2.68,1.41-3.63s2.15-1.41,3.63-1.41h26.99c1.48,0,2.68.47,3.63,1.41.94.94,1.41,2.15,1.41,3.63v130.93c0,1.48-.47,2.69-1.41,3.63-.94.94-2.15,1.41-3.63,1.41h-26.99Z"/></svg>';

/** Dark disc with white letters - for light backgrounds. */
export const EU_ICON_BLACK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 566.93 566.93" role="presentation"><path fill="#1d1d1b" fill-rule="evenodd" d="M272.03,100.72c100.92,0,182.74,81.82,182.74,182.75s-81.82,182.74-182.74,182.74-182.75-81.82-182.75-182.74,81.82-182.75,182.75-182.75"/><path fill="#ffffff" d="M170.79,353.74c-1.08,0-2.05-.43-2.92-1.31-.88-.87-1.31-1.84-1.31-2.92,0-.67.07-1.27.2-1.81l47.34-129.32c.4-1.48,1.24-2.79,2.52-3.93,1.27-1.14,3.05-1.71,5.34-1.71h29.81c2.28,0,4.06.57,5.34,1.71,1.27,1.14,2.11,2.45,2.52,3.93l47.14,129.32c.27.54.4,1.14.4,1.81,0,1.08-.44,2.05-1.31,2.92s-1.91,1.31-3.12,1.31h-24.78c-2.01,0-3.52-.5-4.53-1.51-1.01-1.01-1.65-1.91-1.91-2.72l-7.86-20.55h-53.78l-7.65,20.55c-.27.81-.88,1.71-1.81,2.72-.94,1.01-2.55,1.51-4.83,1.51h-24.78ZM218.13,299.96h37.47l-18.93-53.18-18.53,53.18Z"/><path fill="#ffffff" d="M328.11,353.74c-1.48,0-2.69-.47-3.63-1.41-.94-.94-1.41-2.15-1.41-3.63v-130.93c0-1.48.47-2.68,1.41-3.63s2.15-1.41,3.63-1.41h26.99c1.48,0,2.68.47,3.63,1.41.94.94,1.41,2.15,1.41,3.63v130.93c0,1.48-.47,2.69-1.41,3.63-.94.94-2.15,1.41-3.63,1.41h-26.99Z"/></svg>';

/** The mark as SVG source. */
export function euIconSvg(variant: EUIconVariant = "white"): string {
  return variant === "black" ? EU_ICON_BLACK : EU_ICON_WHITE;
}

/**
 * The mark as a `data:` URI.
 *
 * URI-encoded rather than base64: it stays readable, avoids the base64 size
 * overhead, and works both in an `<img src>` and in an SVG `<image href>` for
 * the baked badge.
 */
export function euIconDataUri(variant: EUIconVariant = "white"): string {
  return "data:image/svg+xml," + encodeURIComponent(euIconSvg(variant));
}
