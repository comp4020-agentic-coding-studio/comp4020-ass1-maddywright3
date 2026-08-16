import {
  TOTAL_SEATS,
  initialSeatSaleInfo,
  priceForLoadFactor,
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
  resultEl &&
  resultTextEl &&
  srSummaryEl &&
  seatInfoEl
) {
  const START_DAYS = 60;
  const AMBIENT_INTERVAL_MS = 3500;
  const BOOKING_WINDOW_START_DAYS = 120;

  const seatEls = Array.from(seatMap.querySelectorAll<HTMLElement>(".seat"));
  const sold = new Set(
    seatEls
      .filter((el) => el.dataset.status === "sold")
      .map((el) => Number(el.dataset.index)),
  );
  const initialPrice = priceForLoadFactor(sold.size, TOTAL_SEATS);

  let daysToDeparture = START_DAYS;
  let locked = false;
  let ambientTimer: number | undefined;
  let lastRenderedPrice = initialPrice;

  // Per sold seat, the fare bucket price and days-before-departure it sold
  // at — fabricated for the seats already sold when the page loads, then
  // recorded for real as each seat sells during the session.
  const seatSaleInfo = initialSeatSaleInfo(START_DAYS, BOOKING_WINDOW_START_DAYS);

  const availableIndices = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < TOTAL_SEATS; i++) {
      if (!sold.has(i)) out.push(i);
    }
    return out;
  };

  const sellSeats = (count: number, daysAtSale: number): void => {
    const available = availableIndices();
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
    const priceAtSale = priceForLoadFactor(sold.size, TOTAL_SEATS);
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
    const price = priceForLoadFactor(sold.size, TOTAL_SEATS);
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
    seatsRemainingEl.textContent = String(TOTAL_SEATS - sold.size);
    daysRemainingEl.textContent = String(daysToDeparture);
    srSummaryEl.textContent =
      `${sold.size} of ${TOTAL_SEATS} seats sold. ` +
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

    const diff = finalPrice - initialPrice;
    const aside = `
      <p class="aside">
        Real flights occasionally buck this trend: airlines sometimes discount
        a flight that's still badly under-booked days before departure,
        rather than fly it empty. That's a rescue for a flight that's
        underperforming its booking curve, not a reward for waiting — you
        can't tell in advance which flight that'll be, and this one wasn't
        it.
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
        ? `$${diff} more than the opening price of $${initialPrice}`
        : `the same as the opening price of $${initialPrice}`;

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
      <p>If you'd booked at the very start, you'd have paid $${initialPrice}.</p>
      ${aside}
    `;
  };

  const checkForcedEnd = (): boolean => {
    if (sold.size >= TOTAL_SEATS) {
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

  waitButton.addEventListener("click", () => {
    if (locked) return;
    daysToDeparture = Math.max(
      0,
      daysToDeparture - (5 + Math.floor(Math.random() * 5)), // 5-9 days
    );
    sellSeats(2 + Math.floor(Math.random() * 3), daysToDeparture); // 2-4 seats
    render();
    checkForcedEnd();
  });

  bookButton.addEventListener("click", () => {
    if (locked) return;
    const price = render();
    endInteraction();
    showResult("booked", price);
  });

  // Roving tabindex (WAI-ARIA grid pattern): only one seat is ever a Tab
  // stop, so keyboard users still reach Wait/Book in two tabs, not thirty-two.
  // Arrow keys move the "current" seat within the grid instead.
  const SEAT_COLUMNS = 6;

  const focusSeat = (idx: number): void => {
    for (const seat of seatEls) {
      seat.tabIndex = Number(seat.dataset.index) === idx ? 0 : -1;
    }
    seatEls[idx]?.focus();
  };

  seatEls.forEach((seat, idx) => {
    seat.addEventListener("click", () => {
      showSeatInfo(idx, lastRenderedPrice);
      focusSeat(idx);
    });

    seat.addEventListener("keydown", (event) => {
      const deltas: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: SEAT_COLUMNS,
        ArrowUp: -SEAT_COLUMNS,
      };
      const delta = deltas[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      const next = Math.min(Math.max(idx + delta, 0), seatEls.length - 1);
      focusSeat(next);
    });
  });

  render();

  ambientTimer = window.setInterval(() => {
    if (locked) return;
    sellSeats(1 + Math.floor(Math.random() * 2), daysToDeparture); // 1-2 seats
    render();
    checkForcedEnd();
  }, AMBIENT_INTERVAL_MS);
}
