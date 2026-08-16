// Pure pricing model -- no DOM references, so it can be unit-tested directly
// (jsdom can't execute this page's bundled `type="module"` script, so this
// file is what spec/assignment-1.test.ts imports and exercises).

export const TOTAL_SEATS = 30;

// Deliberately fixed, not random, so the built page's initial state is
// reproducible and testable.
export const INITIAL_SOLD_SEAT_INDICES = [
  0, 3, 4, 7, 10, 13, 14, 17, 20, 23, 26,
];

export interface FareBucket {
  maxLoadFactor: number;
  price: number;
}

// Nested fare buckets, cheapest first -- this is how airline revenue
// management actually prices seats: each bucket closes as it sells out and
// the next, pricier one opens (see e.g. CheapAir/Going.com booking-curve
// data and standard RM literature on nested booking classes). Monotonic by
// construction: thresholds and prices both rise together, so picking the
// first bucket whose threshold covers the current load factor can only
// hold the price or step it up -- never down.
export const FARE_BUCKETS: FareBucket[] = [
  { maxLoadFactor: 0.4, price: 89 },
  { maxLoadFactor: 0.6, price: 119 },
  { maxLoadFactor: 0.75, price: 159 },
  { maxLoadFactor: 0.85, price: 219 },
  { maxLoadFactor: 0.92, price: 299 },
  { maxLoadFactor: 0.97, price: 419 },
  { maxLoadFactor: 1, price: 589 },
];

export function priceForLoadFactor(
  seatsSold: number,
  totalSeats: number = TOTAL_SEATS,
): number {
  const loadFactor = seatsSold / totalSeats;
  const bucket = FARE_BUCKETS.find((b) => loadFactor <= b.maxLoadFactor);
  return (bucket ?? FARE_BUCKETS[FARE_BUCKETS.length - 1]).price;
}
