import type { SearchParams } from '../types';

/**
 * Single place mapping UI operations to HTTP routes. When the backend team
 * finalises paths (e.g. folding flight/seat/bags into one PATCH), change them here.
 */
export interface Route {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
}

const enc = encodeURIComponent;

export const endpoints = {
  getBooking: (ref: string): Route => ({ method: 'GET', path: `/bookings/${enc(ref)}` }),
  searchFlights: (p: SearchParams, ref?: string): Route => {
    const q = new URLSearchParams({ origin: p.origin, destination: p.destination, date: p.date });
    if (p.passengers) q.set('passengers', String(p.passengers));
    if (ref) q.set('booking_ref', ref);
    return { method: 'GET', path: `/flights/search?${q}` };
  },
  changeFlight: (ref: string, newFlightId: number): Route => ({
    method: 'PATCH',
    path: `/bookings/${enc(ref)}/flight`,
    body: { new_flight_id: newFlightId },
  }),
  getSeats: (flightId: number): Route => ({ method: 'GET', path: `/flights/${flightId}/seats` }),
  changeSeat: (ref: string, newSeatId: number): Route => ({
    method: 'PATCH',
    path: `/bookings/${enc(ref)}/seat`,
    body: { new_seat_id: newSeatId },
  }),
  changeBags: (ref: string, baggageCount: number): Route => ({
    method: 'PATCH',
    path: `/bookings/${enc(ref)}/bags`,
    body: { baggage_count: baggageCount },
  }),
  quote: (ref: string): Route => ({ method: 'POST', path: `/bookings/${enc(ref)}/quote`, body: {} }),
  confirm: (ref: string): Route => ({
    method: 'POST',
    path: `/bookings/${enc(ref)}/confirm`,
    body: { confirm: true },
  }),
};

export type EndpointName = keyof typeof endpoints;
