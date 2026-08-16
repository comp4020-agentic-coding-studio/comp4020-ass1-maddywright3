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
  buckets: FareBucket[] = FARE_BUCKETS,
): number {
  const loadFactor = seatsSold / totalSeats;
  const bucket = buckets.find((b) => loadFactor <= b.maxLoadFactor);
  return (bucket ?? buckets[buckets.length - 1]).price;
}

export interface SeatSale {
  price: number;
  daysBeforeDeparture: number;
}

// A cabin section is a contiguous block of seats sharing a fare multiplier,
// perk, and physical layout. Sections are non-interactive: they scale the
// same climbing base (economy) price the visitor Waits/Books against, so the
// core interaction and its non-decreasing guarantee are untouched by this.
export interface CabinSection {
  id: "business" | "premium" | "economy";
  label: string;
  priceMultiplier: number;
  perk: string;
  rows: number;
  // Seats per block between aisles, e.g. [2, 3, 2] = 2-3-2 with two aisles.
  columnGroups: number[];
}

export interface SeatLayoutEntry {
  index: number;
  section: CabinSection;
  // True for the last seat of every column group except a row's last group
  // — drives the CSS aisle gap generically, for any layout.
  aisleAfter: boolean;
}

export interface PlaneType {
  id: string;
  label: string;
  totalSeats: number;
  flightNumber: string;
  route: string;
  note: string;
  // Each route's own economy booking curve -- a short competitive domestic
  // hop, a semi-monopoly regional hop, and an international long-haul don't
  // open (or climb) anywhere near the same price. See PLANE_TYPES below for
  // the researched fare ranges behind each one.
  fareBuckets: FareBucket[];
  cabinSections: CabinSection[];
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
    flightNumber: "QF1638",
    route: "CBR→SYD",
    note:
      "Regional turboprop hops like this one run on predictable, mostly " +
      "business commuter demand — short notice, small aircraft, no long " +
      "lead time for prices to swing on. That steady demand is why this " +
      "route never needs a late discount to fill the plane.",
    // CBR-SYD is a near-monopoly regional route -- Qantas held it largely
    // uncontested for years at $150-$300+ one-way (spiking well past that
    // pre-competition) until Rex entered undercutting at ~$99. Unchanged
    // from the original shared curve, which already reflected this.
    fareBuckets: FARE_BUCKETS,
    cabinSections: [
      {
        id: "economy",
        label: "Economy",
        priceMultiplier: 1,
        perk: "standard seat",
        rows: 10,
        columnGroups: [2, 1],
      },
    ],
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
    flightNumber: "QF430",
    route: "SYD→MEL",
    note:
      "SYD–MEL is the country's busiest domestic trunk route — dozens of " +
      "flights a day, mostly business and short-notice leisure travellers. " +
      "That volume and predictability is why this route, like the " +
      "regional hop, never needs to discount a still-empty seat close to " +
      "departure.",
    // SYD-MEL is the country's busiest, most heavily contested domestic
    // trunk route -- Qantas/Jetstar/Virgin compete head-on, with one-way
    // economy fares typically $50-$260 (Jetstar as low as $35, cheapest
    // months averaging ~$127). That competition keeps every bucket cheaper
    // than the regional route's semi-monopoly curve.
    fareBuckets: [
      { maxLoadFactor: 0.4, price: 69 },
      { maxLoadFactor: 0.6, price: 89 },
      { maxLoadFactor: 0.75, price: 119 },
      { maxLoadFactor: 0.85, price: 159 },
      { maxLoadFactor: 0.92, price: 199 },
      { maxLoadFactor: 0.97, price: 249 },
      { maxLoadFactor: 1, price: 299 },
    ],
    cabinSections: [
      {
        id: "business",
        label: "Business",
        priceMultiplier: 2.75,
        perk: "recliner seat, priority boarding, dedicated cabin crew",
        rows: 3,
        columnGroups: [2, 2],
      },
      {
        id: "premium",
        label: "Premium Economy",
        priceMultiplier: 1.5,
        perk: "extra legroom, priority boarding",
        rows: 3,
        columnGroups: [3, 3],
      },
      {
        id: "economy",
        label: "Economy",
        priceMultiplier: 1,
        perk: "standard seat",
        rows: 11,
        columnGroups: [3, 3],
      },
    ],
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
    flightNumber: "QF11",
    route: "SYD→LAX",
    note:
      "Long-haul demand like this is driven by discretionary leisure " +
      "travel, which is far less predictable than the regional and " +
      "domestic routes above. If this flight is still badly under-booked " +
      "close to departure, the airline may drop the price again rather " +
      "than fly a wide-body nearly empty — that risk doesn't apply to the " +
      "other two aircraft.",
    // SYD-LAX long-haul economy typically opens $410-$520 one-way at the
    // saver end and climbs into the $1000-$1300+ range in peak/close-in
    // periods -- a different order of magnitude from the two domestic
    // routes, reflecting fuel/aircraft cost and far less predictable,
    // mostly-discretionary leisure demand.
    fareBuckets: [
      { maxLoadFactor: 0.4, price: 549 },
      { maxLoadFactor: 0.6, price: 649 },
      { maxLoadFactor: 0.75, price: 799 },
      { maxLoadFactor: 0.85, price: 999 },
      { maxLoadFactor: 0.92, price: 1249 },
      { maxLoadFactor: 0.97, price: 1599 },
      { maxLoadFactor: 1, price: 1999 },
    ],
    cabinSections: [
      {
        id: "business",
        label: "Business",
        priceMultiplier: 2.75,
        perk: "lie-flat seat, priority boarding, dedicated cabin crew",
        rows: 4,
        columnGroups: [1, 2, 1],
      },
      {
        id: "premium",
        label: "Premium Economy",
        priceMultiplier: 1.5,
        perk: "extra legroom, priority boarding",
        rows: 4,
        columnGroups: [2, 3, 2],
      },
      {
        id: "economy",
        label: "Economy",
        priceMultiplier: 1,
        perk: "standard seat",
        rows: 17,
        columnGroups: [2, 4, 2],
      },
    ],
    initialSoldIndices: evenlySpacedIndices(Math.round(180 * 0.3667), 180),
    waitSell: { min: 4, extra: 8 },
    ambientSell: { min: 2, extra: 4 },
    distressProne: true,
    distressWindowDays: 20,
    distressLoadFactor: 0.75,
  },
];

