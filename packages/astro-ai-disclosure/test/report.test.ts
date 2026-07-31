import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  REPORT_FILENAME,
  buildReport,
  collectedRecords,
  formatSummary,
  recordDisclosure,
  resetRecords,
  writeReport,
} from "../src/report";
import type { DisclosureRecord } from "../src/report";

const record = (overrides: Partial<DisclosureRecord> = {}): DisclosureRecord => ({
  image: "/src/assets/photo.jpg",
  disclosure: { kind: "generated", scope: "deepfake" },
  badge: true,
  policy: "eu-article-50",
  ...overrides,
});

describe("the collector", () => {
  beforeEach(() => resetRecords());
  afterEach(() => resetRecords());

  it("starts empty", () => {
    expect(collectedRecords()).toEqual([]);
  });

  it("accumulates records", () => {
    recordDisclosure(record());
    recordDisclosure(record({ image: "/src/assets/other.jpg" }));
    expect(collectedRecords()).toHaveLength(2);
  });

  it("is cleared by resetRecords, so one build cannot inherit another's", () => {
    recordDisclosure(record());
    resetRecords();
    expect(collectedRecords()).toEqual([]);
  });

  /**
   * The collector lives on globalThis under a registered Symbol because the
   * integration and the components are separate module instances — Node's ESM
   * loader versus Vite's SSR graph. A module-level array would silently collect
   * nothing.
   */
  it("lives under a globally registered symbol, reachable across module instances", () => {
    recordDisclosure(record());
    const key = Symbol.for("@jonasmpi/astro-ai-disclosure.records");
    expect((globalThis as Record<symbol, unknown>)[key]).toHaveLength(1);
  });
});

describe("buildReport — grouping", () => {
  it("folds repeated identical usages into one entry", () => {
    const report = buildReport([
      record({ page: "/a" }),
      record({ page: "/b" }),
      record({ page: "/a" }),
    ]);
    expect(report.images).toHaveLength(1);
    expect(report.images[0]?.usages).toBe(3);
    expect(report.images[0]?.pages).toEqual(["/a", "/b"]);
  });

  /**
   * The defect this replaced: grouping by image alone kept only the first
   * declaration, so a report would state something the site does not say.
   */
  it("keeps every distinct declaration of the same image", () => {
    const report = buildReport([
      record({ disclosure: { kind: "generated", scope: "deepfake" }, page: "/a" }),
      record({ disclosure: { kind: "none", scope: "not-in-scope" }, badge: false, page: "/b" }),
    ]);
    expect(report.images).toHaveLength(2);
    expect(report.images.map((entry) => entry.kind).sort()).toEqual(["generated", "none"]);
  });

  it("flags images declared more than one way", () => {
    const report = buildReport([
      record({ disclosure: { kind: "generated", scope: "deepfake" } }),
      record({ disclosure: { kind: "assisted", scope: "not-in-scope" }, badge: false }),
      record({ image: "/src/assets/only-once.jpg" }),
    ]);
    expect(report.summary.conflicting).toEqual(["/src/assets/photo.jpg"]);
  });

  it("does not flag an image used consistently", () => {
    const report = buildReport([record({ page: "/a" }), record({ page: "/b" })]);
    expect(report.summary.conflicting).toEqual([]);
  });

  it("treats a different policy as a different declaration", () => {
    const report = buildReport([record({ policy: "eu-article-50" }), record({ policy: "all-ai" })]);
    expect(report.images).toHaveLength(2);
  });

  it("distinguishes provider and model", () => {
    const report = buildReport([
      record({ disclosure: { kind: "generated", scope: "deepfake", provider: "A" } }),
      record({ disclosure: { kind: "generated", scope: "deepfake", provider: "B" } }),
    ]);
    expect(report.images).toHaveLength(2);
  });

  it("sorts entries so the report is stable between builds", () => {
    const first = buildReport([record({ image: "/b.jpg" }), record({ image: "/a.jpg" })]);
    const second = buildReport([record({ image: "/a.jpg" }), record({ image: "/b.jpg" })]);
    expect(first.images.map((entry) => entry.image)).toEqual(["/a.jpg", "/b.jpg"]);
    expect(first).toEqual(second);
  });
});

