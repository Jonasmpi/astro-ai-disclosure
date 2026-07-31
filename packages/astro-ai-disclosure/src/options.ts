import { DEFAULT_LABELS } from "./disclosure";
import type {
  AIDisclosureOptions,
  BadgePosition,
  DisclosableKind,
  DisclosurePolicy,
  EnforcementMode,
  Labels,
  Language,
  PartialLabels,
  RemoteImagePolicy,
  ResolvedAIDisclosureConfig,
  ValidationMode,
  ValidationRule,
  ValidationSeverity,
  VirtualDisclosureConfig,
} from "./types";

const POLICIES = ["eu-article-50", "all-ai"] as const satisfies readonly DisclosurePolicy[];
const LANGUAGES = ["de", "en"] as const satisfies readonly Language[];
const BADGE_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const satisfies readonly BadgePosition[];
const ENFORCEMENT_MODES = ["off", "warn", "error"] as const satisfies readonly EnforcementMode[];
const SEVERITIES = ["off", "warn", "error"] as const satisfies readonly ValidationSeverity[];
const REMOTE_POLICIES = [
  "allow",
  "require-explicit-metadata",
] as const satisfies readonly RemoteImagePolicy[];
const VALIDATION_MODES = ["development", "build"] as const satisfies readonly ValidationMode[];

/**
 * Default validation severities.
 *
 * `missingMetadata` differs by mode on purpose: an undeclared image should not
 * interrupt you mid-edit, but it must not reach production either.
 */
export const DEFAULT_VALIDATION = {
  missingMetadata: { development: "warn", build: "error" },
  reviewRequired: { development: "error", build: "error" },
  remoteImages: "require-explicit-metadata",
} as const satisfies {
  missingMetadata: Record<ValidationMode, ValidationSeverity>;
  reviewRequired: Record<ValidationMode, ValidationSeverity>;
  remoteImages: RemoteImagePolicy;
};

/** Defaults applied to any option the consumer leaves out. */
export const DEFAULT_OPTIONS = {
  policy: "eu-article-50",
  defaultLanguage: "en",
  badgePosition: "bottom-right",
  enforcement: "error",
} as const satisfies {
  policy: DisclosurePolicy;
  defaultLanguage: Language;
  badgePosition: BadgePosition;
  enforcement: EnforcementMode;
};

/** Thrown when the integration is given options it cannot work with. */
export class AIDisclosureConfigError extends Error {
  override readonly name = "AIDisclosureConfigError";

  constructor(message: string) {
    super(`[@jonasmpi/astro-ai-disclosure] ${message}`);
  }
}

function quote(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

/**
 * Validates a single option against its allowed values, falling back to
 * `fallback` when the option was not supplied.
 */
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  option: string,
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new AIDisclosureConfigError(
    `Invalid \`${option}\`: ${JSON.stringify(value)}. Expected one of ${quote(allowed)}.`,
  );
}

/**
 * Deep-merges consumer labels over the built-in ones, language by language and
 * kind by kind, so overriding one string never drops the rest.
 *
 * Returns a fresh object; {@link DEFAULT_LABELS} is never mutated.
 */
export function mergeLabels(overrides: PartialLabels | undefined): Labels {
  const merged = {} as Labels;

  for (const language of LANGUAGES) {
    const base = DEFAULT_LABELS[language];
    const override = overrides?.[language];

    if (override !== undefined && (typeof override !== "object" || Array.isArray(override))) {
      throw new AIDisclosureConfigError(
        `Invalid \`labels.${language}\`: expected an object of label strings.`,
      );
    }

    merged[language] = { ...base };

    for (const [kind, label] of Object.entries(override ?? {})) {
      if (!(kind in base)) {
        throw new AIDisclosureConfigError(
          `Unknown label kind \`labels.${language}.${kind}\`. Expected one of ${quote(
            Object.keys(base),
          )}.`,
        );
      }
      if (typeof label !== "string" || label === "") {
        throw new AIDisclosureConfigError(
          `Invalid \`labels.${language}.${kind}\`: expected a non-empty string.`,
        );
      }
      merged[language][kind as DisclosableKind] = label;
    }
  }

  return merged;
}

