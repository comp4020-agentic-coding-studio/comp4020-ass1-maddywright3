import {
  PLANE_TYPES,
  type PlaneType,
  initialSeatSaleInfo,
  priceForFlight,
} from "./price";

const seatMap = document.querySelector<HTMLElement>('[data-testid="seat-map"]');
const priceEl = document.querySelector<HTMLElement>('[data-testid="price"]');
const seatsRemainingEl = document.querySelector<HTMLElement>(
  '[data-testid="seats-remaining"]',
);
const daysRemainingEl = document.querySelector<HTMLElement>(
  '[data-testid="days-remaining"]',
);
const waitButton = document.querySelector<HTMLButtonElement>(
  '[data-testid="wait-button"]',
);
const bookButton = document.querySelector<HTMLButtonElement>(
  '[data-testid="book-button"]',
);
const resetButton = document.querySelector<HTMLButtonElement>(
  '[data-testid="reset-button"]',
);
const planeSelect = document.querySelector<HTMLSelectElement>(
  '[data-testid="plane-select"]',
);
const resultEl = document.querySelector<HTMLElement>('[data-testid="result"]');
const resultTextEl = document.querySelector<HTMLElement>(
  '[data-testid="result-text"]',
);
const srSummaryEl = document.querySelector<HTMLElement>(
  '[data-testid="sr-summary"]',
);
const seatInfoEl = document.querySelector<HTMLElement>(
  '[data-testid="seat-info"]',
);

