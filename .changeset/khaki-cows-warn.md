---
"@jonasmpi/astro-ai-disclosure": minor
---

Validate that images are actually declared.

Declaring nothing is not the same as declaring no AI. Three rules make the difference enforceable:

| Rule              | Fires when                                  | dev                    | build   |
| ----------------- | ------------------------------------------- | ---------------------- | ------- |
| `missingMetadata` | No inline `ai` prop and no sidecar          | `warn`                 | `error` |
| `reviewRequired`  | Declaration says `scope: "review-required"` | `error`                | `error` |
| `remoteImages`    | Remote `src` with no inline `ai`            | error unless `"allow"` | same    |

`missingMetadata` differs by mode on purpose: an image you have not got round to declaring should not
interrupt you mid-edit, but it must not reach production. Each rule accepts a bare severity
(`"off" | "warn" | "error"`) or a per-mode object `{ development, build }`.

Remote images get their own rule because the fix differs — a sidecar cannot describe a file that is
not on disk, so the message says to pass an `ai` prop rather than suggesting a sidecar.

To satisfy the rules for an image with no AI involvement, declare it:
`ai={{ kind: "none", scope: "not-in-scope" }}`.
