import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  enforcementPlugin,
  extractFrontmatter,
  findForbiddenImports,
  formatEnforcementMessage,
  isPackageComponent,
  maskStringsAndComments,
} from "../src/enforcement";

/** Wraps frontmatter in `.astro` fences. */
const astro = (frontmatter: string, body = "<p>hi</p>") => `---\n${frontmatter}\n---\n\n${body}\n`;

const namesOf = (code: string, filename = "/src/pages/x.astro") =>
  findForbiddenImports(code, filename).map((entry) => entry.imported);

describe("findForbiddenImports — imports that must be caught", () => {
  const violations: ReadonlyArray<[string, string, string[]]> = [
    ["named Image", 'import { Image } from "astro:assets";', ["Image"]],
    ["named Picture", 'import { Picture } from "astro:assets";', ["Picture"]],
    ["both at once", 'import { Image, Picture } from "astro:assets";', ["Image", "Picture"]],
    ["single quotes", "import { Image } from 'astro:assets';", ["Image"]],
    ["aliased", 'import { Image as Img } from "astro:assets";', ["Image"]],
    [
      "aliased alongside an allowed binding",
      'import { getImage, Picture as Pic } from "astro:assets";',
      ["Picture"],
    ],
    ["namespace import", 'import * as assets from "astro:assets";', ["*"]],
    ["multi-line clause", 'import {\n  Image,\n  getImage,\n} from "astro:assets";', ["Image"]],
    ["no space before from", 'import { Image }from"astro:assets";', ["Image"]],
    [
      "second import after an innocent one",
      'import { getImage } from "astro:assets";\nimport { Picture } from "astro:assets";',
      ["Picture"],
    ],
  ];

  for (const [name, frontmatter, expected] of violations) {
    it(`catches ${name}`, () => {
      expect(namesOf(astro(frontmatter))).toEqual(expected);
    });
  }

  it("reports the local name alongside the imported one", () => {
    expect(
      findForbiddenImports(astro('import { Image as Hero } from "astro:assets";'), "a.astro"),
    ).toEqual([{ imported: "Image", local: "Hero" }]);
  });
});

describe("findForbiddenImports — imports that must be left alone", () => {
  const allowed: ReadonlyArray<[string, string]> = [
    ["getImage", 'import { getImage } from "astro:assets";'],
    ["inferRemoteSize", 'import { inferRemoteSize } from "astro:assets";'],
    ["type-only statement", 'import type { ImageMetadata } from "astro:assets";'],
    ["type-only Image", 'import type { Image } from "astro:assets";'],
    ["inline type specifier", 'import { type Image, getImage } from "astro:assets";'],
    ["a different module", 'import { Image } from "some-other-package";'],
    ["a lookalike module", 'import { Image } from "astro:assetsx";'],
    ["our own components", 'import AIImage from "@jonasmpi/astro-ai-disclosure/AIImage.astro";'],
    ["no imports at all", "const x = 1;"],
  ];

  for (const [name, frontmatter] of allowed) {
    it(`ignores ${name}`, () => {
      expect(namesOf(astro(frontmatter))).toEqual([]);
    });
  }

  it("ignores a commented-out import — the documented manual repro", () => {
    expect(namesOf(astro('// import { Image } from "astro:assets";'))).toEqual([]);
    expect(namesOf(astro('/* import { Image } from "astro:assets"; */'))).toEqual([]);
  });

  // Enforcement defaults to `error`, so a false positive breaks the build of a
  // file that does nothing wrong. A docs page quoting the forbidden import is
  // the obvious way to trip it.
  it("ignores an import quoted inside a string literal", () => {
    expect(namesOf(astro(`const snippet = 'import { Image } from "astro:assets";';`))).toEqual([]);
    expect(namesOf(astro("const snippet = \"import { Picture } from 'astro:assets';\";"))).toEqual(
      [],
    );
  });

  it("ignores an import quoted inside a template literal", () => {
    expect(namesOf(astro('const doc = `import { Image } from "astro:assets";`;'))).toEqual([]);
  });

  it("still catches a real import that follows a quoted one", () => {
    const frontmatter = [
      `const snippet = 'import { Image } from "astro:assets";';`,
      'import { Picture } from "astro:assets";',
    ].join("\n");
    expect(namesOf(astro(frontmatter))).toEqual(["Picture"]);
  });

  it("ignores the template body, where an import cannot appear", () => {
    const code = astro("const x = 1;", '<code>import { Image } from "astro:assets"</code>');
    expect(namesOf(code)).toEqual([]);
  });

  it("ignores a file with no frontmatter at all", () => {
    expect(namesOf('<p>import { Image } from "astro:assets"</p>')).toEqual([]);
  });
});

