---
"@jonasmpi/astro-ai-disclosure": minor
---

Add the AI-disclosure type vocabulary and policy helpers.

`AIImageKind`, `LegalScope`, `AIDisclosure`, `DisclosurePolicy` and the integration option types are
available from the package root and from the `./types` subpath. The pure helpers `shouldDisclose()`,
`resolveLabel()` and `containsAI()`, plus the built-in German and English labels in
`DEFAULT_LABELS`, are exported from the package root.

`scope: "review-required"` discloses under both policies: an image nobody has classified yet fails
safe rather than silently going unlabelled.
