import { api } from '../api';
import { getState, setState, type FlightSort, type View } from '../state/store';
import type { Booking, FlightOption, Seat, SeatType } from '../types';
import { fmtTime } from '../format';

// Every booking action the UI can perform. The voice agent (via the SDK's
// client-side tool calls) and on-screen clicks both go through these, so the
// left panel always reflects the same state the agent is talking about.
// Each tool returns a compact JSON-able result for the agent to speak from.

export type Source = 'agent' | 'user';

const DEFAULT_REF = (import.meta.env.VITE_BOOKING_REF as string | undefined) || 'ABC123';

function ref() {
  return getState().booking?.booking_reference ?? DEFAULT_REF;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  setState({ busy: true, error: null });
  try {
    return await fn();
  } catch (e) {
    setState({ error: (e as Error).message });
    throw e;
  } finally {
    setState({ busy: false });
  }
}

function touched(source: Source) {
  return source === 'agent' ? { agentTouched: true } : {};
}

export function sortFlights(list: FlightOption[], sort: FlightSort): FlightOption[] {
  const byDep = (a: FlightOption, b: FlightOption) => a.departure_time.localeCompare(b.departure_time);
  const out = list.slice();
  switch (sort) {
    case 'earliest':
      return out.sort(byDep);
    case 'later': {
      const cur = getState().booking?.flight.departure_time ?? '';
      // Later than current first (chronological), then earlier ones.
      return out.sort((a, b) => {
        const la = a.departure_time >= cur ? 0 : 1;
        const lb = b.departure_time >= cur ? 0 : 1;
        return la - lb || byDep(a, b);
      });
    }
    case 'direct':
      return out.sort((a, b) => a.stops - b.stops || byDep(a, b));
    case 'cheapest':
      return out.sort((a, b) => a.price_delta - b.price_delta || byDep(a, b));
  }
}

const summarizeBooking = (b: Booking) => ({
  booking_reference: b.booking_reference,
  customer_name: b.customer_name,
  flight_number: b.flight.flight_number,
  flight_id: b.flight.flight_id,
  route: `${b.flight.origin_airport}-${b.flight.destination_airport}`,
  departure: fmtTime(b.flight.departure_time),
  arrival: fmtTime(b.flight.arrival_time),
  seat: b.seat_number,
  seat_type: b.seat_type,
  bags: b.baggage_count,
  total_price_eur: b.total_price,
  status: b.booking_status,
});

