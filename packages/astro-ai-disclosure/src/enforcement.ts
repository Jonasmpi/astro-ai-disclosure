import { readFileSync } from "node:fs";

import type { Plugin } from "vite";

import type { EnforcementMode } from "./types";

/** Bindings from `astro:assets` that must go through this package instead. */
export const FORBIDDEN_BINDINGS = ["Image", "Picture"] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_BINDINGS);

/** Files whose imports are inspected. */
const CHECKED_EXTENSIONS = [".astro", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"];

/** A forbidden import found in a source file. */
export interface ForbiddenImport {
  /** The name as exported by `astro:assets`, or `*` for a namespace import. */
  imported: string;
  /** The local binding it was given. */
  local: string;
}

/** Placeholder standing in for a masked character. */
const MASK = " ";

/**
 * Blanks out comments and the *contents* of string literals, preserving length
 * and every other character so offsets still line up with the original source.
 *
 * Both halves matter. Without masking comments, a commented-out import would
 * fail the build. Without masking string contents, so would frontmatter that
 * merely quotes an import — `const snippet = 'import { Image } from "…"'` — and
 * since enforcement defaults to `error`, a false positive breaks a build for a
 * file that does nothing wrong.
 *
 * Quotes are kept so the scan can still find `from "…"`; the specifier itself is
 * read back out of the original text by offset.
 */
export function maskStringsAndComments(code: string): string {
  let out = "";
  let index = 0;

  while (index < code.length) {
    const char = code[index]!;
    const next = code[index + 1];

    if (char === "/" && next === "/") {
      while (index < code.length && code[index] !== "\n") {
        out += MASK;
        index++;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      const close = code.indexOf("*/", index + 2);
      // An unterminated comment runs to the end of the file.
      const stop = close === -1 ? code.length : close + 2;
      out += MASK.repeat(stop - index);
      index = stop;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      out += char;
      index++;
      while (index < code.length) {
        const inner = code[index]!;
        if (inner === "\\") {
          out += MASK;
          index++;
          if (index < code.length) {
            out += MASK;
            index++;
          }
          continue;
        }
        if (inner === quote) {
          out += quote;
          index++;
          break;
        }
        out += MASK;
        index++;
      }
      continue;
    }

    out += char;
    index++;
  }

  return out;
}

/**
 * Returns the frontmatter of an `.astro` file — the code between the leading
 * `---` fences. The template body cannot contain imports, so scanning it would
 * only invite false positives from prose.
 *
 * Returns `""` when the file has no frontmatter.
 */
export function extractFrontmatter(code: string): string {
  const start = code.indexOf("---");
  if (start === -1) return "";
  // Only a leading fence opens frontmatter; anything before it must be blank.
  if (code.slice(0, start).trim() !== "") return "";

  const end = code.indexOf("\n---", start + 3);
  if (end === -1) return "";
  return code.slice(start + 3, end);
}

/** Parses one import clause, e.g. `{ Image as Img, getImage }` or `* as assets`. */
function parseClause(clause: string): ForbiddenImport[] {
  const trimmed = clause.trim();

  // `import * as assets from "astro:assets"` — assets.Image is reachable.
  const namespace = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(trimmed);
  if (namespace) return [{ imported: "*", local: namespace[1]! }];

  const braces = /\{([\s\S]*)\}/.exec(trimmed);
  if (!braces) return [];

  const found: ForbiddenImport[] = [];
  for (const rawSpecifier of braces[1]!.split(",")) {
    const specifier = rawSpecifier.trim();
    if (specifier === "") continue;
    // `{ type Image }` is erased at build time and cannot render anything.
    if (/^type\s/.test(specifier)) continue;

    const aliased = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(specifier);
    const imported = aliased ? aliased[1]! : specifier;
    const local = aliased ? aliased[2]! : specifier;

    if (FORBIDDEN.has(imported)) found.push({ imported, local });
  }
  return found;
}

/**
 * Finds imports of `Image` or `Picture` from `astro:assets`.
 *
 * `import type { Image }` is ignored: type-only imports are erased and cannot
 * render an unlabelled image. `getImage` is ignored too — it returns image data
 * rather than markup, so it cannot bypass the disclosure badge.
 */
export function findForbiddenImports(code: string, filename = ""): ForbiddenImport[] {
  const source = filename.endsWith(".astro") ? extractFrontmatter(code) : code;
  if (source === "") return [];

  const masked = maskStringsAndComments(source);
  // Matched against the masked text so an import quoted inside a string cannot
  // trigger, then read back from `source` by offset. `\s*` before `from`
  // because `import { Image }from"astro:assets"` is valid JavaScript.
  const statements = /\bimport\s*([\s\S]*?)\s*from\s*(['"])([\s\S]*?)\2/dg;

  const found: ForbiddenImport[] = [];
  for (const match of masked.matchAll(statements)) {
    const clauseRange = match.indices?.[1];
    const specifierRange = match.indices?.[3];
    if (!clauseRange || !specifierRange) continue;

    if (source.slice(specifierRange[0], specifierRange[1]) !== "astro:assets") continue;

    const clause = source.slice(clauseRange[0], clauseRange[1]);
    // `import type { … } from` erases entirely.
    if (/^type\s/.test(clause.trim())) continue;
    found.push(...parseClause(clause));
  }
  return found;
}

/** Whether this file is one of the package's own components. */
export function isPackageComponent(id: string): boolean {
  return id.includes("astro-ai-disclosure/src/components/");
}

/** Builds the diagnostic shown when a forbidden import is found. */
export function formatEnforcementMessage(id: string, found: ForbiddenImport[]): string {
  const names = found
    .map((entry) =>
      entry.imported === "*"
        ? `namespace import \`* as ${entry.local}\``
        : entry.imported === entry.local
          ? `\`${entry.imported}\``
          : `\`${entry.imported}\` (as \`${entry.local}\`)`,
    )
    .join(", ");

  return [
    `[@jonasmpi/astro-ai-disclosure] Direct astro:assets imports are not allowed: ${names}.`,
    "",
    "Images must go through this package so their AI-disclosure metadata is handled consistently:",
    '  import AIImage from "@jonasmpi/astro-ai-disclosure/AIImage.astro";',
    '  import AIPicture from "@jonasmpi/astro-ai-disclosure/AIPicture.astro";',
    "",
    "`getImage` and type-only imports are unaffected. To allow this file, add a pattern to the",
    'integration\'s `exclude` option, or set `enforcement: "warn" | "off"`.',
    "",
    `File: ${id}`,
  ].join("\n");
}

export interface EnforcementPluginOptions {
  enforcement: EnforcementMode;
  exclude: RegExp[];
}

/**
 * Reads the author's own source for a file.
 *
 * Vite runs every `load` hook before any `transform`, and Astro's `load`
 * returns compiled JavaScript — so even an `enforce: "pre"` transform never
 * sees the `---` frontmatter. Reading from disk is what makes the diagnostic
 * describe the code the author actually wrote.
 *
 * Falls back to the code Vite supplied when the id is not a readable file,
 * which is the case for virtual and in-memory modules.
 */
function readSource(id: string, fallback: string): string {
  try {
    return readFileSync(id, "utf8");
  } catch {
    return fallback;
  }
}

/**
 * Vite plugin that refuses direct `astro:assets` `<Image>` / `<Picture>`
 * imports.
 *
 * Returns `undefined` when enforcement is off, so nothing is registered at all.
 */
export function enforcementPlugin(options: EnforcementPluginOptions): Plugin | undefined {
  const { enforcement, exclude } = options;
  if (enforcement === "off") return undefined;

  const seen = new Set<string>();

  return {
    name: "astro-ai-disclosure:enforcement",
    enforce: "pre",
    transform(code, rawId) {
      const id = rawId.split("?")[0] ?? rawId;

      if (!CHECKED_EXTENSIONS.some((extension) => id.endsWith(extension))) return null;
      // Third-party code is not the consumer's to fix.
      if (id.includes("/node_modules/") && !isPackageComponent(id)) return null;
      if (isPackageComponent(id)) return null;
      if (exclude.some((pattern) => pattern.test(id))) return null;

      // Astro compiles `.astro` files in `load`, so `code` here is already
      // compiled output. Sub-modules (`?astro&type=style`) arrive under the
      // same path, hence the seen-set.
      if (seen.has(id)) return null;

      const found = findForbiddenImports(readSource(id, code), id);
      if (found.length === 0) return null;

      seen.add(id);
      const message = formatEnforcementMessage(id, found);
      if (enforcement === "error") this.error(message);
      else this.warn(message);

      return null;
    },
  };
}
