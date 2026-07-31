/**
 * Type vocabulary for AI disclosure. Types only — the pure helpers that act on
 * them live in `./disclosure`.
 */

/**
 * How the image was made, technically. Deliberately separate from
 * {@link LegalScope}: an image can be fully AI-generated without attracting the
 * same disclosure obligation as a deepfake.
 *
 * - `none` — no AI involvement. An explicit declaration, not an absence of one.
 * - `assisted` — ordinary AI-supported editing (colour correction, denoise).
 * - `modified` — existing image materially altered by AI.
 * - `generated` — synthesised by an AI system.
 */
export type AIImageKind = "none" | "assisted" | "modified" | "generated";

/**
 * How the image is classified for disclosure purposes. This is a judgement the
 * author records; the package never infers it.
 *
 * - `not-in-scope` — no visible label required.
 * - `deepfake` — resembles a real person, place, entity or event closely enough
 *   to appear authentic. The core Article 50 case for a website deployer.
 * - `creative-work` — part of an evidently artistic or fictional work, where
 *   disclosure is expected in a manner that does not spoil the work.
 * - `review-required` — not yet assessed. Treated as disclosing, and step 2.2
 *   fails the build on it.
 */
export type LegalScope = "not-in-scope" | "deepfake" | "creative-work" | "review-required";

/**
 * Which declarations get a visible label.
 *
 * - `eu-article-50` — label only what is declared in scope (package default).
 * - `all-ai` — label any declared AI involvement. Stricter than the law
 *   requires; the recommended setting for organisation-wide consistency.
 */
export type DisclosurePolicy = "eu-article-50" | "all-ai";

/** Languages with built-in labels. */
export type Language = "de" | "en";

/** Where the badge sits over the image. */
export type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Kinds that can carry a visible label — everything except `none`. */
export type DisclosableKind = Exclude<AIImageKind, "none">;

/** The AI metadata recorded for a single image. */
export interface AIDisclosure {
  kind: AIImageKind;
  scope: LegalScope;
  /** Tool or vendor, e.g. `"OpenAI"`. */
  provider?: string;
  /** Model identifier, e.g. `"GPT Image"`. */
  model?: string;
  /** ISO date the image was produced, e.g. `"2026-07-20"`. */
  createdAt?: string;
  /** Free-text note about what the AI actually did. */
  description?: string;
  /** Overrides the generated visible label. */
  label?: string;
}

/** Visible label per disclosable kind, for one language. */
export type LabelSet = Record<DisclosableKind, string>;

/** Visible labels for every supported language. */
export type Labels = Record<Language, LabelSet>;

/** Labels as a consumer may supply them: any subset, deep-merged with defaults. */
export type PartialLabels = {
  [L in Language]?: Partial<LabelSet>;
};

/** What to do when a direct `astro:assets` import is found (wired up in step 1.5). */
export type EnforcementMode = "off" | "warn" | "error";

/** Options accepted by the integration. Every field has a default. */
export interface AIDisclosureOptions {
  /** @default "eu-article-50" */
  policy?: DisclosurePolicy;
  /** @default "en" */
  defaultLanguage?: Language;
  /** Deep-merged with the built-in labels. */
  labels?: PartialLabels;
  badge?: {
    /** @default "bottom-right" */
    position?: BadgePosition;
  };
  /** @default "error" */
  enforcement?: EnforcementMode;
  /** Files exempt from enforcement. */
  exclude?: RegExp[];
}

/** Options after defaults are applied and every value is validated. */
export interface ResolvedAIDisclosureConfig {
  policy: DisclosurePolicy;
  defaultLanguage: Language;
  labels: Labels;
  badge: {
    position: BadgePosition;
  };
  enforcement: EnforcementMode;
  exclude: RegExp[];
}

/**
 * The part of the resolved config that reaches components through
 * `virtual:astro-ai-disclosure/config`.
 *
 * `enforcement` and `exclude` are deliberately absent: they only matter to the
 * build-time Vite plugin, and `exclude` holds `RegExp`s, which do not survive
 * the JSON serialisation the virtual module relies on.
 */
export type VirtualDisclosureConfig = Pick<
  ResolvedAIDisclosureConfig,
  "policy" | "defaultLanguage" | "labels" | "badge"
>;

/**
 * Sidecar metadata keyed by the absolute path of the image it describes — the
 * shape of `virtual:ai-image-manifest`.
 */
export type AIImageManifest = Record<string, AIDisclosure>;