function cabinSectionSeatCount(section: CabinSection): number {
  return section.rows * section.columnGroups.reduce((a, b) => a + b, 0);
}

export function sectionForSeat(index: number, plane: PlaneType): CabinSection {
  let cursor = 0;
  for (const section of plane.cabinSections) {
    const count = cabinSectionSeatCount(section);
    if (index < cursor + count) return section;
    cursor += count;
  }
  return plane.cabinSections[plane.cabinSections.length - 1];
}

export function priceForSeat(basePrice: number, section: CabinSection): number {
  return Math.round(basePrice * section.priceMultiplier);
}

// Single source of truth for seat ordering/aisle placement, called by both
// the server-rendered first paint (index.astro) and the client rebuild
// (main.ts on Reset/plane-switch), so the two can't drift apart.
export function buildSeatLayout(plane: PlaneType): SeatLayoutEntry[] {
  const entries: SeatLayoutEntry[] = [];
  let index = 0;
  for (const section of plane.cabinSections) {
    for (let row = 0; row < section.rows; row++) {
      section.columnGroups.forEach((groupSize, groupIdx) => {
        const isLastGroup = groupIdx === section.columnGroups.length - 1;
        for (let seatInGroup = 0; seatInGroup < groupSize; seatInGroup++) {
          entries.push({
            index,
            section,
            aisleAfter: seatInGroup === groupSize - 1 && !isLastGroup,
          });
          index++;
        }
      });
    }
  }
  return entries;
}

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
  const normal = priceForLoadFactor(seatsSold, plane.totalSeats, plane.fareBuckets);
  const inDistressWindow =
    plane.distressProne &&
    daysToDeparture <= plane.distressWindowDays &&
    seatsSold / plane.totalSeats < plane.distressLoadFactor;
  const price = inDistressWindow
    ? Math.min(normal, plane.fareBuckets[0].price)
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
  buckets: FareBucket[] = FARE_BUCKETS,
): Map<number, SeatSale> {
  const span = bookingWindowStartDays - (startDays + 1);
  const info = new Map<number, SeatSale>();
  initialSoldIndices.forEach((seatIndex, i) => {
    const rank = i + 1;
    const price = priceForLoadFactor(rank, totalSeats, buckets);
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
