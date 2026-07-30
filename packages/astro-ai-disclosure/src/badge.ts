import { resolveLabel, shouldDisclose } from "./disclosure";
import type {
  AIDisclosure,
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

  const label = resolveLabel(ai, language, config.labels);

  return {
    show: shouldDisclose(ai, policy),
    label,
    description: accessibleDescription(label, ai),
    position,
    data: dataAttributes(ai),
  };
}
