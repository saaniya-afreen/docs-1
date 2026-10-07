import type { Booking, FlightOption, Quote, SearchParams, Seat } from '../types';

/**
 * The backend contract the UI depends on. One method per PRD endpoint
 * (plus bags, which the PRD folds into quote). Both the mock and the HTTP
 * client implement this, so swapping to the real Supabase API is a config change.
 */
export interface BookingApi {
  /** 1. GET /bookings/{ref} */
  getBooking(ref: string): Promise<Booking>;
  /** 2. GET /flights/search */
  searchFlights(params: SearchParams, ref?: string): Promise<FlightOption[]>;
  /** 3. PATCH /bookings/{ref}/flight */
  changeFlight(ref: string, newFlightId: number): Promise<Booking>;
  /** 4. GET /flights/{id}/seats */
  getSeats(flightId: number): Promise<Seat[]>;
  /** 5. PATCH /bookings/{ref}/seat */
  changeSeat(ref: string, newSeatId: number): Promise<Booking>;
  /** PATCH /bookings/{ref}/bags — not in the 7-endpoint list; see README. */
  changeBags(ref: string, baggageCount: number): Promise<Booking>;
  /** 6. POST /bookings/{ref}/quote */
  quote(ref: string): Promise<Quote>;
  /** 7. POST /bookings/{ref}/confirm */
  confirm(ref: string): Promise<Booking>;
}

export interface ApiLogEntry {
  id: number;
  at: number;
  method: string;
  path: string;
  body?: unknown;
  status: 'pending' | 'ok' | 'error';
  ms?: number;
  response?: unknown;
  error?: string;
}