describe("findForbiddenImports — non-astro modules", () => {
  it("scans the whole file for .ts, which has no frontmatter", () => {
    const code = 'import { Image } from "astro:assets";\nexport const x = Image;';
    expect(findForbiddenImports(code, "/src/lib/helper.ts")).toHaveLength(1);
  });

  it("still honours comments in .ts", () => {
    expect(findForbiddenImports('// import { Image } from "astro:assets";', "/a.ts")).toEqual([]);
  });
});

describe("maskStringsAndComments", () => {
  it("preserves length so offsets still line up with the original", () => {
    for (const code of [
      'const a = "x"; // y',
      "/* block */ const a = 1;",
      "const a = 'it\\'s';",
      "const a = `tpl ${b}`;",
    ]) {
      expect(maskStringsAndComments(code)).toHaveLength(code.length);
    }
  });

  it("blanks comment contents", () => {
    expect(maskStringsAndComments("a // b").trimEnd()).toBe("a");
  });

  it("blanks string contents but keeps the quotes", () => {
    expect(maskStringsAndComments('x = "abc";')).toBe('x = "   ";');
  });

  it("does not desynchronise on an apostrophe inside a comment", () => {
    const masked = maskStringsAndComments("// don't stop\nconst a = 1;");
    expect(masked).toContain("const a = 1;");
  });

  it("handles escaped quotes without ending the string early", () => {
    const masked = maskStringsAndComments('a = "he said \\"hi\\""; const b = 1;');
    expect(masked).toContain("const b = 1;");
  });
});

describe("extractFrontmatter", () => {
  it("returns the code between the leading fences", () => {
    expect(extractFrontmatter("---\nconst a = 1;\n---\n<p/>")).toBe("\nconst a = 1;");
  });

  it("returns empty for a file without frontmatter", () => {
    expect(extractFrontmatter("<p>hello</p>")).toBe("");
  });

  it("does not treat a horizontal rule in the body as frontmatter", () => {
    expect(extractFrontmatter("<p>x</p>\n---\nnot frontmatter\n---")).toBe("");
  });

  it("returns empty when the fence is never closed", () => {
    expect(extractFrontmatter("---\nconst a = 1;")).toBe("");
  });
});

describe("isPackageComponent", () => {
  it("recognises the package's own components in a workspace", () => {
    expect(
      isPackageComponent("/repo/packages/astro-ai-disclosure/src/components/AIImage.astro"),
    ).toBe(true);
  });

  it("recognises them inside node_modules", () => {
    expect(
      isPackageComponent(
        "/app/node_modules/@jonasmpi/astro-ai-disclosure/src/components/AIPicture.astro",
      ),
    ).toBe(true);
  });

  it("does not match a consumer's own similarly named file", () => {
    expect(isPackageComponent("/app/src/components/AIImage.astro")).toBe(false);
  });
});

describe("formatEnforcementMessage", () => {
  it("names the offending bindings and the file", () => {
    const message = formatEnforcementMessage("/src/pages/x.astro", [
      { imported: "Image", local: "Image" },
    ]);
    expect(message).toContain("`Image`");
    expect(message).toContain("/src/pages/x.astro");
    expect(message).toContain("@jonasmpi/astro-ai-disclosure");
  });

  it("shows the alias when one was used", () => {
    expect(formatEnforcementMessage("x.astro", [{ imported: "Image", local: "Hero" }])).toContain(
      "`Image` (as `Hero`)",
    );
  });

  it("describes a namespace import in its own terms", () => {
    expect(formatEnforcementMessage("x.astro", [{ imported: "*", local: "assets" }])).toContain(
      "namespace import `* as assets`",
    );
  });

  it("points at the replacement components and the escape hatches", () => {
    const message = formatEnforcementMessage("x.astro", [{ imported: "Image", local: "Image" }]);
    expect(message).toContain("AIImage.astro");
    expect(message).toContain("AIPicture.astro");
    expect(message).toContain("exclude");
    expect(message).toContain("getImage");
  });
});

/** Invokes the plugin's transform with a `this` exposing error/warn. */
function runTransform(
  plugin: NonNullable<ReturnType<typeof enforcementPlugin>>,
  code: string,
  id: string,
) {
  const error = vi.fn((message: string) => {
    throw new Error(message);
  });
  const warn = vi.fn();
  const hook = plugin.transform;
  // Cast through `unknown`: the real hook's `this` is Vite's full
  // TransformPluginContext, and only `error`/`warn` are exercised here.
  const fn = (typeof hook === "function" ? hook : hook?.handler) as unknown as (
    this: { error: typeof error; warn: typeof warn },
    code: string,
    id: string,
  ) => unknown;
  return { run: () => fn.call({ error, warn }, code, id), error, warn };
}

