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
  ResolvedAIDisclosureConfig,
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
  };
}

/** Narrows the resolved config to what components need at runtime. */
export function toVirtualConfig(config: ResolvedAIDisclosureConfig): VirtualDisclosureConfig {
  return {
    policy: config.policy,
    defaultLanguage: config.defaultLanguage,
    labels: config.labels,
    badge: { position: config.badge.position },
  };
}
