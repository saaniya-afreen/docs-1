import { useState } from 'react';
import { tools, sortFlights } from '../agent/tools';
import { notifyUi } from '../voice/session';
import { getState, setState, useAppState, type FlightSort } from '../state/store';
import { airportName, city, dayOffset, fmtDayLong, fmtDayShort, fmtDelta, fmtEur, fmtFlightNo, fmtTime, seatTypeLabel } from '../format';
import type { FlightOption } from '../types';
import { ArrowRight, BagIcon } from './icons';
import { RouteHero } from './RouteHeader';
import { SeatMap } from './SeatMap';
import { diff } from './derived';

const BAG_PRICE = 45;
const MAX_BAGS = 3;

const swallow = () => {}; // errors already land in state.error

/* ------------------------------------------------------------------ Trip */

export function TripView() {
  const b = useAppState((s) => s.booking);
  if (!b) return <TripSkeleton />;
  const f = b.flight;
  return (
    <section className="view view-trip">
      <h1 className="city-xl">{city(f.destination_airport)}</h1>
      <p className="sub">
        {city(f.origin_airport)} to {airportName(f.destination_airport)} · {fmtDayLong(f.departure_time)}
        {b.return_flight ? ` – ${fmtDayLong(b.return_flight.departure_time)} · return` : ' · one way'}
      </p>
      <RouteHero />
      <div className="facts">
        <div className="fact">
          <div className="eyebrow">Flight</div>
          <div className="fact-value">{fmtFlightNo(f.flight_number)}</div>
          <div className="fact-sub">
            {f.stops ? `${f.stops} stop` : 'Direct'} · {fmtTime(f.departure_time)} → {fmtTime(f.arrival_time)}
          </div>
          <button className="link" onClick={() => tools.searchFlights({}, 'user').catch(swallow)}>
            Change flight <ArrowRight size={12} />
          </button>
        </div>
        <div className="fact">
          <div className="eyebrow">Seat</div>
          <div className="fact-value">{b.seat_number ?? '—'}</div>
          <div className="fact-sub">
            {b.seat_number ? `${seatTypeLabel(b.seat_type)}, row ${parseInt(b.seat_number, 10)}` : 'No seat selected yet'}
          </div>
          <button className="link" onClick={() => tools.showSeats({}, 'user').catch(swallow)}>
            Change seat <ArrowRight size={12} />
          </button>
        </div>
        <div className="fact">
          <div className="eyebrow">Checked bags</div>
          <div className="fact-value">
            {b.baggage_count} × {b.baggage_weight_kg} kg
          </div>
          <div className="fact-sub">
            {b.included_bags} included{b.baggage_count > b.included_bags ? ` · +${fmtEur(b.baggage_charge)}` : ''}
          </div>
          <button className="link" onClick={() => setState({ view: 'bags' })}>
            Change bags <ArrowRight size={12} />
          </button>
        </div>
      </div>
      {b.return_flight && (
        <div className="return-row">
          <span className="eyebrow">Return · {fmtDayShort(b.return_flight.departure_time)}</span>
          <span className="rr-time">
            {f.destination_airport} {fmtTime(b.return_flight.departure_time)}
          </span>
          <span className="rr-line" />
          <span className="rr-time">
            {f.origin_airport} {fmtTime(b.return_flight.arrival_time)}
          </span>
          <span className="rr-meta">
            {fmtFlightNo(b.return_flight.flight_number)} · seat {b.return_flight.seat_number}
          </span>
        </div>
      )}
    </section>
  );
}

function TripSkeleton() {
  return (
    <section className="view view-trip">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-line" />
      <div className="skeleton sk-hero" />
      <div className="skeleton sk-facts" />
    </section>
  );
}

/* --------------------------------------------------------------- Flights */

const SORTS: { id: FlightSort; label: string }[] = [
  { id: 'earliest', label: 'Earliest' },
  { id: 'later', label: 'Later' },
  { id: 'direct', label: 'Direct' },
  { id: 'cheapest', label: 'Cheapest' },
];