describe("buildReport — undeclared images", () => {
  it("records them as undeclared rather than omitting them", () => {
    const report = buildReport([record({ disclosure: undefined, badge: false })]);
    expect(report.images[0]?.kind).toBe("undeclared");
    expect(report.images[0]?.scope).toBe("undeclared");
    expect(report.summary.undeclared).toEqual(["/src/assets/photo.jpg"]);
  });

  it("omits optional fields that were never provided", () => {
    const entry = buildReport([record()]).images[0];
    expect(entry).not.toHaveProperty("provider");
    expect(entry).not.toHaveProperty("model");
    expect(entry).not.toHaveProperty("createdAt");
  });

  it("carries optional fields through when present", () => {
    const entry = buildReport([
      record({
        disclosure: {
          kind: "modified",
          scope: "deepfake",
          provider: "OpenAI",
          model: "GPT Image",
          createdAt: "2026-07-20",
        },
      }),
    ]).images[0];
    expect(entry?.provider).toBe("OpenAI");
    expect(entry?.model).toBe("GPT Image");
    expect(entry?.createdAt).toBe("2026-07-20");
  });
});

describe("buildReport — summary", () => {
  const mixed = [
    record({ image: "/a.jpg", disclosure: { kind: "generated", scope: "deepfake" }, page: "/1" }),
    record({ image: "/a.jpg", disclosure: { kind: "generated", scope: "deepfake" }, page: "/2" }),
    record({
      image: "/b.jpg",
      disclosure: { kind: "assisted", scope: "not-in-scope" },
      badge: false,
      page: "/1",
    }),
    record({
      image: "/c.jpg",
      disclosure: { kind: "generated", scope: "review-required" },
      page: "/3",
    }),
    record({ image: "/d.jpg", disclosure: undefined, badge: false, page: "/3" }),
  ];

  it("counts images, declarations and usages separately", () => {
    const { summary } = buildReport(mixed);
    expect(summary.images).toBe(4);
    expect(summary.declarations).toBe(4);
    expect(summary.usages).toBe(5);
  });

  it("counts labelled usages rather than labelled entries", () => {
    expect(buildReport(mixed).summary.labelledUsages).toBe(3);
  });

  it("breaks down by kind and scope", () => {
    const { summary } = buildReport(mixed);
    expect(summary.byKind).toEqual({ generated: 2, assisted: 1, undeclared: 1 });
    expect(summary.byScope).toEqual({
      deepfake: 1,
      "not-in-scope": 1,
      "review-required": 1,
      undeclared: 1,
    });
  });

  it("lists images awaiting review", () => {
    expect(buildReport(mixed).summary.awaitingReview).toEqual(["/c.jpg"]);
  });

  it("produces an empty report for a build with no images", () => {
    const report = buildReport([]);
    expect(report.images).toEqual([]);
    expect(report.summary.images).toBe(0);
    expect(report.summary.undeclared).toEqual([]);
  });
});

describe("formatSummary", () => {
  it("leads with the headline counts", () => {
    const summary = formatSummary(buildReport([record()]));
    expect(summary).toContain("1 image(s)");
    expect(summary).toContain("1 usage(s)");
  });

  it("names images that need attention", () => {
    const summary = formatSummary(
      buildReport([
        record({
          image: "/pending.jpg",
          disclosure: { kind: "generated", scope: "review-required" },
        }),
        record({ image: "/nothing.jpg", disclosure: undefined, badge: false }),
      ]),
    );
    expect(summary).toContain("awaiting review");
    expect(summary).toContain("/pending.jpg");
    expect(summary).toContain("undeclared");
    expect(summary).toContain("/nothing.jpg");
  });

  it("stays quiet about sections with nothing in them", () => {
    const summary = formatSummary(buildReport([record()]));
    expect(summary).not.toContain("awaiting review");
    expect(summary).not.toContain("undeclared");
    expect(summary).not.toContain("more than one way");
  });

  it("points at the report file", () => {
    expect(formatSummary(buildReport([]))).toContain(REPORT_FILENAME);
  });
});

describe("writeReport", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "aid-report-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes valid JSON that round-trips", () => {
    const report = buildReport([record()]);
    const target = writeReport(dir, report);
    expect(target).toBe(join(dir, REPORT_FILENAME));
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual(report);
  });

  it("creates the output directory if it does not exist", () => {
    const nested = join(dir, "does", "not", "exist");
    expect(() => writeReport(nested, buildReport([]))).not.toThrow();
    expect(readFileSync(join(nested, REPORT_FILENAME), "utf8")).toContain('"images"');
  });

  it("ends the file with a newline", () => {
    const target = writeReport(dir, buildReport([]));
    expect(readFileSync(target, "utf8").endsWith("\n")).toBe(true);
  });
});
