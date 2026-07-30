---
"@jonasmpi/astro-ai-disclosure": minor
---

Add build enforcement against direct `astro:assets` imports.

The integration now registers a Vite plugin that refuses `import { Image }` and `import { Picture }`
from `astro:assets`, so an unlabelled image cannot reach a page by accident. Aliases
(`{ Image as Hero }`) and namespace imports (`* as assets`) are caught too.

`getImage` and `inferRemoteSize` stay allowed — they return image data rather than markup — as do
type-only imports, which are erased before anything renders.

Controlled by the existing options: `enforcement: "off" | "warn" | "error"` (default `error`) and
`exclude: RegExp[]` for files that must be let through. The package's own components are always
exempt, and third-party code under `node_modules` is never flagged.

The diagnostic names the offending binding, the file, the replacement components and both escape
hatches.
