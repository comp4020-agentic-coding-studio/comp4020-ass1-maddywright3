import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// jsdom can't execute this page's bundled `type="module"` script (verified
// directly — a module script's listeners never attach even with
// runScripts: "dangerously"), so the click-driven interaction itself can only
// be exercised in a real browser. dist/index.html inlines both its <style>
// and its script (astro.config.ts: build.format "file", no external chunks
// at this page's size), so it loads directly off disk via file:// with no
// dev/preview server needed.

const distPath = resolve("dist/index.html");
const distExists = existsSync(distPath);
const distUrl = pathToFileURL(distPath).href;

describe.skipIf(!distExists)("core interaction: real clicks in a browser", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(distUrl);
  });

  it("clicking Wait sells more seats and never drops the price", async () => {
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
  });

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
});
