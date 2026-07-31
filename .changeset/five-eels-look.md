---
"@jonasmpi/astro-ai-disclosure": minor
---

Add the official EU icon as an opt-in badge glyph.

Set `badge.icon: "eu"`, or `badgeIcon="eu"` per image, to use the Commission's AI mark in place of
the built-in "AI" glyph. It renders in overlay mode and is composited into the pixels in baked mode.

The Commission makes the icons "publicly available for everyone to use freely, without the need for
attribution", so the mark is bundled — about 1 kB of SVG, embedded as a `data:` URI so its paths
cannot collide with page styles. Note the Commission's own caveat: using the icons is optional, the
Article 50 labelling obligations are not.

Only the basic disc is bundled. The two wordmarks the Commission publishes carry their own text,
which inside a badge that already shows a label would duplicate it rather than sit in it as a glyph.
