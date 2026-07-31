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

/**
 * How the disclosure is rendered.
 *
 * `overlay` is a CSS badge over the image — easy to style, works with any image
 * service, and disappears the moment someone downloads the file. `baked`
 * composites the label into the pixels so it survives, at the cost of requiring
 * this package's Sharp image service.
 */
export type BadgeMode = "overlay" | "baked";

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

/** What to do when a direct `astro:assets` import is found. */
export type EnforcementMode = "off" | "warn" | "error";

/** How loudly a validation rule complains. */
export type ValidationSeverity = "off" | "warn" | "error";

/** The two situations a rule can be configured for separately. */
export type ValidationMode = "development" | "build";

/**
 * A rule's setting: one severity for both modes, or one per mode.
 *
 * Per-mode exists because the useful defaults differ. An image whose metadata
 * is still missing should not stop you working in dev, but must stop a release.
 */
export type ValidationRule =
  ValidationSeverity | Partial<Record<ValidationMode, ValidationSeverity>>;

/** What to do about remote images, which no sidecar can describe. */
export type RemoteImagePolicy = "allow" | "require-explicit-metadata";

/** Validation settings after per-mode rules are collapsed for the current run. */
export interface ResolvedValidationRules {
  missingMetadata: ValidationSeverity;
  reviewRequired: ValidationSeverity;
  remoteImages: RemoteImagePolicy;
}

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
    /** @default "overlay" */
    mode?: BadgeMode;
  };
  /** @default "error" */
  enforcement?: EnforcementMode;
  /** Files exempt from enforcement. */
  exclude?: RegExp[];
  /**
   * An image with neither an inline `ai` prop nor a sidecar.
   * @default { development: "warn", build: "error" }
   */
  missingMetadata?: ValidationRule;
  /**
   * An image still declared `scope: "review-required"`.
   * @default "error"
   */
  reviewRequired?: ValidationRule;
  /**
   * @default "require-explicit-metadata"
   */
  remoteImages?: RemoteImagePolicy;
}

/** Options after defaults are applied and every value is validated. */
export interface ResolvedAIDisclosureConfig {
  policy: DisclosurePolicy;
  defaultLanguage: Language;
  labels: Labels;
  badge: {
    position: BadgePosition;
    mode: BadgeMode;
  };
  enforcement: EnforcementMode;
  exclude: RegExp[];
  /** Per-mode severities, collapsed for a given run by `toVirtualConfig`. */
  validation: {
    missingMetadata: Record<ValidationMode, ValidationSeverity>;
    reviewRequired: Record<ValidationMode, ValidationSeverity>;
    remoteImages: RemoteImagePolicy;
  };
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
> & {
  /** Already collapsed for the mode this build is running in. */
  validation: ResolvedValidationRules;
};

/**
 * Sidecar metadata keyed by the absolute path of the image it describes — the
 * shape of `virtual:ai-image-manifest`.
 */
export type AIImageManifest = Record<string, AIDisclosure>;
