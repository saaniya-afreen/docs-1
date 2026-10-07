import { getState } from '../state/store';
import { fmtFlightNo, fmtTime } from '../format';
import type { VoiceAdapter, VoiceHandlers, UiAction } from './VoiceAdapter';

// Scripted stand-in for the voice SDK so the UI can be demoed end-to-end today.
// It understands a handful of intents from typed text, calls the same tools a
// real agent would, and streams its replies word by word.

export const DEMO_SCRIPT = [
  'Can I change my flight?',
  'Can you find me the cheapest one, please?',
  'Yes.',
  'Are there any window seats available?',
  '6A.',
  'Can you also add an extra bag?',
  'Yep.',
  'Yes.',
  'Thank you.',
];

type Pending =
  | { kind: 'changeFlight'; flight_id: number }
  | { kind: 'review' }
  | { kind: 'confirm' }
  | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const euros = (n: number) => `${Math.abs(n)} euros`;

let lineSeq = 0;

export function createMockAdapter(h: VoiceHandlers): VoiceAdapter {
  let live = false;
  let pending: Pending = null;
  let queue = Promise.resolve();

  const enqueue = (fn: () => Promise<void>) => {
    queue = queue.then(fn).catch((e) => h.onError(e as Error));
  };

  async function say(text: string) {
    if (!live) return;
    const id = `a${++lineSeq}`;
    h.onStatus('speaking');
    const words = text.split(' ');
    for (let i = 1; i <= words.length; i++) {
      if (!live) return;
      h.onTranscript({ id, role: 'agent', text: words.slice(0, i).join(' '), final: i === words.length });
      await sleep(55);
    }
    await sleep(250);
    if (live) h.onStatus('listening');
  }

  async function tool<T = any>(name: string, args: unknown = {}): Promise<T> {
    h.onStatus('thinking');
    return (await h.onToolCall(name, args)) as T;
  }

  /** Saving so far vs the confirmed booking, from local state. */
  function currentChange() {
    const { booking, original } = getState();
    if (!booking || !original) return 0;
    return booking.total_price - original.total_price;
  }
  const savingPhrase = (n: number) => (n <= 0 ? `saves ${euros(n)}` : `costs ${euros(n)} more`);

  async function respond(raw: string) {
    const text = raw.toLowerCase();
    const yes = /^(yes|yeah|yep|sure|ok|okay|please|go ahead|do it|correct)\b/.test(text.trim());
    const seatMatch = text.match(/\b(\d{1,2})\s?([a-f])\b/i);
    const flightMatch = text.match(/\b(?:ns\s?)?(1\d{3})\b/i);

    if (yes && pending) {
      const p = pending;
      pending = null;
      if (p.kind === 'changeFlight') return doChangeFlight(p.flight_id);
      if (p.kind === 'review') return doReview();
      if (p.kind === 'confirm') return doConfirm();
    }
    if (/confirm/.test(text) && getState().view === 'review') return doConfirm();
    if (/review|that'?s all|nothing else/.test(text)) return doReview();
    if (/thank/.test(text)) {
      const name = getState().booking?.customer_name ?? '';
      return say(`You're welcome${name ? `, ${name}` : ''}. Have a good flight.`);
    }
    if (/\bbag|luggage|baggage/.test(text)) {
      const remove = /remove|less|drop|no extra/.test(text);
      const before = getState().booking?.baggage_count ?? 1;
      const r = await tool<{ bags: number; baggage_charge_eur: number }>('setBags', { count: before + (remove ? -1 : 1) });
      pending = { kind: 'review' };
      const change = currentChange();
      return say(
        remove
          ? `Done, you're back to ${r.bags} bag${r.bags > 1 ? 's' : ''}. Your change now ${savingPhrase(change)}. Shall I prepare the review?`
          : `I've added the extra bag, bringing the total to ${r.bags}. It costs ${euros(r.baggage_charge_eur)}, so the overall ${change <= 0 ? `saving is now ${euros(change)}` : `extra cost is ${euros(change)}`}. Shall I prepare the review?`,
      );
    }
    if (seatMatch && (getState().view === 'seats' || /seat/.test(text))) {
      return doChangeSeat(`${seatMatch[1]}${seatMatch[2].toUpperCase()}`);
    }
    if (/window|aisle|exit|legroom|emergency/.test(text)) {
      const type = /window/.test(text) ? 'window' : /aisle/.test(text) ? 'aisle' : 'emergency_row';
      const r = await tool<{ available: { seat: string; price_eur: number }[] }>('showSeats', { seat_type: type });
      const label = type === 'emergency_row' ? 'exit row' : type;
      if (!r.available.length) return say(`I'm sorry, there are no ${label} seats left on this flight. Would you like a different seat type?`);
      const free = r.available.filter((s) => s.price_eur === 0);
      const pick = (free.length >= 2 ? free : r.available).slice(0, 2);
      const price = pick.every((s) => s.price_eur === 0) ? 'both free of charge' : `from ${euros(Math.min(...pick.map((s) => s.price_eur)))}`;
      return say(`Yes. Available ${label} seats include ${pick.map((s) => s.seat).join(' and ')}, ${price}. Which would you prefer?`);
    }
    if (/cheap|lowest|least expensive/.test(text)) {
      const list = await tool<any[]>('searchFlights', { sort: 'cheapest' });
      const best = list.find((f) => !f.is_current && f.available_seats > 0);
      if (!best) return say(`Your current flight is already the cheapest option.`);
      pending = { kind: 'changeFlight', flight_id: best.flight_id };
      return say(
        `The cheapest is ${fmtFlightNo(best.flight_number)} at ${best.departure}, arriving at ${best.arrival}, with a fare ${best.price_delta_eur < 0 ? 'reduction' : 'increase'} of ${euros(best.price_delta_eur)}. Would you like me to move you to it?`,
      );
    }
    if (flightMatch && getState().flights.length) {
      const f = getState().flights.find((x) => x.flight_number.endsWith(flightMatch[1]));
      if (f) return doChangeFlight(f.flight_id);
    }
    if (/flight|later|earlier|depart|leave/.test(text)) {
      const list = await tool<any[]>('searchFlights', { sort: /earl/.test(text) ? 'earliest' : 'later' });
      const opts = list.filter((f) => !f.is_current && f.available_seats > 0).slice(0, 2);
      const day = 'Thursday';
      return say(
        `Yes. You can change your outbound flight on ${day}. Which departure would you like, such as ${opts.map((f) => `${fmtFlightNo(f.flight_number)} at ${f.departure}`).join(' or ')}?`,
      );
    }
    if (/seat/.test(text)) {
      await tool('showSeats', {});
      return say(`Sure. Front rows are 15 euros, exit rows 12 and 13 are 25 euros, and the rest are free. Which seat would you like?`);
    }
    return say(`I can help you change your flight, your seat or your bags. What would you like to do?`);
  }

  async function doChangeFlight(flight_id: number) {
    const r = await tool<any>('changeFlight', { flight_id });
    const delta = currentChange();
    const seatNote =
      r.previous_seat && !r.previous_seat_available
        ? ` Seat ${r.previous_seat} is unavailable on this flight. Which seat would you like?`
        : ' Which seat would you like?';
    return say(`You're now on ${fmtFlightNo(r.booking.flight_number)} at ${r.booking.departure}, ${delta <= 0 ? 'saving' : 'adding'} ${euros(delta)}.${seatNote}`);
  }

  async function doChangeSeat(seat_number: string) {
    try {
      const r = await tool<any>('changeSeat', { seat_number });
      pending = { kind: 'review' };
      const cost = r.surcharge_eur ? `for ${euros(r.surcharge_eur)}` : 'at no extra cost';
      return say(`Seat ${r.seat} is selected ${cost}. Your change currently ${savingPhrase(currentChange())}. Anything else, or shall I prepare the review?`);
    } catch {
      return say(`Sorry, seat ${seat_number} isn't available. Could you pick another one?`);
    }
  }

  async function doReview() {
    const q = await tool<any>('getQuote');
    pending = { kind: 'confirm' };
    return say(
      `The total change is ${q.total_change <= 0 ? 'a saving' : 'an extra cost'} of ${euros(q.total_change)}. Would you like to confirm it?`,
    );
  }

  async function doConfirm() {
    try {
      const r = await tool<any>('confirmBooking');
      const b = getState().booking!;
      return say(
        `Your change is confirmed. You're flying ${fmtFlightNo(b.flight.flight_number)} at ${fmtTime(b.flight.departure_time)} with seat ${b.seat_number} and ${b.baggage_count} checked bag${b.baggage_count > 1 ? 's' : ''}, ${r.total_change_eur <= 0 ? 'saving' : 'paying'} ${euros(r.total_change_eur)}. Your new boarding pass is in the app and in your email.`,
      );
    } catch (e) {
      return say(`I can't confirm yet: ${(e as Error).message.toLowerCase()}.`);
    }
  }

  return {
    async connect() {
      live = true;
      pending = null;
      h.onStatus('connecting');
      await sleep(900);
      enqueue(async () => {
        const b = await tool<any>('getBooking');
        await say(`Hi ${b.customer_name}, I'm Mia. What would you like to change on your trip: a flight, a seat or your bags?`);
      });
    },
    async disconnect() {
      live = false;
      pending = null;
      h.onStatus('ended');
    },
    sendText(text) {
      if (!live) return;
      h.onTranscript({ id: `u${++lineSeq}`, role: 'user', text, final: true });
      enqueue(async () => {
        await sleep(350);
        await respond(text);
      });
    },
    setMuted() {},
    notifyUiAction(a: UiAction) {
      if (!live) return;
      enqueue(async () => {
        switch (a.type) {
          case 'flight_changed':
            pending = null;
            return say(`Got it, you're on ${fmtFlightNo(a.flight_number)} now. Which seat would you like?`);
          case 'seat_changed':
            pending = { kind: 'review' };
            return say(`Seat ${a.seat_number} is yours. Anything else, or shall I prepare the review?`);
          case 'bags_changed':
            pending = { kind: 'review' };
            return say(`You now have ${a.count} checked bag${a.count > 1 ? 's' : ''}.`);
          case 'review_opened':
            pending = { kind: 'confirm' };
            return say(`Here's your review. Shall I confirm it?`);
          case 'confirmed':
            pending = null;
            return say(`Your change is confirmed. Anything else I can help with?`);
        }
      });
    },
  };
}
