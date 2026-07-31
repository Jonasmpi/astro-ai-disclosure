import aiDisclosure from "@jonasmpi/astro-ai-disclosure";
import { defineConfig } from "astro/config";

// Every option here is deliberately set to a NON-default value, so the
// /config page proves the central config actually reaches components rather
// than the components falling back to the same built-in defaults.
//
// Package defaults are: policy "eu-article-50", defaultLanguage "en",
// badge.position "bottom-right", enforcement "error".
export default defineConfig({
  // Routes every image through this package's Sharp service, which composites
  // the label into the pixels when a component asks for baked mode. Images
  // without the custom props pass straight through the default pipeline.
  image: {
    service: { entrypoint: "@jonasmpi/astro-ai-disclosure/image-service" },
  },
  integrations: [
    aiDisclosure({
      policy: "all-ai",
      defaultLanguage: "de",
      badge: { position: "top-left" },
      labels: {
        // A single override; the other German labels must survive the merge.
        de: { generated: "Von KI erzeugt" },
      },
      // The recommended consumer setting: a direct astro:assets import fails the
      // build rather than merely warning.
      enforcement: "error",
    }),
  ],
});
