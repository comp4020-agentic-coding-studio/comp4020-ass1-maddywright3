import { TOTAL_SEATS, priceForLoadFactor } from "./price";

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

if (
  seatMap &&
  priceEl &&
  seatsRemainingEl &&
  daysRemainingEl &&
  waitButton &&
  bookButton &&
  resultEl &&
  resultTextEl &&
  srSummaryEl
) {
  const START_DAYS = 60;
  const AMBIENT_INTERVAL_MS = 3500;

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

  const availableIndices = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < TOTAL_SEATS; i++) {
      if (!sold.has(i)) out.push(i);
    }
    return out;
  };

  const sellSeats = (count: number): void => {
    const available = availableIndices();
    const n = Math.min(count, available.length);
    for (let i = 0; i < n; i++) {
      const pick = available.splice(
        Math.floor(Math.random() * available.length),
        1,
      )[0];
      sold.add(pick);
    }
  };

  const render = (): number => {
    const price = priceForLoadFactor(sold.size, TOTAL_SEATS);
    for (const seat of seatEls) {
      const idx = Number(seat.dataset.index);
      seat.dataset.status = sold.has(idx) ? "sold" : "available";
    }
    priceEl.textContent = `$${price}`;
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
    sellSeats(2 + Math.floor(Math.random() * 3)); // 2-4 seats
    daysToDeparture = Math.max(
      0,
      daysToDeparture - (5 + Math.floor(Math.random() * 5)), // 5-9 days
    );
    render();
    checkForcedEnd();
  });

  bookButton.addEventListener("click", () => {
    if (locked) return;
    const price = render();
    endInteraction();
    showResult("booked", price);
  });

  render();

  ambientTimer = window.setInterval(() => {
    if (locked) return;
    sellSeats(1 + Math.floor(Math.random() * 2)); // 1-2 seats
    render();
    checkForcedEnd();
  }, AMBIENT_INTERVAL_MS);
}
