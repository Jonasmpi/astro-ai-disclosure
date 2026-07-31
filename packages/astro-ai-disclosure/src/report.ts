import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { AIDisclosure, AIImageKind, DisclosurePolicy, LegalScope } from "./types";

/** Filename written into the build output directory. */
export const REPORT_FILENAME = "ai-image-disclosure-report.json";

/** One rendered image, as recorded by a component. */
export interface DisclosureRecord {
  /** Absolute source path, or the `src` for remote and public images. */
  image: string;
  /** Absent when the image was rendered with no declaration at all. */
  disclosure?: AIDisclosure;
  /** Whether a visible badge was rendered. */
  badge: boolean;
  /** The policy in force for this image. */
  policy: DisclosurePolicy;
  /** Page the image appeared on, when the component could determine it. */
  page?: string;
}

/** One image in the finished report, with its usages folded together. */
export interface ReportEntry {
  image: string;
  kind: AIImageKind | "undeclared";
  scope: LegalScope | "undeclared";
  provider?: string;
  model?: string;
  createdAt?: string;
  badge: boolean;
  policy: DisclosurePolicy;
  /** Pages the image appears on, sorted. */
  pages: string[];
  /** How many times it was rendered. */
  usages: number;
}

/** The document written to disk. */
export interface DisclosureReport {
  package: string;
  images: ReportEntry[];
  summary: {
    /** Distinct image files. */
    images: number;
    /** Distinct image + declaration combinations. */
    declarations: number;
    /** Total renders across all pages. */
    usages: number;
    /** Renders that showed a visible badge. */
    labelledUsages: number;
    byKind: Record<string, number>;
    byScope: Record<string, number>;
    undeclared: string[];
    awaitingReview: string[];
    /** Images declared more than one way — intended or not, worth a look. */
    conflicting: string[];
  };
}

/**
 * Key under which records accumulate.
 *
 * A module-level array would not work: `astro.config.ts` runs in Node's ESM
 * loader while `.astro` components run inside Vite's SSR module graph, so the
 * integration and the components hold *different instances* of this module.
 * `globalThis` is the one registry they share — the same approach Astro itself
 * uses for `globalThis.astroAsset`.
 */
const COLLECTOR = Symbol.for("@jonasmpi/astro-ai-disclosure.records");

type CollectorHost = { [COLLECTOR]?: DisclosureRecord[] };

/** Records one rendered image. Called by the components. */
export function recordDisclosure(record: DisclosureRecord): void {
  const host = globalThis as CollectorHost;
  (host[COLLECTOR] ??= []).push(record);
}

/** Everything recorded so far. */
export function collectedRecords(): readonly DisclosureRecord[] {
  return (globalThis as CollectorHost)[COLLECTOR] ?? [];
}

/** Clears the collector, so one build cannot inherit another's records. */
export function resetRecords(): void {
  (globalThis as CollectorHost)[COLLECTOR] = [];
}

function count(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/**
 * Groups records into the report.
 *
 * Grouped by image **and declaration**, not by image alone. The same asset can
 * legitimately be declared differently in different contexts — a crop, a
 * different surrounding claim — and a compliance report that kept only the
 * first would state something the site does not actually say. Images carrying
 * more than one declaration are surfaced in `summary.conflicting` so a reviewer
 * can decide whether the difference is intended.
 */
function groupKey(record: DisclosureRecord): string {
  return JSON.stringify([
    record.image,
    record.policy,
    record.disclosure?.kind ?? null,
    record.disclosure?.scope ?? null,
    record.disclosure?.provider ?? null,
    record.disclosure?.model ?? null,
    record.disclosure?.createdAt ?? null,
  ]);
}

export function buildReport(records: readonly DisclosureRecord[]): DisclosureReport {
  const byDeclaration = new Map<string, ReportEntry>();

  for (const record of records) {
    const key = groupKey(record);
    const existing = byDeclaration.get(key);
    if (existing) {
      existing.usages += 1;
      if (record.page !== undefined && !existing.pages.includes(record.page)) {
        existing.pages.push(record.page);
      }
      continue;
    }

    byDeclaration.set(key, {
      image: record.image,
      kind: record.disclosure?.kind ?? "undeclared",
      scope: record.disclosure?.scope ?? "undeclared",
      ...(record.disclosure?.provider !== undefined && { provider: record.disclosure.provider }),
      ...(record.disclosure?.model !== undefined && { model: record.disclosure.model }),
      ...(record.disclosure?.createdAt !== undefined && { createdAt: record.disclosure.createdAt }),
      badge: record.badge,
      policy: record.policy,
      pages: record.page === undefined ? [] : [record.page],
      usages: 1,
    });
  }

  const images = [...byDeclaration.values()].sort(
    (a, b) => a.image.localeCompare(b.image) || a.kind.localeCompare(b.kind),
  );
  for (const entry of images) entry.pages.sort();

  const distinctImages = new Set(images.map((entry) => entry.image));
  const declarationsPerImage = new Map<string, number>();
  for (const entry of images) {
    declarationsPerImage.set(entry.image, (declarationsPerImage.get(entry.image) ?? 0) + 1);
  }

  return {
    package: "@jonasmpi/astro-ai-disclosure",
    images,
    summary: {
      images: distinctImages.size,
      declarations: images.length,
      usages: images.reduce((total, entry) => total + entry.usages, 0),
      labelledUsages: images
        .filter((entry) => entry.badge)
        .reduce((total, entry) => total + entry.usages, 0),
      byKind: count(images.map((entry) => entry.kind)),
      byScope: count(images.map((entry) => entry.scope)),
      undeclared: [
        ...new Set(images.filter((e) => e.kind === "undeclared").map((e) => e.image)),
      ].sort(),
      awaitingReview: [
        ...new Set(images.filter((e) => e.scope === "review-required").map((e) => e.image)),
      ].sort(),
      conflicting: [...declarationsPerImage.entries()]
        .filter(([, total]) => total > 1)
        .map(([image]) => image)
        .sort(),
    },
  };
}

/** Renders the console summary printed at the end of a build. */
export function formatSummary(report: DisclosureReport): string {
  const { summary } = report;
  const lines = [
    `AI disclosure: ${summary.images} image(s), ${summary.declarations} declaration(s), ` +
      `${summary.usages} usage(s), ${summary.labelledUsages} labelled`,
  ];

  const describe = (label: string, counts: Record<string, number>) => {
    const parts = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, total]) => `${name}=${total}`);
    if (parts.length > 0) lines.push(`  ${label}: ${parts.join(", ")}`);
  };

  describe("kind", summary.byKind);
  describe("scope", summary.byScope);

  if (summary.undeclared.length > 0) {
    lines.push(`  undeclared (${summary.undeclared.length}):`);
    for (const image of summary.undeclared) lines.push(`    ${image}`);
  }
  if (summary.awaitingReview.length > 0) {
    lines.push(`  awaiting review (${summary.awaitingReview.length}):`);
    for (const image of summary.awaitingReview) lines.push(`    ${image}`);
  }
  if (summary.conflicting.length > 0) {
    lines.push(`  declared more than one way (${summary.conflicting.length}):`);
    for (const image of summary.conflicting) lines.push(`    ${image}`);
  }

  lines.push(`  report: ${REPORT_FILENAME}`);
  return lines.join("\n");
}

/** Writes the report into the build output directory. */
export function writeReport(outDir: string, report: DisclosureReport): string {
  const target = join(outDir, REPORT_FILENAME);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return target;
}
