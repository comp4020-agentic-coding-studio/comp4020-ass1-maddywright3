import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { type Server, createServer } from "node:http";
import { resolve } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// jsdom can't execute this page's bundled `type="module"` script (verified
// directly — a module script's listeners never attach even with
// runScripts: "dangerously"), so the click-driven interaction itself can only
// be exercised in a real browser.
//
// The page's script is bundled into an external chunk referenced by an
// absolute `/comp4020-ass1-maddywright3/...` path (astro.config.ts's `base`)
// whenever it's too large for Astro to inline — which it was NOT, until this
// page grew past that threshold. That broke a plain file:// load outright
// (no such root exists on disk), and this test caught it: every click
// silently did nothing. So instead of relying on the page staying small
// enough to stay inlined, this serves dist/ over real HTTP with the site's
// base path mapped, matching how the page is actually deployed.

const DIST_DIR = resolve("dist");
const BASE_PATH = "/comp4020-ass1-maddywright3";
const distExists = existsSync(resolve(DIST_DIR, "index.html"));

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

describe.skipIf(!distExists)("core interaction: real clicks in a browser", () => {
  let server: Server;
  let baseUrl: string;
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const urlPath = req.url ?? "/";
      if (!urlPath.startsWith(BASE_PATH)) {
        res.writeHead(404);
        res.end();
        return;
      }
      let relative = urlPath.slice(BASE_PATH.length);
      if (relative === "" || relative === "/") relative = "/index.html";
      readFile(resolve(DIST_DIR, `.${relative}`))
        .then((data) => {
          res.writeHead(200, { "content-type": contentTypeFor(relative) });
          res.end(data);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
    });
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${address.port}${BASE_PATH}/`;
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
    await new Promise<void>((res) => server.close(() => res()));
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(baseUrl);
  });

  it("clicking Wait sells more seats and never drops the price", async () => {
    // Real-browser tests: give the first connection to the freshly-bound
    // local server, plus 6 sequential clicks, more room than vitest's
    // default 5s (this was flaky at the default, never on the logic itself).
    const priceEl = page.getByTestId("price");
    const seatsRemainingEl = page.getByTestId("seats-remaining");

    const initialPrice = Number((await priceEl.textContent())?.replace("$", ""));
    const initialRemaining = Number(await seatsRemainingEl.textContent());

    for (let i = 0; i < 6; i++) {
      await page.getByTestId("wait-button").click();
    }

    const laterPrice = Number((await priceEl.textContent())?.replace("$", ""));
    const laterRemaining = Number(await seatsRemainingEl.textContent());

    expect(laterRemaining).toBeLessThan(initialRemaining);
    expect(laterPrice).toBeGreaterThanOrEqual(initialPrice);
  }, 15000);

  it("booking immediately, with no Wait clicks, shows the zero-wait message — not the price-rise one", async () => {
    // This is the exact bug reported manually: booking before the price has
    // moved must not read like the moved-price case with a $0 diff.
    await page.getByTestId("book-button").click();

    const resultText = await page.getByTestId("result-text").textContent();

    expect(resultText).toContain("before the price had moved at all");
    expect(resultText).toContain("Click Wait a few times next round");
    expect(resultText).not.toContain("more than the opening price");

    expect(await page.getByTestId("result").isVisible()).toBe(true);
    expect(await page.getByTestId("wait-button").isDisabled()).toBe(true);
    expect(await page.getByTestId("book-button").isDisabled()).toBe(true);
  });

  it("booking after the price has risen shows the price-rise message — not the zero-wait one", async () => {
    // Sell seats until a wait click actually moves the price bucket, then
    // book. A single click sells 2-4 seats out of 30, so waiting until the
    // price changes (rather than a fixed click count) keeps this robust
    // against the random amount sold per click.
    const priceEl = page.getByTestId("price");
    const openingPrice = Number((await priceEl.textContent())?.replace("$", ""));

    let currentPrice = openingPrice;
    for (let i = 0; i < 15 && currentPrice === openingPrice; i++) {
      await page.getByTestId("wait-button").click();
      currentPrice = Number((await priceEl.textContent())?.replace("$", ""));
    }
    expect(currentPrice).toBeGreaterThan(openingPrice);

    await page.getByTestId("book-button").click();
    const resultText = await page.getByTestId("result-text").textContent();

    expect(resultText).toContain(
      `$${currentPrice - openingPrice} more than the opening price of $${openingPrice}`,
    );
    expect(resultText).not.toContain("before the price had moved at all");
  });

  it("Reset restores the initial price, seats remaining, days, and enabled controls", async () => {
    const priceEl = page.getByTestId("price");
    const seatsRemainingEl = page.getByTestId("seats-remaining");
    const daysRemainingEl = page.getByTestId("days-remaining");

    const initialPrice = await priceEl.textContent();
    const initialRemaining = await seatsRemainingEl.textContent();
    const initialDays = await daysRemainingEl.textContent();

    for (let i = 0; i < 3; i++) {
      await page.getByTestId("wait-button").click();
    }
    // Sanity check the clicks actually changed something before Reset undoes it.
    expect(await seatsRemainingEl.textContent()).not.toBe(initialRemaining);

    await page.getByTestId("reset-button").click();

    expect(await priceEl.textContent()).toBe(initialPrice);
    expect(await seatsRemainingEl.textContent()).toBe(initialRemaining);
    expect(await daysRemainingEl.textContent()).toBe(initialDays);
    expect(await page.getByTestId("result").isVisible()).toBe(false);
    expect(await page.getByTestId("wait-button").isDisabled()).toBe(false);
    expect(await page.getByTestId("book-button").isDisabled()).toBe(false);
  });

  it("switching the aircraft rebuilds the seat map to the new plane's seat count and resets state", async () => {
    const seatButtons = page.locator('[data-testid="seat-map"] .seat');
    expect(await seatButtons.count()).toBe(30);

    await page.getByTestId("wait-button").click();

    await page.getByTestId("plane-select").selectOption("narrowbody");

    expect(await seatButtons.count()).toBe(96);
    expect(await page.getByTestId("days-remaining").textContent()).toBe("60");
    expect(await page.getByTestId("result").isVisible()).toBe(false);
    expect(await page.getByTestId("wait-button").isDisabled()).toBe(false);
    expect(await page.getByTestId("book-button").isDisabled()).toBe(false);
  });

  it("the wide-body aircraft can drop its price back down before departure (the distress discount)", async () => {
    await page.getByTestId("plane-select").selectOption("widebody");

    const priceEl = page.getByTestId("price");
    const prices: number[] = [
      Number((await priceEl.textContent())?.replace("$", "")),
    ];

    for (let i = 0; i < 25; i++) {
      if (await page.getByTestId("wait-button").isDisabled()) break;
      await page.getByTestId("wait-button").click();
      prices.push(Number((await priceEl.textContent())?.replace("$", "")));
    }

    const droppedAtLeastOnce = prices.some((p, i) => i > 0 && p < prices[i - 1]);
    expect(droppedAtLeastOnce).toBe(true);
  }, 30000);
});
