import type { AppState } from '../state/store';

/** Differences between the working booking and the last confirmed one. */
export function diff(s: Pick<AppState, 'booking' | 'original'>) {
  const b = s.booking;
  const o = s.original;
  if (!b || !o) return null;
  const flightChanged = b.flight.flight_id !== o.flight.flight_id;
  const seatChanged = b.seat_number !== o.seat_number || flightChanged;
  const bagsChanged = b.baggage_count !== o.baggage_count;
  return {
    flightChanged,
    seatChanged,
    bagsChanged,
    any: flightChanged || seatChanged || bagsChanged,
    flightDelta: b.base_price - o.base_price,
    seatDelta: b.seat_surcharge - o.seat_surcharge,
    bagsDelta: b.baggage_charge - o.baggage_charge,
    total: b.total_price - o.total_price,
  };
}

export function hasPendingChanges(s: Pick<AppState, 'booking' | 'original'>) {
  const d = diff(s);
  return !!d && d.any && s.booking?.booking_status !== 'confirmed';
}
