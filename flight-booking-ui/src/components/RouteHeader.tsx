import { useAppState } from '../state/store';
import { dayOffset, fmtDayShort, fmtFlightNo, fmtTime, city } from '../format';
import { PlaneIcon } from './icons';
import { diff } from './derived';

/** Big "14:05 ——✈—— 15:50" line used on the trip and confirmed screens. */
export function RouteHero() {
  const booking = useAppState((s) => s.booking);
  const original = useAppState((s) => s.original);
  if (!booking) return null;
  const f = booking.flight;
  const d = diff({ booking, original });
  const changed = !!d?.flightChanged;
  const plus = dayOffset(f.departure_time, f.arrival_time);
  return (
    <div className="route-hero">
      <div className="route-end">
        <div className="eyebrow">
          {city(f.origin_airport)} · {f.origin_airport}
        </div>
        <div className={`time-xl ${changed ? 'accent' : ''}`}>{fmtTime(f.departure_time)}</div>
        {changed && original && <div className="was">{fmtTime(original.flight.departure_time)}</div>}
      </div>
      <div className="route-line">
        <span className="dot" />
        <span className="line" />
        <PlaneIcon size={16} className="plane" />
        <span className="line" />
        <span className="dot" />
        <div className="route-caption">
          Outbound · {fmtDayShort(f.departure_time)} · {fmtFlightNo(f.flight_number)} ·{' '}
          {f.stops ? `${f.stops} stop${f.via ? ` via ${f.via}` : ''}` : 'direct'}
        </div>
      </div>
      <div className="route-end end-r">
        <div className="eyebrow">
          {city(f.destination_airport)} · {f.destination_airport}
        </div>
        <div className={`time-xl ${changed ? 'accent' : ''}`}>
          {fmtTime(f.arrival_time)}
          {plus > 0 && <sup>+{plus}</sup>}
        </div>
        {changed && original && <div className="was">{fmtTime(original.flight.arrival_time)}</div>}
      </div>
    </div>
  );
}

/** Compact header shown above the flight/seat/bag/review steps. */
export function RouteCompact() {
  const booking = useAppState((s) => s.booking);
  const original = useAppState((s) => s.original);
  if (!booking) return null;
  const f = booking.flight;
  const d = diff({ booking, original });
  const changed = !!d?.flightChanged;
  const bags = `${booking.baggage_count} × ${booking.baggage_weight_kg} kg`;
  const caption = [
    `${fmtFlightNo(f.flight_number)}${changed && original ? ` (was ${fmtFlightNo(original.flight.flight_number)})` : ''}`,
    f.stops ? `${f.stops} stop` : 'direct',
    booking.seat_number ? `seat ${booking.seat_number}` : 'no seat yet',
    bags,
  ].join(' · ');
  return (
    <div className="route-compact">
      <div className="rc-end">
        <div className="eyebrow">{f.origin_airport}</div>
        <div className="rc-time">
          <span className={changed ? 'accent' : ''}>{fmtTime(f.departure_time)}</span>
          {changed && original && <s>{fmtTime(original.flight.departure_time)}</s>}
        </div>
      </div>
      <div className="rc-mid">
        <div className="rc-line">
          <span className="dot" />
          <span className="line" />
          <PlaneIcon size={14} className="plane" />
          <span className="line" />
          <span className="dot" />
        </div>
        <div className="rc-caption">{caption}</div>
      </div>
      <div className="rc-end end-r">
        <div className="eyebrow">{f.destination_airport}</div>
        <div className="rc-time">
          <span className={changed ? 'accent' : ''}>{fmtTime(f.arrival_time)}</span>
          {changed && original && <s>{fmtTime(original.flight.arrival_time)}</s>}
        </div>
      </div>
    </div>
  );
}
