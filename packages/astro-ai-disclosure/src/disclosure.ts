import type {
  AIDisclosure,
  DisclosableKind,
  DisclosurePolicy,
  Labels,
  Language,
  LegalScope,
} from "./types";

/**
 * Built-in visible labels. Consumers may override any subset via the `labels`
 * option; see {@link resolveLabel}.
 */
export const DEFAULT_LABELS: Labels = {
  de: {
    generated: "KI-generiert",
    modified: "Mit KI verändert",
    assisted: "Mit KI-Unterstützung",
  },
  en: {
    generated: "AI-generated",
    modified: "AI-modified",
    assisted: "AI-assisted",
  },
};

/**
 * Scopes that require a visible label under `eu-article-50`.
 *
 * `review-required` is included deliberately. It means "nobody has classified
 * this yet", which is not the same as "not in scope": staying silent risks
 * missing a disclosure obligation, whereas labelling states something the
 * author already declared through `kind`. Step 2.2 additionally fails the build
 * so the placeholder cannot ship unnoticed.
 */
const DISCLOSING_SCOPES: ReadonlySet<LegalScope> = new Set<LegalScope>([
  "deepfake",
  "creative-work",
  "review-required",
]);

/** Metadata that declares some AI involvement, i.e. any `kind` but `none`. */
type DisclosableDisclosure = AIDisclosure & { kind: DisclosableKind };

/**
 * Whether the image declares any AI involvement at all.
 *
 * Narrows `kind` away from `none`, so callers can index the label sets without
 * a cast.
 */
export function containsAI(ai: AIDisclosure | undefined): ai is DisclosableDisclosure {
  return ai !== undefined && ai.kind !== "none";
}

/**
 * Whether a visible disclosure badge must be rendered.
 *
 * `all-ai` labels every declared AI involvement; `eu-article-50` labels only
 * what is declared in a disclosing scope. Missing metadata never discloses —
 * an undeclared image is handled by the validation rules in step 2.2, not here.
 */
export function shouldDisclose(ai: AIDisclosure | undefined, policy: DisclosurePolicy): boolean {
  if (!containsAI(ai)) return false;
  if (policy === "all-ai") return true;
  return DISCLOSING_SCOPES.has(ai.scope);
}

/**
 * The visible label text for an image.
 *
 * An explicit `ai.label` always wins, including for `kind: "none"` — an author
 * who wrote a label meant it. Otherwise the label comes from `labels` for the
 * given language. Returns `""` when there is nothing to show, so callers can
 * treat the result as falsy.
 */
export function resolveLabel(
  ai: AIDisclosure | undefined,
  language: Language,
  labels: Labels = DEFAULT_LABELS,
): string {
  if (ai?.label !== undefined && ai.label !== "") return ai.label;
  if (!containsAI(ai)) return "";
  return labels[language][ai.kind];
}
