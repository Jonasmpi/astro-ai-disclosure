import { imageFsPath } from "./badge";
import type { AIDisclosure, ResolvedValidationRules, ValidationSeverity } from "./types";

/** Which rule produced an issue. */
export type ValidationRuleName = "missingMetadata" | "reviewRequired" | "remoteImages";

/** A problem found with one image's declaration. */
export interface ValidationIssue {
  rule: ValidationRuleName;
  severity: "warn" | "error";
  message: string;
}

/** Whether `src` points at a remote image rather than a local asset. */
export function isRemoteImage(image: unknown): boolean {
  return typeof image === "string" && /^https?:\/\//i.test(image);
}

/**
 * A human-recognisable name for an image, for use in diagnostics.
 *
 * Prefers the source path, since that is what an author can act on. Falls back
 * to whatever `src` is — a remote URL, or a path under `public/`.
 */
export function describeImage(image: unknown): string {
  const fsPath = imageFsPath(image);
  if (fsPath !== undefined) return fsPath;
  if (typeof image === "string" && image !== "") return image;
  if (typeof image === "object" && image !== null) {
    const src = (image as { src?: unknown }).src;
    if (typeof src === "string" && src !== "") return src;
  }
  return "<unknown image>";
}

function issue(
  rule: ValidationRuleName,
  severity: ValidationSeverity,
  message: string,
): ValidationIssue | undefined {
  return severity === "off" ? undefined : { rule, severity, message };
}

/**
 * Checks one image's resolved declaration against the configured rules.
 *
 * Returns at most one issue, most specific first: a remote image without inline
 * metadata is reported as such rather than as generic missing metadata, because
 * the fix differs — a sidecar cannot describe a file that is not on disk.
 */
export function validateDisclosure(
  disclosure: AIDisclosure | undefined,
  image: unknown,
  rules: ResolvedValidationRules,
): ValidationIssue | undefined {
  const name = describeImage(image);

  if (disclosure === undefined && isRemoteImage(image)) {
    if (rules.remoteImages === "require-explicit-metadata") {
      return issue(
        "remoteImages",
        "error",
        `Remote image has no AI metadata: ${name}\n` +
          "A sidecar cannot describe a file that is not on disk, so pass an `ai` prop explicitly.\n" +
          'To allow unlabelled remote images, set `remoteImages: "allow"`.',
      );
    }
    return undefined;
  }

  if (disclosure === undefined) {
    return issue(
      "missingMetadata",
      rules.missingMetadata,
      `Image has no AI metadata: ${name}\n` +
        "Declare it inline with an `ai` prop, or add a sidecar next to the asset:\n" +
        `  ${name}.ai.json\n` +
        'An image with no AI involvement is declared as `{ "kind": "none", "scope": "not-in-scope" }`.',
    );
  }

  if (disclosure.scope === "review-required") {
    return issue(
      "reviewRequired",
      rules.reviewRequired,
      `Image is still awaiting review: ${name}\n` +
        '`scope: "review-required"` means nobody has decided whether this image needs a visible\n' +
        "label. Replace it with the scope that applies before shipping.",
    );
  }

  return undefined;
}

/** Prefix that makes the source of a console warning obvious. */
const PREFIX = "[@jonasmpi/astro-ai-disclosure]";

/** Thrown when a validation rule is set to `error` and fires. */
export class AIDisclosureValidationError extends Error {
  override readonly name = "AIDisclosureValidationError";
  readonly rule: ValidationRuleName;

  constructor(issueFound: ValidationIssue) {
    super(`${PREFIX} ${issueFound.message}`);
    this.rule = issueFound.rule;
  }
}

/**
 * Applies an issue: throws for `error`, logs for `warn`.
 *
 * Kept separate from {@link validateDisclosure} so the decision is testable
 * without capturing console output or catching exceptions.
 */
export function reportIssue(
  issueFound: ValidationIssue | undefined,
  warn: (message: string) => void = console.warn,
): void {
  if (issueFound === undefined) return;
  if (issueFound.severity === "error") throw new AIDisclosureValidationError(issueFound);
  warn(`${PREFIX} ${issueFound.message}`);
}
