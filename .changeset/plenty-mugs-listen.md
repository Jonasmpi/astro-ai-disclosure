---
"@jonasmpi/astro-ai-disclosure": minor
---

Accept and validate integration options, and expose them to components.

`aiDisclosure()` now takes `policy`, `defaultLanguage`, `labels`, `badge.position`, `enforcement` and
`exclude`. Options are validated when the Astro config is read, so a typo fails immediately with a
message naming the option, the offending value and the allowed set — rather than being silently
ignored. `labels` deep-merges over the built-in German and English text, so overriding one string
keeps the rest.

The resolved config reaches components through the new `virtual:astro-ai-disclosure/config` module.
Its ambient type declaration is injected automatically, so no `types` entry is needed in the
consumer's `tsconfig.json`. `enforcement` and `exclude` stay build-time only.
