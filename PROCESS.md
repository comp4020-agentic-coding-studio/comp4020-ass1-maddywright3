# Process overview

## What I built

A live flight-price explainer: three simulated flights, on different aircraft, where clicking Wait sells more seats and pushes the price up through fare brackets, while Book now locks in today's price and shows how it compares to the opening one.

## The moments that mattered

**1. Adding real-browser testing after a bug jsdom couldn't have caught**

Booking with zero Wait clicks rendered the exact same message as the price-rise case, just with a `$0` difference — quietly defeating the whole point of the page. The obvious fix was to patch the string and move on, but the real problem was that nothing could have caught this automatically: jsdom can't execute the page's bundled `type="module"` script, so the click-driven interaction had no test coverage at all. Instead of just fixing the message, I added Playwright as a dependency to drive the built page in real headless Chromium, and updated CI to install Chromium before `pnpm check` runs. The exact bug I'd found by hand is now a named regression test that asserts the zero-wait message, not the price-rise one. I knew it was actually fixed because the new test failed against the old code and passed against the new — not because I eyeballed the page once and moved on.

[`e73ddbf`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-maddywright3/commit/e73ddbf8493f48829a535252d628219c1dff255d)

**2. Fixing the test's assumption about deployment, not the code**

Adding clickable seats grew `main.ts` past Astro's inlining threshold, so its script became an external chunk referenced by an absolute base-path URL. My tests were loading the built page via a plain `file://` path, which can't resolve that URL — every click silently did nothing. The obvious fix was to keep the bundle small enough to stay inlined, or hardcode around the path. Instead, I rewrote `spec/interaction.test.ts` to spin up a real local HTTP server that maps the site's actual base path, matching how the page is deployed on GitHub Pages, rather than relying on an assumption (that the bundle stays inlined) that had already broken once. I knew it was right because the same three interaction tests, unchanged in what they assert, went from failing to passing purely from the serving change — the fix was in how the test matched reality, not in the feature code.

[`236028f`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-maddywright3/commit/236028fc05176c67d5463bd2df692e817c55fbc5)

**3. Rejecting a live "waiting pays off" discount for a static one**

Real airlines sometimes drop a flight's price close to departure if it's still under-booked, and the obvious way to show that was to build it as a live rule alongside the fare-bucket climb — something a visitor could trigger by clicking Wait long enough. I didn't build it that way: a live discount would have broken the one guarantee the page exists to demonstrate, that the price never drops while you wait, and turned the interaction into something worth gaming rather than something worth watching. Instead, I kept the late-discount fact as a static aside shown only after Book now is clicked — true to how real fares behave, but not something a visitor can trigger or wait for. I knew it held because the pricing model's own test asserts the price is non-decreasing across every possible load factor, and the fare buckets are built so their thresholds and prices both only ever rise — the guarantee comes from how the model is constructed, not from hoping nobody waits long enough to find the exception.

[`cb4e49c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-maddywright3/commit/cb4e49c9b7348bad826aa5ea2d9171a8d008c957)
