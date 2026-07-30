import aiDisclosure from "@jonasmpi/astro-ai-disclosure";
import { defineConfig } from "astro/config";

// Every option here is deliberately set to a NON-default value, so the
// /config page proves the central config actually reaches components rather
// than the components falling back to the same built-in defaults.
//
// Package defaults are: policy "eu-article-50", defaultLanguage "en",
// badge.position "bottom-right", enforcement "error".
export default defineConfig({
  integrations: [
    aiDisclosure({
      policy: "all-ai",
      defaultLanguage: "de",
      badge: { position: "top-left" },
      labels: {
        // A single override; the other German labels must survive the merge.
        de: { generated: "Von KI erzeugt" },
      },
      enforcement: "warn",
    }),
  ],
});
