import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  FARE_BUCKETS,
  INITIAL_SOLD_SEAT_INDICES,
  PLANE_TYPES,
  TOTAL_SEATS,
  evenlySpacedIndices,
  priceForFlight,
  priceForLoadFactor,
} from "../src/scripts/price";

// Assignment 1 spec (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/)
// sorted into what a test can hold and what a person judges at the crit:
//
// - "static and client-side throughout, and the starter's invariant checks
//   pass" -- covered by spec/invariants.test.ts, nothing new needed here.
// - "evidence of process is in the repo" -- enforced by `pnpm check:evidence`.
// - "deployed and live at its public GitHub Pages URL" -- checked against the
//   live URL by the course's preflight/ship tooling, not against dist/ here.
// - "it works at both marking viewports (desktop and phone)" and "one strong
//   idea with a point of view, and nothing else" -- judged by a person at the
//   crit; no test can hold these. Verify the viewports yourself before then.
//
// The core interaction: clicking "Wait" sells more seats and the price never
// drops below what it was; clicking "Book now" locks the price and reveals a
// readout comparing it to the flight's opening price.
//
// jsdom does not execute this page's bundled `type="module"` script (verified
// directly — even with runScripts: "dangerously", a module script's listeners
// never attach), so this file can't drive a real click and watch the DOM
// react. It tests the two halves separately: the pricing model as a pure
// function (imported directly, no DOM needed), and the built page's static
// contract (the elements the interaction depends on actually exist, wired
// with the right hooks, in the right initial state). The click-driven
// interaction itself — including the zero-wait booking regression — is
// covered in spec/interaction.test.ts, which drives a real headless browser.

describe("pricing model", () => {
  it("is non-decreasing across every possible load factor", () => {
    let previous = 0;
    for (let sold = 0; sold <= TOTAL_SEATS; sold++) {
      const price = priceForLoadFactor(sold, TOTAL_SEATS);
      expect(price).toBeGreaterThanOrEqual(previous);
      previous = price;
    }
  });

  it("matches the model at an early, half-sold, and near-full state", () => {
    // 11/30 sold ≈ 36.7% load factor -> first bucket (<= 40%) -> $89
    expect(priceForLoadFactor(11, TOTAL_SEATS)).toBe(89);
    // 16/30 sold ≈ 53.3% load factor -> second bucket (<= 60%) -> $119
    expect(priceForLoadFactor(16, TOTAL_SEATS)).toBe(119);
    // 29/30 sold ≈ 96.7% load factor -> sixth bucket (<= 97%) -> $419
    expect(priceForLoadFactor(29, TOTAL_SEATS)).toBe(419);
    // 30/30 sold = 100% load factor -> last bucket -> $589
    expect(priceForLoadFactor(30, TOTAL_SEATS)).toBe(589);
  });

  it("has strictly increasing thresholds and prices, which is what makes it monotonic", () => {
    for (let i = 1; i < FARE_BUCKETS.length; i++) {
      expect(FARE_BUCKETS[i].maxLoadFactor).toBeGreaterThan(
        FARE_BUCKETS[i - 1].maxLoadFactor,
      );
      expect(FARE_BUCKETS[i].price).toBeGreaterThan(
        FARE_BUCKETS[i - 1].price,
      );
    }
  });
});

