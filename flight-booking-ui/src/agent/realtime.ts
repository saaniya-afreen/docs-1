import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { api } from '../api';
import { getState, setState, type FlightSort, type View } from '../state/store';
import type { Booking, SeatType } from '../types';
import { applyAgentEvent } from './uiEvents';

// Keeps the screen in sync when the voice agent calls the backend APIs itself
// (server-side), so the browser never sees those calls directly.
//
// 1. bookings table (automatic): any change to this booking's row → re-fetch
//    GET /bookings/{ref} and jump to the step that changed (flight → seat map,
//    seat → seat map, bags → bags, confirmed → confirmed screen).
// 2. ui_events table (optional): for things that don't change the database,
//    e.g. "show the flight list" or "highlight window seats". Each API inserts
//    { booking_ref, type, payload }. Missing payload data is fetched here.
//
// Enabled when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const BOOKINGS_TABLE = (import.meta.env.VITE_BOOKINGS_TABLE as string | undefined) || 'bookings';
const EVENTS_TABLE = (import.meta.env.VITE_UI_EVENTS_TABLE as string | undefined) || 'ui_events';

export const realtimeEnabled = !!(url && anonKey);
export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'error';

let channel: RealtimeChannel | null = null;
let statusListener: ((s: RealtimeStatus) => void) | null = null;
let status: RealtimeStatus = realtimeEnabled ? 'connecting' : 'off';

export function getRealtimeStatus() {
  return status;
}
export function onRealtimeStatus(fn: (s: RealtimeStatus) => void) {
  statusListener = fn;
}
function setStatus(s: RealtimeStatus) {
  status = s;
  statusListener?.(s);
}

/** Row shape of the optional ui_events table. */
export interface UiEventRow {
  booking_ref: string;
  type: string;
  payload?: Record<string, unknown> | null;
}

export function startRealtime(bookingRef: string) {
  if (!realtimeEnabled || channel) return;
  const supabase = createClient(url!, anonKey!);
  channel = supabase
    .channel(`booking-${bookingRef}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BOOKINGS_TABLE, filter: `booking_reference=eq.${bookingRef}` },
      () => void syncBookingFromServer(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: EVENTS_TABLE, filter: `booking_ref=eq.${bookingRef}` },
      (msg) => void handleUiEvent(msg.new as UiEventRow),
    )
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') setStatus('live');
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error');
    });
}

// Coalesce bursts of row updates (a flight change may touch several columns).
let syncTimer: number | undefined;
export function syncBookingFromServer() {
  return new Promise<void>((resolve) => {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(async () => {
      try {
        await applyServerBooking(await api.getBooking(currentRef()));
      } catch (e) {
        setState({ error: (e as Error).message });
      }
      resolve();
    }, 150);
  });
}

/** Decide which step to show from what changed between the old and new booking. */
export async function applyServerBooking(next: Booking) {
  const prev = getState().booking;
  if (!prev) return applyAgentEvent({ type: 'booking_loaded', booking: next });

  const flightChanged = prev.flight.flight_id !== next.flight.flight_id;
  const seatChanged = prev.seat_number !== next.seat_number;
  const bagsChanged = prev.baggage_count !== next.baggage_count;
  const confirmed = prev.booking_status !== 'confirmed' && next.booking_status === 'confirmed';

  if (confirmed) return applyAgentEvent({ type: 'booking_confirmed', booking: next });
  if (flightChanged) {
    const seats = await api.getSeats(next.flight.flight_id);
    return applyAgentEvent({ type: 'flight_changed', booking: next, seats });
  }
  if (seatChanged) {
    const seats = await api.getSeats(next.flight.flight_id);
    return applyAgentEvent({ type: 'seat_changed', booking: next, seats });
  }
  if (bagsChanged) return applyAgentEvent({ type: 'bags_changed', booking: next });
  setState({ booking: next }); // nothing visible changed (or the UI made this change itself)
}

export async function handleUiEvent(row: UiEventRow) {
  const p = (row.payload ?? {}) as Record<string, any>;
  try {
    switch (row.type) {
      case 'flights_shown': {
        const b = getState().booking ?? (await api.getBooking(currentRef()));
        const flights =
          p.flights ??
          (await api.searchFlights(
            {
              origin: b.flight.origin_airport,
              destination: b.flight.destination_airport,
              date: b.flight.departure_time.slice(0, 10),
              passengers: b.passenger_count,
            },
            b.booking_reference,
          ));
        return applyAgentEvent({ type: 'flights_shown', flights, sort: p.sort as FlightSort | undefined });
      }
      case 'seats_shown': {
        const b = getState().booking ?? (await api.getBooking(currentRef()));
        const seats = p.seats ?? (await api.getSeats(b.flight.flight_id));
        return applyAgentEvent({ type: 'seats_shown', seats, highlight: (p.seat_type ?? p.highlight ?? null) as SeatType | null });
      }
      case 'quote_ready':
        return applyAgentEvent({ type: 'quote_ready', quote: p.quote ?? (await api.quote(currentRef())) });
      case 'show_view':
        return applyAgentEvent({ type: 'show_view', view: p.view as View });
      default:
        // flight_changed / seat_changed / bags_changed / booking_confirmed / anything else:
        // the booking itself is the source of truth.
        return syncBookingFromServer();
    }
  } catch (e) {
    setState({ error: (e as Error).message });
  }
}

function currentRef() {
  return getState().booking?.booking_reference ?? ((import.meta.env.VITE_BOOKING_REF as string | undefined) || 'ABC123');
}