if (
  seatMap &&
  priceEl &&
  seatsRemainingEl &&
  daysRemainingEl &&
  waitButton &&
  bookButton &&
  resetButton &&
  resultEl &&
  resultTextEl &&
  srSummaryEl &&
  seatInfoEl
) {
  const START_DAYS = 60;
  const AMBIENT_INTERVAL_MS = 3500;
  const BOOKING_WINDOW_START_DAYS = 120;

  let currentPlane: PlaneType = PLANE_TYPES[0];
  let seatEls: HTMLElement[] = [];
  let sold = new Set<number>();
  let seatSaleInfo = new Map<number, { price: number; daysBeforeDeparture: number }>();
  let daysToDeparture = START_DAYS;
  let locked = false;
  let ambientTimer: number | undefined;
  let openingPrice = 0;
  let lastRenderedPrice = 0;
  let distressedThisSession = false;

  const availableIndices = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < currentPlane.totalSeats; i++) {
      if (!sold.has(i)) out.push(i);
    }
    return out;
  };

  const sellSeats = (
    range: { min: number; extra: number },
    daysAtSale: number,
  ): void => {
    const available = availableIndices();
    const count = range.min + Math.floor(Math.random() * (range.extra + 1));
    const n = Math.min(count, available.length);
    const picked: number[] = [];
    for (let i = 0; i < n; i++) {
      const pick = available.splice(
        Math.floor(Math.random() * available.length),
        1,
      )[0];
      sold.add(pick);
      picked.push(pick);
    }
    const { price: priceAtSale } = priceForFlight(
      sold.size,
      currentPlane,
      daysAtSale,
    );
    for (const idx of picked) {
      seatSaleInfo.set(idx, { price: priceAtSale, daysBeforeDeparture: daysAtSale });
    }
  };

  const seatLabel = (idx: number, currentPrice: number): string => {
    const sale = seatSaleInfo.get(idx);
    if (sale) {
      return (
        `Seat ${idx + 1}, sold in the $${sale.price} fare bracket, ` +
        `about ${sale.daysBeforeDeparture} days before departure`
      );
    }
    return `Seat ${idx + 1}, still available, would cost $${currentPrice} now`;
  };

  const showSeatInfo = (idx: number, currentPrice: number): void => {
    seatInfoEl.hidden = false;
    const sale = seatSaleInfo.get(idx);
    seatInfoEl.textContent = sale
      ? `Seat ${idx + 1} — sold in the $${sale.price} fare bracket, about ` +
        `${sale.daysBeforeDeparture} days before departure.`
      : `Seat ${idx + 1} — still available. Booking it now would cost $${currentPrice}.`;
  };

  const render = (): number => {
    const { price, distressed } = priceForFlight(
      sold.size,
      currentPlane,
      daysToDeparture,
    );
    if (distressed) distressedThisSession = true;
    for (const seat of seatEls) {
      const idx = Number(seat.dataset.index);
      seat.dataset.status = sold.has(idx) ? "sold" : "available";
      seat.setAttribute("aria-label", seatLabel(idx, price));
    }
    priceEl.textContent = `$${price}`;
    if (price !== lastRenderedPrice) {
      priceEl.classList.remove("price-tick");
      // Force a reflow so re-adding the class restarts the animation even if
      // the price changes twice in quick succession.
      void priceEl.offsetWidth;
      priceEl.classList.add("price-tick");
    }
    lastRenderedPrice = price;
    seatsRemainingEl.textContent = String(currentPlane.totalSeats - sold.size);
    daysRemainingEl.textContent = String(daysToDeparture);
    srSummaryEl.textContent =
      `${sold.size} of ${currentPlane.totalSeats} seats sold. ` +
      `Current price $${price}. ${daysToDeparture} days to departure.`;
    return price;
  };

  const endInteraction = (): void => {
    locked = true;
    waitButton.disabled = true;
    bookButton.disabled = true;
    if (ambientTimer !== undefined) window.clearInterval(ambientTimer);
  };

  const showResult = (
    outcome: "booked" | "sold-out" | "departed",
    finalPrice: number,
  ): void => {
    resultEl.hidden = false;
    resultEl.dataset.outcome = outcome;

    const diff = finalPrice - openingPrice;
    const distressClause = distressedThisSession
      ? "That's exactly what happened on this flight: it stayed badly " +
        "under-booked close to departure, so the price dropped back down " +
        "instead of climbing further."
      : "You can't tell in advance which flight that'll be, and this one " +
        "wasn't it.";
    const aside = `
      <p class="aside">
        Real flights occasionally buck this trend: airlines sometimes discount
        a flight that's still badly under-booked days before departure,
        rather than fly it empty. That's a rescue for a flight that's
        underperforming its booking curve, not a reward for waiting —
        ${distressClause}
      </p>
    `;

    if (outcome === "booked" && diff === 0) {
      resultTextEl.innerHTML = `
        <p>You booked at $${finalPrice} — before the price had moved at all.</p>
        <p>Click Wait a few times next round and watch what happens instead.</p>
        ${aside}
      `;
      return;
    }

    const diffText =
      diff > 0
        ? `$${diff} more than the opening price of $${openingPrice}`
        : diff < 0
          ? `$${-diff} less than the opening price of $${openingPrice}`
          : `the same as the opening price of $${openingPrice}`;

    let headline: string;
    if (outcome === "booked") {
      headline = `You booked at $${finalPrice} — ${diffText}.`;
    } else if (outcome === "sold-out") {
      headline = `Sold out before you booked. The last price shown was $${finalPrice} — ${diffText}.`;
    } else {
      headline = `The gate closed before you booked. The last price shown was $${finalPrice} — ${diffText}.`;
    }

    resultTextEl.innerHTML = `
      <p>${headline}</p>
      <p>If you'd booked at the very start, you'd have paid $${openingPrice}.</p>
      ${aside}
    `;
  };

  const checkForcedEnd = (): boolean => {
    if (sold.size >= currentPlane.totalSeats) {
      const price = render();
      endInteraction();
      showResult("sold-out", price);
      return true;
    }
    if (daysToDeparture <= 0) {
      const price = render();
      endInteraction();
      showResult("departed", price);
      return true;
    }
    return false;
  };

  // Roving tabindex (WAI-ARIA grid pattern): only one seat is ever a Tab
  // stop, so keyboard users still reach Wait/Book in two tabs, not thirty-plus.
  // Arrow keys move the "current" seat within the grid instead.
  const focusSeat = (idx: number): void => {
    for (const seat of seatEls) {
      seat.tabIndex = Number(seat.dataset.index) === idx ? 0 : -1;
    }
    seatEls[idx]?.focus();
  };

  const attachSeatListeners = (): void => {
    seatEls.forEach((seat, idx) => {
      seat.addEventListener("click", () => {
        showSeatInfo(idx, lastRenderedPrice);
        focusSeat(idx);
      });

      seat.addEventListener("keydown", (event) => {
        const deltas: Record<string, number> = {
          ArrowRight: 1,
          ArrowLeft: -1,
          ArrowDown: currentPlane.columns,
          ArrowUp: -currentPlane.columns,
        };
        const delta = deltas[event.key];
        if (delta === undefined) return;
        event.preventDefault();
        const next = Math.min(Math.max(idx + delta, 0), seatEls.length - 1);
        focusSeat(next);
      });
    });
  };

  const buildSeatMap = (): void => {
    seatMap.innerHTML = "";
    seatMap.style.setProperty("--seat-cols", String(currentPlane.columns));
    seatMap.dataset.cols = String(currentPlane.columns);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < currentPlane.totalSeats; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat";
      button.dataset.index = String(i);
      button.dataset.status = sold.has(i) ? "sold" : "available";
      button.tabIndex = i === 0 ? 0 : -1;
      fragment.appendChild(button);
    }
    seatMap.appendChild(fragment);
    seatEls = Array.from(seatMap.querySelectorAll<HTMLElement>(".seat"));
    attachSeatListeners();
  };

  const initializePlane = (plane: PlaneType): void => {
    currentPlane = plane;
    sold = new Set(plane.initialSoldIndices);
    seatSaleInfo = initialSeatSaleInfo(
      START_DAYS,
      BOOKING_WINDOW_START_DAYS,
      plane.totalSeats,
      plane.initialSoldIndices,
    );
    daysToDeparture = START_DAYS;
    locked = false;
    distressedThisSession = false;
    waitButton.disabled = false;
    bookButton.disabled = false;
    resultEl.hidden = true;
    seatInfoEl.hidden = true;
    seatInfoEl.textContent = "";
    if (ambientTimer !== undefined) window.clearInterval(ambientTimer);

    buildSeatMap();
    openingPrice = priceForFlight(sold.size, currentPlane, daysToDeparture).price;
    lastRenderedPrice = openingPrice;
    render();

    ambientTimer = window.setInterval(() => {
      if (locked) return;
      sellSeats(currentPlane.ambientSell, daysToDeparture);
      render();
      checkForcedEnd();
    }, AMBIENT_INTERVAL_MS);
  };

  waitButton.addEventListener("click", () => {
    if (locked) return;
    daysToDeparture = Math.max(
      0,
      daysToDeparture - (5 + Math.floor(Math.random() * 5)), // 5-9 days
    );
    sellSeats(currentPlane.waitSell, daysToDeparture);
    render();
    checkForcedEnd();
  });

  bookButton.addEventListener("click", () => {
    if (locked) return;
    const price = render();
    endInteraction();
    showResult("booked", price);
  });

  resetButton.addEventListener("click", () => {
    initializePlane(currentPlane);
  });

  planeSelect?.addEventListener("change", () => {
    const plane = PLANE_TYPES.find((p) => p.id === planeSelect.value);
    if (plane) initializePlane(plane);
  });

  initializePlane(
    PLANE_TYPES.find((p) => p.id === planeSelect?.value) ?? PLANE_TYPES[0],
  );
}
