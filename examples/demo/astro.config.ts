import aiDisclosure from "@jonasmpi/astro-ai-disclosure";
import { defineConfig } from "astro/config";

// The integration is still a no-op scaffold (step 0.2). Registering it here
// proves the workspace package resolves and loads inside a real Astro build;
// options start flowing through it in step 1.2.
export default defineConfig({
  integrations: [aiDisclosure()],
});
