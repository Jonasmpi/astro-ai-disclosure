/**
 * Ambient declaration for `.astro` imports.
 *
 * Astro itself does not ship one: inside an Astro project the generated
 * `.astro/types.d.ts` covers it, and `astro check` uses the language server. A
 * library package running plain `tsc` has neither, so importing a component
 * from a test would otherwise be TS2307.
 *
 * Typed as `AstroComponentFactory`, which is what the Container API's
 * `renderToString` accepts.
 */
declare module "*.astro" {
  const component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default component;
}
