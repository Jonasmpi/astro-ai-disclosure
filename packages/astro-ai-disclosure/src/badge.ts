import { resolveLabel, shouldDisclose } from "./disclosure";
import type {
  AIDisclosure,
  BadgeMode,
  BadgePosition,
  DisclosurePolicy,
  Language,
  VirtualDisclosureConfig,
} from "./types";

/**
 * Per-image props that override the central configuration. Every field is
 * optional; anything omitted falls back to the integration's resolved config.
 */
export interface DisclosureOverrides {
  ai?: AIDisclosure;
  policy?: DisclosurePolicy;
  language?: Language;
  badgePosition?: BadgePosition;
  badgeMode?: BadgeMode;
}

/**
 * Reads the absolute source path of an imported image.
 *
 * Astro's asset import returns a `Proxy` that answers `fsPath` with the
 * original file path, identically in dev and in a production build — unlike
 * `src`, which is `/@fs/…` in dev and a hashed `/_astro/…` in a build. That
 * makes `fsPath` the only stable key for matching an image to its sidecar.
 *
 * `fsPath` is **not** part of Astro's public `ImageMetadata` type, so this is
 * the single point of coupling to that detail: if a future Astro version stops
 * exposing it, this function returns `undefined` and sidecar resolution stops
 * working — rather than resolving something wrong.
 *
 * Returns `undefined` for remote images and plain strings, which have no local
 * file at all.
 */
export function imageFsPath(image: unknown): string | undefined {
  if (typeof image !== "object" || image === null) return undefined;
  const value = (image as { fsPath?: unknown }).fsPath;
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Resolves the declaration for an image: an inline `ai` prop always wins, and
 * the sidecar manifest is the fallback.
 *
 * Inline-over-sidecar matters because a page may legitimately override what the
 * asset's own metadata says — a crop, a different context — and the author's
 * explicit prop is the more specific statement.
 */
export function resolveDisclosure(
  inline: AIDisclosure | undefined,
  image: unknown,
  manifest: Readonly<Record<string, AIDisclosure>> = {},
): AIDisclosure | undefined {
  if (inline !== undefined) return inline;
  const path = imageFsPath(image);
  return path === undefined ? undefined : manifest[path];
}

/** Machine-readable declaration mirrored onto the wrapper element. */
export interface DisclosureDataAttributes {
  "data-ai-kind"?: string;
  "data-ai-scope"?: string;
  "data-ai-provider"?: string;
  "data-ai-model"?: string;
  "data-ai-created-at"?: string;
}

/**
 * Everything a component needs to render the disclosure, computed once so the
 * `.astro` files stay declarative and the logic stays unit-testable.
 */
export interface BadgeView {
  /** Whether the visible badge is rendered. */
  show: boolean;
  /** Visible badge text. Empty when there is nothing to show. */
  label: string;
  /** Accessible name for the badge. */
  description: string;
  /** Resolved badge corner. */
  position: BadgePosition;
  /** Whether the label is an overlay or composited into the pixels. */
  mode: BadgeMode;
  /** Attributes for the wrapper element; present whenever metadata was given. */
  data: DisclosureDataAttributes;
}

/**
 * Builds the machine-readable attributes.
 *
 * Emitted whenever metadata exists, **including when no badge is shown** — a
 * declaration of `kind: "none"` or `scope: "not-in-scope"` is information worth
 * keeping in the markup, and the compliance report in step 2.3 reads it.
 */
function dataAttributes(ai: AIDisclosure | undefined): DisclosureDataAttributes {
  if (ai === undefined) return {};

  const data: DisclosureDataAttributes = {
    "data-ai-kind": ai.kind,
    "data-ai-scope": ai.scope,
  };
  if (ai.provider !== undefined) data["data-ai-provider"] = ai.provider;
  if (ai.model !== undefined) data["data-ai-model"] = ai.model;
  if (ai.createdAt !== undefined) data["data-ai-created-at"] = ai.createdAt;
  return data;
}

/**
 * Composes the badge's accessible name.
 *
 * Only the visible label and the author's own `description` are included.
 * `provider` and `model` are deliberately left out: they would need English
 * prefixes like "Provider:" that no label set translates, and a screen-reader
 * name should stay short. Both remain available as `data-ai-*` attributes.
 */
function accessibleDescription(label: string, ai: AIDisclosure | undefined): string {
  return [label, ai?.description].filter((part): part is string => Boolean(part)).join(". ");
}

/**
 * Resolves per-image overrides against the central config and decides what the
 * component renders.
 */
export function resolveBadge(
  overrides: DisclosureOverrides,
  config: VirtualDisclosureConfig,
): BadgeView {
  const { ai } = overrides;
  const policy = overrides.policy ?? config.policy;
  const language = overrides.language ?? config.defaultLanguage;
  const position = overrides.badgePosition ?? config.badge.position;
  const mode = overrides.badgeMode ?? config.badge.mode;

  const label = resolveLabel(ai, language, config.labels);

  return {
    show: shouldDisclose(ai, policy),
    label,
    description: accessibleDescription(label, ai),
    position,
    mode,
    data: dataAttributes(ai),
  };
}
