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

export interface SeatSale {
  price: number;
  daysBeforeDeparture: number;
}

export interface PlaneType {
  id: string;
  label: string;
  totalSeats: number;
  columns: number;
  initialSoldIndices: number[];
  // Seats sold per Wait click / per ambient tick = min + random(0..extra).
  waitSell: { min: number; extra: number };
  ambientSell: { min: number; extra: number };
  // Only a distress-prone plane can undercut its own booking curve — see
  // priceForFlight. The window/load-factor pair controls how late and how
  // under-booked the flight must be before that can happen.
  distressProne: boolean;
  distressWindowDays: number;
  distressLoadFactor: number;
}

// Same ~36.7% opening load factor INITIAL_SOLD_SEAT_INDICES starts at
// (11/30), spread evenly across the seat map rather than hand-listed.
export function evenlySpacedIndices(count: number, total: number): number[] {
  if (count <= 0) return [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i++) {
    seen.add(Math.min(total - 1, Math.round((i * total) / count)));
  }
  return Array.from(seen);
}

export const PLANE_TYPES: PlaneType[] = [
  {
    id: "regional",
    label: "Regional turboprop — 30 seats",
    totalSeats: TOTAL_SEATS,
    columns: 6,
    initialSoldIndices: INITIAL_SOLD_SEAT_INDICES,
    waitSell: { min: 2, extra: 2 },
    ambientSell: { min: 1, extra: 1 },
    distressProne: false,
    distressWindowDays: 0,
    distressLoadFactor: 0,
  },
  {
    id: "narrowbody",
    label: "Narrow-body jet — 96 seats",
    totalSeats: 96,
    columns: 12,
    initialSoldIndices: evenlySpacedIndices(Math.round(96 * 0.3667), 96),
    waitSell: { min: 6, extra: 4 },
    ambientSell: { min: 3, extra: 2 },
    distressProne: false,
    distressWindowDays: 0,
    distressLoadFactor: 0,
  },
  {
    id: "widebody",
    label: "Wide-body jet — 180 seats",
    totalSeats: 180,
    columns: 12,
    initialSoldIndices: evenlySpacedIndices(Math.round(180 * 0.3667), 180),
    waitSell: { min: 4, extra: 8 },
    ambientSell: { min: 2, extra: 4 },
    distressProne: true,
    distressWindowDays: 20,
    distressLoadFactor: 0.75,
  },
];

// Nested fare buckets only ever step the price up as load factor rises — see
// FARE_BUCKETS above. Distress-prone planes are the one deliberate exception:
// if a flight is still badly under-booked close to departure, the airline
// discounts it back toward the opening fare rather than fly it near-empty.
// Math.min means this can only match or undercut the normal curve, never
// exceed it, so non-distress-prone planes are completely unaffected.
export function priceForFlight(
  seatsSold: number,
  plane: PlaneType,
  daysToDeparture: number,
): { price: number; distressed: boolean } {
  const normal = priceForLoadFactor(seatsSold, plane.totalSeats);
  const inDistressWindow =
    plane.distressProne &&
    daysToDeparture <= plane.distressWindowDays &&
    seatsSold / plane.totalSeats < plane.distressLoadFactor;
  const price = inDistressWindow
    ? Math.min(normal, FARE_BUCKETS[0].price)
    : normal;
  return { price, distressed: inDistressWindow && price < normal };
}

// Fabricates a plausible sale history for the seats already sold when the
// page loads. Real booking curves open ~11 months out; this page's visible
// window is only the last `startDays`, so these seats are backdated into a
// wider window before it (earliest seat index sold first), rather than
// claiming a precision the model doesn't have.
export function initialSeatSaleInfo(
  startDays: number,
  bookingWindowStartDays: number,
  totalSeats: number = TOTAL_SEATS,
  initialSoldIndices: number[] = INITIAL_SOLD_SEAT_INDICES,
): Map<number, SeatSale> {
  const span = bookingWindowStartDays - (startDays + 1);
  const info = new Map<number, SeatSale>();
  initialSoldIndices.forEach((seatIndex, i) => {
    const rank = i + 1;
    const price = priceForLoadFactor(rank, totalSeats);
    const daysBeforeDeparture =
      initialSoldIndices.length > 1
        ? Math.round(
            bookingWindowStartDays - (span * i) / (initialSoldIndices.length - 1),
          )
        : bookingWindowStartDays;
    info.set(seatIndex, { price, daysBeforeDeparture });
  });
  return info;
}