function resolveExclude(exclude: unknown): RegExp[] {
  if (exclude === undefined) return [];
  if (!Array.isArray(exclude)) {
    throw new AIDisclosureConfigError(
      "Invalid `exclude`: expected an array of regular expressions.",
    );
  }
  exclude.forEach((pattern, index) => {
    if (!(pattern instanceof RegExp)) {
      throw new AIDisclosureConfigError(
        `Invalid \`exclude[${index}]\`: expected a RegExp, received ${typeof pattern}.`,
      );
    }
  });
  return [...(exclude as RegExp[])];
}

/**
 * Applies defaults and validates every option, producing the config the rest of
 * the integration works with. Throws {@link AIDisclosureConfigError} with an
 * actionable message rather than silently ignoring a bad value.
 */
export function resolveOptions(options: AIDisclosureOptions = {}): ResolvedAIDisclosureConfig {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new AIDisclosureConfigError("Expected an options object.");
  }

  return {
    policy: oneOf(options.policy, POLICIES, "policy", DEFAULT_OPTIONS.policy),
    defaultLanguage: oneOf(
      options.defaultLanguage,
      LANGUAGES,
      "defaultLanguage",
      DEFAULT_OPTIONS.defaultLanguage,
    ),
    labels: mergeLabels(options.labels),
    badge: {
      position: oneOf(
        options.badge?.position,
        BADGE_POSITIONS,
        "badge.position",
        DEFAULT_OPTIONS.badgePosition,
      ),
    },
    enforcement: oneOf(
      options.enforcement,
      ENFORCEMENT_MODES,
      "enforcement",
      DEFAULT_OPTIONS.enforcement,
    ),
    exclude: resolveExclude(options.exclude),
    validation: {
      missingMetadata: resolveValidationRule(
        options.missingMetadata,
        "missingMetadata",
        DEFAULT_VALIDATION.missingMetadata,
      ),
      reviewRequired: resolveValidationRule(
        options.reviewRequired,
        "reviewRequired",
        DEFAULT_VALIDATION.reviewRequired,
      ),
      remoteImages: oneOf(
        options.remoteImages,
        REMOTE_POLICIES,
        "remoteImages",
        DEFAULT_VALIDATION.remoteImages,
      ),
    },
  };
}

/**
 * Expands a rule into a severity per mode. A bare string applies to both.
 */
export function resolveValidationRule(
  rule: ValidationRule | undefined,
  option: string,
  fallback: Record<ValidationMode, ValidationSeverity>,
): Record<ValidationMode, ValidationSeverity> {
  if (rule === undefined) return { ...fallback };

  if (typeof rule === "string") {
    const severity = oneOf(rule, SEVERITIES, option, fallback.build);
    return { development: severity, build: severity };
  }

  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    throw new AIDisclosureConfigError(
      `Invalid \`${option}\`: expected ${quote(SEVERITIES)} or an object keyed by ${quote(
        VALIDATION_MODES,
      )}.`,
    );
  }

  for (const key of Object.keys(rule)) {
    if (!(VALIDATION_MODES as readonly string[]).includes(key)) {
      throw new AIDisclosureConfigError(
        `Unknown key \`${option}.${key}\`. Expected ${quote(VALIDATION_MODES)}.`,
      );
    }
  }

  return {
    development: oneOf(rule.development, SEVERITIES, `${option}.development`, fallback.development),
    build: oneOf(rule.build, SEVERITIES, `${option}.build`, fallback.build),
  };
}

/** Narrows the resolved config to what components need at runtime. */
export function toVirtualConfig(
  config: ResolvedAIDisclosureConfig,
  mode: ValidationMode = "build",
): VirtualDisclosureConfig {
  return {
    policy: config.policy,
    defaultLanguage: config.defaultLanguage,
    labels: config.labels,
    badge: { position: config.badge.position },
    // Collapsed here rather than in the component: the integration knows which
    // command Astro is running, and a component should not have to guess.
    validation: {
      missingMetadata: config.validation.missingMetadata[mode],
      reviewRequired: config.validation.reviewRequired[mode],
      remoteImages: config.validation.remoteImages,
    },
  };
}