const violating = astro('import { Image } from "astro:assets";');

describe("enforcementPlugin", () => {
  it("registers nothing when enforcement is off", () => {
    expect(enforcementPlugin({ enforcement: "off", exclude: [] })).toBeUndefined();
  });

  it("throws on a violation when enforcement is error", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const { run, error } = runTransform(plugin, violating, "/src/pages/x.astro");
    expect(run).toThrow("Direct astro:assets imports are not allowed");
    expect(error).toHaveBeenCalledOnce();
  });

  it("only warns when enforcement is warn", () => {
    const plugin = enforcementPlugin({ enforcement: "warn", exclude: [] })!;
    const { run, warn, error } = runTransform(plugin, violating, "/src/pages/x.astro");
    expect(run()).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });

  it("passes clean files through untouched", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const clean = astro('import { getImage } from "astro:assets";');
    const { run, error, warn } = runTransform(plugin, clean, "/src/pages/x.astro");
    expect(run()).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("skips files matched by exclude", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [/legacy/] })!;
    const { run, error } = runTransform(plugin, violating, "/src/pages/legacy/old.astro");
    expect(run()).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("still enforces on files the exclude patterns do not match", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [/legacy/] })!;
    const { run } = runTransform(plugin, violating, "/src/pages/current/new.astro");
    expect(run).toThrow();
  });

  it("never flags the package's own components", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    for (const id of [
      "/repo/packages/astro-ai-disclosure/src/components/AIImage.astro",
      "/app/node_modules/@jonasmpi/astro-ai-disclosure/src/components/AIPicture.astro",
      "/repo/packages/astro-ai-disclosure/src/components/DisclosureFrame.astro",
    ]) {
      const { run, error } = runTransform(plugin, violating, id);
      expect(run()).toBeNull();
      expect(error).not.toHaveBeenCalled();
    }
  });

  it("ignores third-party code the consumer cannot fix", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const { run, error } = runTransform(plugin, violating, "/app/node_modules/other/x.astro");
    expect(run()).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it("ignores file types that cannot import anything", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const { run } = runTransform(plugin, violating, "/src/styles/app.css");
    expect(run()).toBeNull();
  });

  it("strips a Vite query string before matching", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const { run } = runTransform(plugin, violating, "/src/pages/x.astro?astro&type=script");
    expect(run).toThrow();
  });

  it("runs before other plugins", () => {
    expect(enforcementPlugin({ enforcement: "error", exclude: [] })?.enforce).toBe("pre");
  });
});

/**
 * Vite runs every `load` hook before any `transform`, and Astro's `load`
 * compiles `.astro` files — so the `code` a transform receives has no `---`
 * frontmatter, even with `enforce: "pre"`. The plugin therefore reads the
 * author's file from disk. Without that it silently never fires, which is
 * exactly how this went unnoticed until the demo build refused to fail.
 */
describe("enforcementPlugin — reads the author's source, not compiler output", () => {
  it("flags a real file even when handed compiled output", () => {
    const dir = mkdtempSync(join(tmpdir(), "aid-enforcement-"));
    const file = join(dir, "page.astro");
    writeFileSync(file, violating, "utf8");

    // What Astro's compiler actually hands the transform: no frontmatter, and
    // in this case not even the offending import.
    const compiled = [
      'import { createComponent as $$createComponent } from "astro/compiler-runtime";',
      'const $$Page = $$createComponent(() => "<p>hi</p>");',
      "export default $$Page;",
    ].join("\n");

    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const { run } = runTransform(plugin, compiled, file);
    expect(run).toThrow("Direct astro:assets imports are not allowed");

    rmSync(dir, { recursive: true, force: true });
  });

  it("reports a file only once, though sub-modules share its path", () => {
    const dir = mkdtempSync(join(tmpdir(), "aid-enforcement-"));
    const file = join(dir, "page.astro");
    writeFileSync(file, violating, "utf8");

    const plugin = enforcementPlugin({ enforcement: "warn", exclude: [] })!;
    const first = runTransform(plugin, "", file);
    first.run();
    const second = runTransform(plugin, "", file);
    second.run();

    expect(first.warn).toHaveBeenCalledOnce();
    expect(second.warn).not.toHaveBeenCalled();

    rmSync(dir, { recursive: true, force: true });
  });

  it("falls back to the supplied code when the id is not a real file", () => {
    const plugin = enforcementPlugin({ enforcement: "error", exclude: [] })!;
    const { run } = runTransform(plugin, violating, "/does/not/exist/virtual.astro");
    expect(run).toThrow();
  });
});