export const tools = {
  /** Scene 1 — GET /bookings/{ref} */
  async getBooking(args: { booking_reference?: string } = {}, source: Source = 'agent') {
    return run(async () => {
      const b = await api.getBooking(args.booking_reference ?? ref());
      setState({ booking: b, original: b.booking_status === 'confirmed' ? b : getState().original ?? b, view: 'trip', ...touched(source) });
      return summarizeBooking(b);
    });
  },

  /** Scene 2 — GET /flights/search */
  async searchFlights(args: { sort?: FlightSort; date?: string } = {}, source: Source = 'agent') {
    return run(async () => {
      const b = getState().booking ?? (await api.getBooking(ref()));
      const list = await api.searchFlights(
        {
          origin: b.flight.origin_airport,
          destination: b.flight.destination_airport,
          date: args.date ?? b.flight.departure_time.slice(0, 10),
          passengers: b.passenger_count,
        },
        b.booking_reference,
      );
      const sort = args.sort ?? getState().flightSort;
      const flights = sortFlights(list, sort);
      setState({ booking: b, flights, flightSort: sort, view: 'flights', ...touched(source) });
      return flights.map((f) => ({
        flight_id: f.flight_id,
        flight_number: f.flight_number,
        departure: fmtTime(f.departure_time),
        arrival: fmtTime(f.arrival_time),
        stops: f.stops,
        price_delta_eur: f.price_delta,
        available_seats: f.available_seats,
        is_current: f.flight_id === b.flight.flight_id,
      }));
    });
  },

  /** Scene 3 — PATCH /bookings/{ref}/flight, then GET /flights/{id}/seats */
  async changeFlight(args: { flight_id?: number; flight_number?: string }, source: Source = 'agent') {
    return run(async () => {
      let id = args.flight_id;
      if (id == null && args.flight_number) {
        const want = args.flight_number.replace(/\s/g, '').toUpperCase();
        id = getState().flights.find((f) => f.flight_number === want)?.flight_id;
      }
      if (id == null) throw new Error(`Unknown flight ${args.flight_number ?? ''}`);
      const prevSeat = getState().booking?.seat_number ?? null;
      const b = await api.changeFlight(ref(), id);
      const seats = await api.getSeats(b.flight.flight_id);
      setState({ booking: b, seats, seatHighlight: null, quote: null, view: 'seats', ...touched(source) });
      const old = prevSeat ? seats.find((s) => s.seat_number === prevSeat) : undefined;
      return {
        booking: summarizeBooking(b),
        previous_seat: prevSeat,
        previous_seat_available: old ? old.status === 'available' : false,
        available_by_type: countByType(seats),
      };
    });
  },

  /** Scene 3/4 — GET /flights/{id}/seats; optional highlight e.g. "window" */
  async showSeats(args: { seat_type?: SeatType | null } = {}, source: Source = 'agent') {
    return run(async () => {
      const b = getState().booking ?? (await api.getBooking(ref()));
      const seats = await api.getSeats(b.flight.flight_id);
      setState({ booking: b, seats, seatHighlight: args.seat_type ?? null, view: 'seats', ...touched(source) });
      const avail = seats.filter((s) => s.status === 'available' && (!args.seat_type || s.seat_type === args.seat_type));
      return {
        flight_number: b.flight.flight_number,
        available: avail.slice(0, 12).map((s) => ({ seat: s.seat_number, type: s.seat_type, price_eur: s.base_price_delta })),
        total_available: avail.length,
      };
    });
  },

  /** Scene 4 — PATCH /bookings/{ref}/seat */
  async changeSeat(args: { seat_id?: number; seat_number?: string }, source: Source = 'agent') {
    return run(async () => {
      let seats = getState().seats;
      const b0 = getState().booking;
      if (!seats.length || seats[0].flight_id !== b0?.flight.flight_id) {
        seats = await api.getSeats(b0?.flight.flight_id ?? 0);
      }
      const seat: Seat | undefined =
        args.seat_id != null
          ? seats.find((s) => s.seat_id === args.seat_id)
          : seats.find((s) => s.seat_number === args.seat_number?.replace(/\s/g, '').toUpperCase());
      if (!seat) throw new Error(`Seat ${args.seat_number ?? args.seat_id} not found`);
      const b = await api.changeSeat(ref(), seat.seat_id);
      const fresh = await api.getSeats(b.flight.flight_id);
      setState({ booking: b, seats: fresh, view: 'seats', ...touched(source) });
      return { seat: b.seat_number, seat_type: b.seat_type, surcharge_eur: b.seat_surcharge, booking: summarizeBooking(b) };
    });
  },

  /** Scene 5 — baggage (see README: PATCH /bookings/{ref}/bags) */
  async setBags(args: { count?: number; add?: number }, source: Source = 'agent') {
    return run(async () => {
      const cur = getState().booking ?? (await api.getBooking(ref()));
      const count = args.count ?? cur.baggage_count + (args.add ?? 1);
      const b = await api.changeBags(ref(), count);
      setState({ booking: b, view: 'bags', ...touched(source) });
      return { bags: b.baggage_count, baggage_charge_eur: b.baggage_charge, booking: summarizeBooking(b) };
    });
  },

  /** Scene 5 — POST /bookings/{ref}/quote */
  async getQuote(_args: Record<string, never> = {}, source: Source = 'agent') {
    return run(async () => {
      const q = await api.quote(ref());
      setState({ quote: q, view: 'review', ...touched(source) });
      return q;
    });
  },

  /** Scene 6 — POST /bookings/{ref}/confirm */
  async confirmBooking(_args: Record<string, never> = {}, source: Source = 'agent') {
    return run(async () => {
      const q = getState().quote ?? (await api.quote(ref()));
      const b = await api.confirm(ref());
      // Keep `original` until the confirmed screen is left so it can show the diff.
      setState({ booking: b, quote: q, view: 'confirmed', ...touched(source) });
      return { status: b.booking_status, booking: summarizeBooking(b), total_change_eur: q.total_change };
    });
  },

  /** Pure navigation, no API call. */
  async showView(args: { view: View }) {
    setState({ view: args.view });
    return { view: args.view };
  },
};

export type ToolName = keyof typeof tools;

/** Entry point for SDK tool-call events: name + JSON args → result. */
export async function invokeTool(name: string, args: unknown): Promise<unknown> {
  const fn = (tools as Record<string, (a: unknown, s: Source) => Promise<unknown>>)[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(args ?? {}, 'agent');
}

function countByType(seats: Seat[]) {
  const out: Record<string, number> = {};
  for (const s of seats) if (s.status === 'available') out[s.seat_type] = (out[s.seat_type] ?? 0) + 1;
  return out;
}
