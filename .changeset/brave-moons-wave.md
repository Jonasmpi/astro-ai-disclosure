---
"@jonasmpi/astro-ai-disclosure": patch
---

Fix images rendering squashed inside the disclosure frame.

The frame styled images with `max-width: 100%` but no `height: auto`. Astro emits intrinsic `width`
and `height` attributes on every `<Image>`, so in any column narrower than the image's natural width
the rendered height stayed pinned to the attribute and the picture was vertically compressed — which
also made it look soft.

This affected every `AIImage` and `AIPicture` since the components were introduced.
