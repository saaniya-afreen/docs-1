import { getState, setState, type FlightSort, type View } from '../state/store';
import type { Booking, FlightOption, Quote, Seat, SeatType } from '../types';
import { sortFlights } from './tools';

/**
 * Use this path if the voice agent calls the backend APIs itself (server-side
 * tools) instead of asking the browser to run them. Whatever transport carries
 * the agent's results to the page — an SDK custom event, Supabase Realtime on a
 * `ui_events` table, a websocket — feed each message into `applyAgentEvent`.
 */
export type AgentEvent =
  | { type: 'booking_loaded'; booking: Booking }
  | { type: 'flights_shown'; flights: FlightOption[]; sort?: FlightSort }
  | { type: 'flight_changed'; booking: Booking; seats?: Seat[] }
  | { type: 'seats_shown'; seats: Seat[]; highlight?: SeatType | null }
  | { type: 'seat_changed'; booking: Booking; seats?: Seat[] }
  | { type: 'bags_changed'; booking: Booking }
  | { type: 'quote_ready'; quote: Quote }
  | { type: 'booking_confirmed'; booking: Booking; quote?: Quote }
  | { type: 'show_view'; view: View };

export function applyAgentEvent(e: AgentEvent) {
  const t = { agentTouched: true };
  switch (e.type) {
    case 'booking_loaded':
      return setState({ booking: e.booking, original: getState().original ?? e.booking, view: 'trip' });
    case 'flights_shown': {
      const sort = e.sort ?? getState().flightSort;
      return setState({ flights: sortFlights(e.flights, sort), flightSort: sort, view: 'flights', ...t });
    }
    case 'flight_changed':
      return setState({ booking: e.booking, seats: e.seats ?? [], seatHighlight: null, quote: null, view: 'seats', ...t });
    case 'seats_shown':
      return setState({ seats: e.seats, seatHighlight: e.highlight ?? null, view: 'seats', ...t });
    case 'seat_changed':
      return setState((s) => ({ booking: e.booking, seats: e.seats ?? markSeat(s.seats, e.booking), view: 'seats', ...t }));
    case 'bags_changed':
      return setState({ booking: e.booking, view: 'bags', ...t });
    case 'quote_ready':
      return setState({ quote: e.quote, view: 'review', ...t });
    case 'booking_confirmed':
      return setState((s) => ({ booking: e.booking, quote: e.quote ?? s.quote, view: 'confirmed', ...t }));
    case 'show_view':
      return setState({ view: e.view });
  }
}

/** Without a fresh seat list, at least mark the newly taken seat. */
function markSeat(seats: Seat[], b: Booking): Seat[] {
  return seats.map((s) => (s.seat_number === b.seat_number ? { ...s, status: 'booked' } : s));
}