describe("plane types and the distress-discount exception", () => {
  it("only the wide-body plane is distress-prone", () => {
    const proneIds = PLANE_TYPES.filter((p) => p.distressProne).map(
      (p) => p.id,
    );
    expect(proneIds).toEqual(["widebody"]);
  });

  it("keeps the regional plane's seats and opening state exactly as today", () => {
    const regional = PLANE_TYPES[0];
    expect(regional.id).toBe("regional");
    expect(regional.totalSeats).toBe(TOTAL_SEATS);
    expect(regional.initialSoldIndices).toBe(INITIAL_SOLD_SEAT_INDICES);
  });

  it("evenlySpacedIndices produces the requested count, in bounds, for each plane", () => {
    for (const plane of PLANE_TYPES) {
      const indices = evenlySpacedIndices(10, plane.totalSeats);
      expect(indices.length).toBeLessThanOrEqual(10);
      for (const i of indices) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(plane.totalSeats);
      }
    }
    expect(evenlySpacedIndices(0, 180)).toEqual([]);
  });

  it("never lets a non-distress-prone plane's price differ from the plain load-factor curve", () => {
    const [regional, narrowbody] = PLANE_TYPES;
    for (const plane of [regional, narrowbody]) {
      for (let sold = 0; sold <= plane.totalSeats; sold += 5) {
        for (const days of [60, 30, 15, 1]) {
          const { price, distressed } = priceForFlight(sold, plane, days);
          expect(distressed).toBe(false);
          expect(price).toBe(priceForLoadFactor(sold, plane.totalSeats));
        }
      }
    }
  });

  it("only ever matches or undercuts the normal curve for the distress-prone plane, never exceeds it", () => {
    const widebody = PLANE_TYPES.find((p) => p.id === "widebody");
    if (!widebody) throw new Error("widebody plane type not found");
    for (let sold = 0; sold <= widebody.totalSeats; sold += 5) {
      for (const days of [60, 30, 20, 10, 1]) {
        const { price } = priceForFlight(sold, widebody, days);
        expect(price).toBeLessThanOrEqual(
          priceForLoadFactor(sold, widebody.totalSeats),
        );
      }
    }
  });

  it("walks 3 sample states for the distress-prone plane: early, under-booked near departure, and well-booked near departure", () => {
    const widebody = PLANE_TYPES.find((p) => p.id === "widebody");
    if (!widebody) throw new Error("widebody plane type not found");

    // Early (60 days out): outside the distress window regardless of load
    // factor, so the normal curve always applies.
    const early = priceForFlight(70, widebody, 60);
    expect(early).toEqual({
      price: priceForLoadFactor(70, widebody.totalSeats),
      distressed: false,
    });

    // Near departure (10 days out, inside the 20-day window), badly
    // under-booked (125/180 ≈ 69% < the 75% distress threshold): normal
    // curve says $159, but the distress rule undercuts it back to $89.
    const underBooked = priceForFlight(125, widebody, 10);
    expect(priceForLoadFactor(125, widebody.totalSeats)).toBe(159);
    expect(underBooked).toEqual({ price: 89, distressed: true });

    // Near departure (10 days out), but well-booked (170/180 ≈ 94% >= the
    // 75% threshold): distress condition doesn't hold, so the normal
    // (much higher) curve price stands untouched.
    const wellBooked = priceForFlight(170, widebody, 10);
    expect(wellBooked).toEqual({
      price: priceForLoadFactor(170, widebody.totalSeats),
      distressed: false,
    });
    expect(wellBooked.price).toBeGreaterThan(underBooked.price);
  });
});

describe("core interaction: built page contract", () => {
  const distPath = resolve("dist/index.html");
  const exists = existsSync(distPath);
  const doc = exists
    ? new JSDOM(readFileSync(distPath, "utf8")).window.document
    : null;

  it("built the page", () => {
    expect(exists, `${distPath} not found — run \`pnpm build\` first.`).toBe(
      true,
    );
  });

  it("renders every seat with an initial sold/available status", () => {
    const seats = doc?.querySelectorAll('[data-testid="seat-map"] .seat');
    expect(seats?.length).toBe(TOTAL_SEATS);
    seats?.forEach((seat, index) => {
      const expectedStatus = INITIAL_SOLD_SEAT_INDICES.includes(index)
        ? "sold"
        : "available";
      expect(seat.getAttribute("data-status")).toBe(expectedStatus);
    });
  });

  it("shows the opening price computed from the initial seat state", () => {
    const expectedPrice = priceForLoadFactor(
      INITIAL_SOLD_SEAT_INDICES.length,
      TOTAL_SEATS,
    );
    expect(doc?.querySelector('[data-testid="price"]')?.textContent).toBe(
      `$${expectedPrice}`,
    );
  });

  it("has a wait button and a book button the visitor can act on", () => {
    expect(doc?.querySelector('[data-testid="wait-button"]')).toBeTruthy();
    expect(doc?.querySelector('[data-testid="book-button"]')).toBeTruthy();
  });

  it("has a result readout, present but hidden until the visitor books", () => {
    const result = doc?.querySelector('[data-testid="result"]');
    expect(result).toBeTruthy();
    expect(result?.hasAttribute("hidden")).toBe(true);
  });
});