export function FlightsView() {
  const flights = useAppState((s) => s.flights);
  const sort = useAppState((s) => s.flightSort);
  const booking = useAppState((s) => s.booking);
  const busy = useAppState((s) => s.busy);
  const [open, setOpen] = useState<number | null>(null);

  const setSort = (id: FlightSort) => setState({ flightSort: id, flights: sortFlights(getState().flights, id) });

  const pick = async (f: FlightOption) => {
    if (f.flight_id === booking?.flight.flight_id || f.available_seats <= 0 || busy) return;
    await tools.changeFlight({ flight_id: f.flight_id }, 'user').catch(swallow);
    notifyUi({ type: 'flight_changed', flight_number: f.flight_number, price_delta: f.price_delta });
  };

  return (
    <section className="view">
      <h2 className="title-l">Pick a new flight</h2>
      <div className="chips" role="tablist" aria-label="Sort flights">
        {SORTS.map((s) => (
          <button key={s.id} role="tab" aria-selected={sort === s.id} className={`chip ${sort === s.id ? 'on' : ''}`} onClick={() => setSort(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <ul className="flight-list">
        {flights.map((f) => {
          const current = f.flight_id === booking?.flight.flight_id;
          const soldOut = f.available_seats <= 0;
          const few = !soldOut && f.available_seats <= Math.ceil(f.total_seats * 0.06);
          const plus = dayOffset(f.departure_time, f.arrival_time);
          return (
            <li key={f.flight_id} className={`flight-row ${current ? 'current' : ''} ${soldOut ? 'sold' : ''}`}>
              <button className="fr-main" disabled={current || soldOut} onClick={() => pick(f)}>
                <span className="fr-times">
                  {fmtTime(f.departure_time)} <ArrowRight size={16} /> {fmtTime(f.arrival_time)}
                  {plus > 0 && <sup>+{plus}</sup>}
                </span>
                <span className="fr-meta">
                  {fmtFlightNo(f.flight_number)} · {f.stops ? `${f.stops} stop${f.via ? ` via ${f.via}` : ''}` : 'direct'}
                  {current && <span className="tag">Your flight</span>}
                  {few && <span className="tag warn">{f.available_seats} seats left</span>}
                </span>
              </button>
              <div className="fr-side">
                <span className={`fr-delta ${f.price_delta < 0 ? 'save' : ''}`}>
                  {soldOut ? 'Sold out' : current || f.price_delta === 0 ? 'Same fare' : fmtDelta(f.price_delta)}
                </span>
                {!current && (
                  <button className="link small" onClick={() => setOpen(open === f.flight_id ? null : f.flight_id)}>
                    {open === f.flight_id ? 'Hide' : 'Compare'}
                  </button>
                )}
              </div>
              {open === f.flight_id && booking && (
                <div className="compare">
                  <div>
                    <span className="eyebrow">Departs</span>
                    {fmtTime(f.departure_time)} <s>{fmtTime(booking.flight.departure_time)}</s>
                  </div>
                  <div>
                    <span className="eyebrow">Arrives</span>
                    {fmtTime(f.arrival_time)} <s>{fmtTime(booking.flight.arrival_time)}</s>
                  </div>
                  <div>
                    <span className="eyebrow">Fare</span>
                    {fmtEur(f.base_fare)} <s>{fmtEur(booking.flight.base_fare)}</s>
                  </div>
                  <div>
                    <span className="eyebrow">Seats left</span>
                    {f.available_seats}
                  </div>
                  <div>
                    <span className="eyebrow">Aircraft</span>
                    {f.aircraft_type}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {!flights.length && <li className="empty">Searching flights…</li>}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- Seats */

export function SeatsView() {
  const b = useAppState((s) => s.booking);
  const original = useAppState((s) => s.original);
  const seats = useAppState((s) => s.seats);
  const highlight = useAppState((s) => s.seatHighlight);
  if (!b) return null;

  const oldSeat = original?.seat_number;
  const oldTaken = oldSeat && b.flight.flight_id !== original?.flight.flight_id
    ? seats.find((s) => s.seat_number === oldSeat)?.status !== 'available'
    : false;
  const pricing = 'Front rows €15, exit rows 12–13 €25, the rest free.';
  const note = b.seat_number
    ? `${b.seat_surcharge ? `${fmtEur(b.seat_surcharge)} seat charge.` : 'No charge.'} Tap another seat to move. ${pricing}`
    : `${oldTaken ? `${oldSeat} is taken on ${fmtFlightNo(b.flight.flight_number)}. ` : ''}${
        highlight ? `${seatTypeLabel(highlight)} seats that match are highlighted. ` : ''
      }${pricing}`;

  return (
    <section className="view">
      <h2 className="title-l">
        {b.seat_number ? (
          <>
            Seat <span className="accent">{b.seat_number}</span>
          </>
        ) : (
          'Pick a seat'
        )}
      </h2>
      <p className="note">{note}</p>
      {seats.length ? <SeatMap /> : <div className="skeleton sk-map" />}
    </section>
  );
}

/* ------------------------------------------------------------------ Bags */

export function BagsView() {
  const b = useAppState((s) => s.booking);
  const original = useAppState((s) => s.original);
  const busy = useAppState((s) => s.busy);
  if (!b) return null;
  const changed = original && original.baggage_count !== b.baggage_count;

  const set = async (count: number) => {
    const r = await tools.setBags({ count }, 'user').catch(() => null);
    if (r) notifyUi({ type: 'bags_changed', count: r.bags, charge: r.baggage_charge_eur });
  };

  return (
    <section className="view">
      <h2 className="title-l">
        {b.baggage_count} × {b.baggage_weight_kg} kg
        {changed && original && (
          <s className="was-inline">
            {original.baggage_count} × {original.baggage_weight_kg} kg
          </s>
        )}
      </h2>
      <p className="note">
        Checked bags, {b.baggage_weight_kg} kg each, up to {MAX_BAGS}. Extra bags {fmtEur(BAG_PRICE)} each.
      </p>
      <ul className="bag-list">
        {Array.from({ length: b.baggage_count }, (_, i) => (
          <li key={i}>
            <BagIcon /> Bag {i + 1}
            <span className={i < b.included_bags ? 'muted' : 'accent'}>{i < b.included_bags ? 'Included' : `+${fmtEur(BAG_PRICE)}`}</span>
          </li>
        ))}
      </ul>
      <div className="bag-total">
        <span>Bags</span>
        <span className="num-l">{b.baggage_charge ? `+${fmtEur(b.baggage_charge)}` : '€0'}</span>
      </div>
      <div className="btn-row">
        <button className="btn ghost" disabled={busy || b.baggage_count <= b.included_bags} onClick={() => set(b.baggage_count - 1)}>
          Remove a bag
        </button>
        <button className="btn primary" disabled={busy || b.baggage_count >= MAX_BAGS} onClick={() => set(b.baggage_count + 1)}>
          Add a bag
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Review */

function ChangeTable() {
  const b = useAppState((s) => s.booking);
  const o = useAppState((s) => s.original);
  const quote = useAppState((s) => s.quote);
  if (!b || !o) return null;
  const d = diff({ booking: b, original: o })!;
  const rows = [
    {
      k: 'Flight',
      was: d.flightChanged ? `${fmtFlightNo(o.flight.flight_number)} ${fmtTime(o.flight.departure_time)}` : null,
      now: `${fmtFlightNo(b.flight.flight_number)} ${fmtTime(b.flight.departure_time)}`,
      delta: quote?.flight_change ?? d.flightDelta,
    },
    {
      k: 'Seat',
      was: d.seatChanged ? o.seat_number : null,
      now: b.seat_number ?? 'Not selected',
      delta: quote?.seat_change ?? d.seatDelta,
    },
    {
      k: 'Bags',
      was: d.bagsChanged ? `${o.baggage_count} × ${o.baggage_weight_kg} kg` : null,
      now: `${b.baggage_count} × ${b.baggage_weight_kg} kg`,
      delta: quote?.baggage_change ?? d.bagsDelta,
    },
  ];
  return (
    <table className="change-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.k}>
            <th className="eyebrow">{r.k}</th>
            <td>
              {r.was && <s>{r.was}</s>} <span className={r.was ? 'accent' : ''}>{r.now}</span>
            </td>
            <td className="num">{fmtDelta(r.delta)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalLine({ confirmed }: { confirmed?: boolean }) {
  const b = useAppState((s) => s.booking);
  const o = useAppState((s) => s.original);
  const quote = useAppState((s) => s.quote);
  if (!b || !o) return null;
  const total = quote?.total_change ?? b.total_price - o.total_price;
  const label = total < 0 ? 'Refund' : total > 0 ? 'To pay' : 'No price change';
  return (
    <div className="total-line">
      <div>
        <div className="total-label">{label}</div>
        <div className="muted small">
          {confirmed ? 'Your new boarding pass is in the app and by email.' : 'Nothing changes until you confirm.'}
        </div>
      </div>
      <div className="num-xl">{fmtEur(total)}</div>
    </div>
  );
}

export function ReviewView() {
  const busy = useAppState((s) => s.busy);
  const b = useAppState((s) => s.booking);
  const confirm = async () => {
    const r = await tools.confirmBooking({}, 'user').catch(() => null);
    if (r) notifyUi({ type: 'confirmed' });
  };
  return (
    <section className="view">
      <h2 className="title-l">Review your changes</h2>
      <ChangeTable />
      <TotalLine />
      {!b?.seat_number && <p className="note warn-text">Pick a seat before confirming.</p>}
      <button className="btn primary wide" disabled={busy || !b?.seat_number} onClick={confirm}>
        Confirm the change
      </button>
    </section>
  );
}

/* ------------------------------------------------------------- Confirmed */

export function ConfirmedView() {
  const b = useAppState((s) => s.booking);
  if (!b) return null;
  return (
    <section className="view view-trip view-confirmed">
      <h1 className="city-xl">{city(b.flight.destination_airport)}</h1>
      <p className="sub">
        {city(b.flight.origin_airport)} to {airportName(b.flight.destination_airport)} · {fmtDayLong(b.flight.departure_time)}
      </p>
      <RouteHero />
      <h2 className="title-m">Change confirmed</h2>
      <ChangeTable />
      <TotalLine confirmed />
    </section>
  );
}
