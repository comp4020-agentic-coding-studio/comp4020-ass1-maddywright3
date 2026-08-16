# Assignment 1 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was catching a bug my test suite said didn't exist. Before I clicked through the page myself, everything was green: the pricing maths tested, the static markup tested. But jsdom couldn't actually execute the page's bundled script, so no automated check had ever driven a real click. Booking with zero Wait clicks showed the exact same message as booking after the price had risen, just with a `$0` difference — a bug a human notices in about one second and a passing test suite completely hid.

That's the specific thing that changed: I stopped treating "the tests pass" as the end of the question. Before, green meant done. After, green meant "done for whatever this suite can see" — and I now ask what it can't see before I trust it. The fix that mattered wasn't rewording that one message, it was adding real browser-driven tests so that whole class of bug — passing checks, broken interaction — can't slip through silently again.

## What did this work change about who I want to be as a software developer?

It sharpened something I already believed but hadn't been rigorous about: a UI has to work for a human's intuition, not just for the model I've encoded in tests. Tests verify what I thought to check; a person using the thing verifies what I didn't. I want to keep that complementary relationship deliberate — use the tests, but never let them stand in for actually using the page myself before I call something done.
