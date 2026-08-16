# Process overview

## What I built

A live flight-price explainer: one simulated flight where clicking Wait sells more seats and pushes the price up through fare brackets, while Book now locks in today's price and shows how it compares to the opening one.

## The moments that mattered

**1. Adding real-browser testing after a bug jsdom couldn't have caught**

Booking with zero Wait clicks rendered the exact same message as the price-rise case, just with a `$0` difference — quietly defeating the whole point of the page. The obvious fix was to patch the string and move on, but the real problem was that nothing could have caught this automatically: jsdom can't execute the page's bundled `type="module"` script, so the click-driven interaction had no test coverage at all. Instead of just fixing the message, I added Playwright as a dependency to drive the built page in real headless Chromium, and updated CI to install Chromium before `pnpm check` runs. The exact bug I'd found by hand is now a named regression test that asserts the zero-wait message, not the price-rise one. I knew it was actually fixed because the new test failed against the old code and passed against the new — not because I eyeballed the page once and moved on.

[`e73ddbf`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-maddywright3/commit/e73ddbf8493f48829a535252d628219c1dff255d)

**2. Fixing the test's assumption about deployment, not the code**

Adding clickable seats grew `main.ts` past Astro's inlining threshold, so its script became an external chunk referenced by an absolute base-path URL. My tests were loading the built page via a plain `file://` path, which can't resolve that URL — every click silently did nothing. The obvious fix was to keep the bundle small enough to stay inlined, or hardcode around the path. Instead, I rewrote `spec/interaction.test.ts` to spin up a real local HTTP server that maps the site's actual base path, matching how the page is deployed on GitHub Pages, rather than relying on an assumption (that the bundle stays inlined) that had already broken once. I knew it was right because the same three interaction tests, unchanged in what they assert, went from failing to passing purely from the serving change — the fix was in how the test matched reality, not in the feature code.

[`236028f`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-maddywright3/commit/236028fc05176c67d5463bd2df692e817c55fbc5)

**3. Writing the rule for handling failures before writing any feature code**

Before building anything, I set the standards the rest of the work would have to hold to: never commit without approval, the static/vanilla/dual-viewport constraints, and how price-logic and UI changes get verified before I claim they work. The rule that mattered most was the last one: don't just retry when something's wrong — propose a rule for `CLAUDE.md` that would prevent that class of mistake, then fix the issue. That's what made moments 1 and 2 possible: both times, once a bug was caught, the response was a permanent addition to the harness (a new test category, a corrected test assumption) rather than a one-off patch. I know it held because it wasn't a one-time gesture — it's the reason the two moments above exist as commits at all, not just as fixes I made and forgot.

[`bc2d326`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-maddywright3/commit/bc2d326b8e2261f3e627a635c57616fc6616c1e8)
