import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import type { Plugin } from "vite";

import type { AIDisclosure, AIImageKind, AIImageManifest, LegalScope } from "./types";

/** Suffix that marks a sidecar: `photo.jpg` -> `photo.jpg.ai.json`. */
export const SIDECAR_SUFFIX = ".ai.json";

/** The module specifier components import to read sidecar metadata. */
export const VIRTUAL_MANIFEST_ID = "virtual:ai-image-manifest";

/** Rollup convention: NUL-prefixed resolved id. */
export const RESOLVED_VIRTUAL_MANIFEST_ID = `\0${VIRTUAL_MANIFEST_ID}`;

const KINDS: readonly AIImageKind[] = ["none", "assisted", "modified", "generated"];
const SCOPES: readonly LegalScope[] = [
  "not-in-scope",
  "deepfake",
  "creative-work",
  "review-required",
];
const OPTIONAL_STRINGS = ["provider", "model", "createdAt", "description", "label"] as const;

/** Thrown when a sidecar file cannot be used. */
export class AIDisclosureSidecarError extends Error {
  override readonly name = "AIDisclosureSidecarError";

  constructor(message: string) {
    super(`[@jonasmpi/astro-ai-disclosure] ${message}`);
  }
}

function quote(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

/**
 * Validates one sidecar's contents.
 *
 * Rejects rather than repairs: a sidecar is a compliance declaration, and
 * quietly dropping a field the author misspelled would hide the very thing they
 * meant to record. `source` names the offending file in every message.
 */
export function parseSidecar(raw: string, source: string): AIDisclosure {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (cause) {
    throw new AIDisclosureSidecarError(
      `${source}: not valid JSON. ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AIDisclosureSidecarError(`${source}: expected a JSON object.`);
  }

  const record = value as Record<string, unknown>;

  const kind = record["kind"];
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    throw new AIDisclosureSidecarError(
      `${source}: invalid \`kind\` ${JSON.stringify(kind)}. Expected one of ${quote(KINDS)}.`,
    );
  }

  const scope = record["scope"];
  if (typeof scope !== "string" || !(SCOPES as readonly string[]).includes(scope)) {
    throw new AIDisclosureSidecarError(
      `${source}: invalid \`scope\` ${JSON.stringify(scope)}. Expected one of ${quote(SCOPES)}.`,
    );
  }

  const disclosure: AIDisclosure = { kind: kind as AIImageKind, scope: scope as LegalScope };

  for (const field of OPTIONAL_STRINGS) {
    const entry = record[field];
    if (entry === undefined) continue;
    if (typeof entry !== "string" || entry === "") {
      throw new AIDisclosureSidecarError(
        `${source}: \`${field}\` must be a non-empty string when present.`,
      );
    }
    disclosure[field] = entry;
  }

  const known = new Set<string>(["kind", "scope", ...OPTIONAL_STRINGS]);
  const unknownKeys = Object.keys(record).filter((key) => !known.has(key));
  if (unknownKeys.length > 0) {
    throw new AIDisclosureSidecarError(
      `${source}: unknown field(s) ${quote(unknownKeys.sort())}. Expected ${quote([...known])}.`,
    );
  }

  return disclosure;
}

/** The image path a sidecar describes: strip the `.ai.json` suffix. */
export function imagePathForSidecar(sidecarPath: string): string {
  return sidecarPath.slice(0, -SIDECAR_SUFFIX.length);
}

/** Lists every `*.ai.json` under `root`, as absolute paths. */
export function findSidecars(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root, { recursive: true, encoding: "utf8" });
  } catch {
    // A project without the directory simply has no sidecars.
    return [];
  }

  return entries
    .filter((entry) => entry.endsWith(SIDECAR_SUFFIX))
    .filter((entry) => !entry.split(sep).includes("node_modules"))
    .map((entry) => resolve(join(root, entry)))
    .sort();
}

/**
 * Builds the manifest by reading every sidecar under `root`.
 *
 * Keys are absolute image paths, matching what `fsPath` reports at render time.
 */
export function buildManifest(root: string): AIImageManifest {
  const manifest: AIImageManifest = {};

  for (const sidecarPath of findSidecars(root)) {
    const raw = readFileSync(sidecarPath, "utf8");
    manifest[imagePathForSidecar(sidecarPath)] = parseSidecar(raw, sidecarPath);
  }

  return manifest;
}

/** Renders the virtual manifest module. */
export function serializeManifest(manifest: AIImageManifest): string {
  return `export default Object.freeze(${JSON.stringify(manifest, null, 2)});\n`;
}

/** The ambient declaration injected into the consumer's project. */
export const VIRTUAL_MANIFEST_TYPES = `declare module "${VIRTUAL_MANIFEST_ID}" {
  const manifest: import("@jonasmpi/astro-ai-disclosure/types").AIImageManifest;
  export default manifest;
}
`;

/**
 * Vite plugin serving {@link VIRTUAL_MANIFEST_ID}.
 *
 * The manifest is rebuilt on every `load` rather than baked in once, so adding
 * or editing a sidecar in dev takes effect without restarting the server. The
 * watcher below invalidates the module so that `load` actually runs again.
 */
export function manifestPlugin(root: string): Plugin {
  return {
    name: "astro-ai-disclosure:manifest",

    resolveId(id) {
      return id === VIRTUAL_MANIFEST_ID ? RESOLVED_VIRTUAL_MANIFEST_ID : undefined;
    },

    load(id) {
      return id === RESOLVED_VIRTUAL_MANIFEST_ID
        ? serializeManifest(buildManifest(root))
        : undefined;
    },

    configureServer(server) {
      const invalidate = (file: string) => {
        if (!file.endsWith(SIDECAR_SUFFIX)) return;
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MANIFEST_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", invalidate);
      server.watcher.on("change", invalidate);
      server.watcher.on("unlink", invalidate);
    },
  };
}
