import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/types.ts", "src/image-service.ts"],
  format: ["esm"],
  target: "node22",
  dts: true,
  clean: true,
  sourcemap: true,
  // `astro` is a peer dependency; never bundle it. `.astro` components are
  // shipped as source and are therefore not part of the tsup entry points.
  external: ["astro", "sharp"],
});
