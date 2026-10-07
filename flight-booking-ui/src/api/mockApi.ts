import type { Booking, Flight, FlightOption, Quote, Seat, SeatType } from '../types';
import type { BookingApi } from './BookingApi';

// In-browser stand-in for the Supabase backend, seeded to match the PRD demo
// script (SIN → NRT, NS1142 → NS1156, seat 23C → 6A, +1 bag, −€15 overall)
// and the docx test scenarios (sold-out flight, 95% full flight).

const BAG_PRICE = 45;
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const ROWS = 30;
const DATE = '2026-10-08';

interface FlightSeed {
  id: number;
  number: string;
  dep: string;
  arr: string;
  arrDate?: string;
  fare: number;
  occupancy: number; // 0..1
  stops?: number;
  via?: string;
  noWindow?: boolean; // scarce scenario: only aisle/middle left
}

const FLIGHT_SEEDS: FlightSeed[] = [
  { id: 1, number: 'NS1120', dep: '06:50', arr: '08:35', fare: 290, occupancy: 0.55 },
  { id: 2, number: 'NS1134', dep: '09:40', arr: '11:25', fare: 275, occupancy: 1 },
  { id: 3, number: 'NS1146', dep: '11:05', arr: '14:40', fare: 240, occupancy: 0.95, stops: 1, via: 'HKG', noWindow: true },
  { id: 4, number: 'NS1142', dep: '14:05', arr: '15:50', fare: 250, occupancy: 0.6 },
  { id: 5, number: 'NS1150', dep: '17:15', arr: '19:00', fare: 215, occupancy: 0.6 },
  { id: 6, number: 'NS1156', dep: '20:30', arr: '22:15', fare: 190, occupancy: 0.55 },
  { id: 7, number: 'NS1180', dep: '23:00', arr: '00:45', arrDate: '2026-10-09', fare: 230, occupancy: 0.5 },
];

function seatType(row: number, col: string): SeatType {
  if (row === 12 || row === 13) return 'emergency_row';
  if (col === 'A' || col === 'F') return 'window';
  if (col === 'C' || col === 'D') return 'aisle';
  return 'middle';
}

/** Front rows €15, exit rows 12–13 €25, the rest free (matches reference video). */
function seatPrice(row: number): number {
  if (row === 12 || row === 13) return 25;
  if (row <= 5) return 15;
  return 0;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildSeats(f: FlightSeed): Seat[] {
  const rand = rng(f.id * 7919);
  const seats: Seat[] = [];
  let id = f.id * 1000;
  for (let row = 1; row <= ROWS; row++) {
    for (const col of COLUMNS) {
      const type = seatType(row, col);
      let status: Seat['status'] = rand() < f.occupancy ? 'booked' : 'available';
      if (row === ROWS) status = 'blocked'; // galley row, shown hatched
      if (f.noWindow && type === 'window') status = 'booked';
      seats.push({
        seat_id: ++id,
        flight_id: f.id,
        seat_number: `${row}${col}`,
        row_number: row,
        column_letter: col,
        seat_type: type,
        base_price_delta: seatPrice(row),
        status,
      });
    }
  }
  const force = (num: string, status: Seat['status']) => {
    const s = seats.find((x) => x.seat_number === num);
    if (s) s.status = status;
  };
  if (f.number === 'NS1156') {
    force('23C', 'booked'); // "23C is taken on NS1156"
    for (const n of ['6A', '6F', '7A', '9F', '14A', '17F', '20A']) force(n, 'available');
    for (const n of ['6B', '6C', '6D', '6E', '7F', '8A', '8F']) force(n, 'booked');
  }
  if (f.number === 'NS1142') force('23C', 'booked'); // the customer's own seat
  return seats;
}

function toFlight(f: FlightSeed, seats: Seat[]): Flight {
  const total = seats.length;
  return {
    flight_id: f.id,
    flight_number: f.number,
    origin_airport: 'SIN',
    destination_airport: 'NRT',
    departure_time: `${DATE}T${f.dep}:00`,
    arrival_time: `${f.arrDate ?? DATE}T${f.arr}:00`,
    stops: f.stops ?? 0,
    via: f.via ?? null,
    total_seats: total,
    occupied_seats: seats.filter((s) => s.status !== 'available').length,
    base_fare: f.fare,
    aircraft_type: 'Boeing 787-9',
  };
}

const clone = <T,>(v: T): T => structuredClone(v);
const delay = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 350));

class NotFound extends Error {}

export function createMockApi(): BookingApi {
  const seatsByFlight = new Map<number, Seat[]>();
  const flights = new Map<number, Flight>();
  for (const seed of FLIGHT_SEEDS) {
    const seats = buildSeats(seed);
    seatsByFlight.set(seed.id, seats);
    flights.set(seed.id, toFlight(seed, seats));
  }

  const initial: Booking = {
    booking_reference: 'ABC123',
    customer_name: 'Shivam',
    account_number: 'NS7620',
    flight: flights.get(4)!,
    seat_number: '23C',
    seat_type: 'aisle',
    seat_surcharge: 0,
    passenger_count: 1,
    baggage_count: 1,
    baggage_weight_kg: 23,
    included_bags: 1,
    baggage_charge: 0,
    base_price: 250,
    total_price: 250,
    booking_status: 'confirmed',
    return_flight: {
      flight_number: 'NS1147',
      departure_time: '2026-10-11T17:30:00',
      arrival_time: '2026-10-11T23:10:00',
      seat_number: '18A',
    },
  };
  const bookings = new Map<string, Booking>([[initial.booking_reference, initial]]);
  // Snapshot of the last confirmed state, used for the quote diff.
  const confirmed = new Map<string, Booking>([[initial.booking_reference, clone(initial)]]);

  const get = (ref: string) => {
    const b = bookings.get(ref.toUpperCase());
    if (!b) throw new NotFound(`Booking ${ref} not found`);
    return b;
  };
  const refreshFlight = (id: number) => {
    const f = flights.get(id)!;
    f.occupied_seats = seatsByFlight.get(id)!.filter((s) => s.status !== 'available').length;
  };
  const retotal = (b: Booking) => {
    b.baggage_charge = Math.max(0, b.baggage_count - b.included_bags) * BAG_PRICE;
    b.total_price = b.base_price + b.seat_surcharge + b.baggage_charge;
  };
  const releaseSeat = (b: Booking) => {
    if (!b.seat_number) return;
    const s = seatsByFlight.get(b.flight.flight_id)!.find((x) => x.seat_number === b.seat_number);
    if (s) s.status = 'available';
    refreshFlight(b.flight.flight_id);
  };

  return {
    async getBooking(ref) {
      await delay();
      return clone(get(ref));
    },

    async searchFlights(params, ref) {
      await delay();
      const current = ref ? bookings.get(ref.toUpperCase()) : undefined;
      const fare = current?.flight.base_fare ?? 0;
      return [...flights.values()]
        .filter(
          (f) =>
            f.origin_airport === params.origin.toUpperCase() &&
            f.destination_airport === params.destination.toUpperCase() &&
            f.departure_time.startsWith(params.date),
        )
        .map<FlightOption>((f) => ({
          ...clone(f),
          price_delta: current ? f.base_fare - fare : 0,
          available_seats: f.total_seats - f.occupied_seats,
        }));
    },

    async changeFlight(ref, newFlightId) {
      await delay();
      const b = get(ref);
      const f = flights.get(newFlightId);
      if (!f) throw new NotFound(`Flight ${newFlightId} not found`);
      if (f.total_seats - f.occupied_seats <= 0) throw new Error(`${f.flight_number} is fully booked`);
      releaseSeat(b);
      b.flight = clone(f);
      b.base_price = f.base_fare;
      b.seat_number = null;
      b.seat_type = null;
      b.seat_surcharge = 0;
      b.booking_status = 'pending';
      retotal(b);
      return clone(b);
    },

    async getSeats(flightId) {
      await delay();
      const seats = seatsByFlight.get(flightId);
      if (!seats) throw new NotFound(`Flight ${flightId} not found`);
      return clone(seats);
    },

    async changeSeat(ref, newSeatId) {
      await delay();
      const b = get(ref);
      const seats = seatsByFlight.get(b.flight.flight_id)!;
      const seat = seats.find((s) => s.seat_id === newSeatId);
      if (!seat) throw new NotFound(`Seat ${newSeatId} not on ${b.flight.flight_number}`);
      if (seat.status !== 'available') throw new Error(`Seat ${seat.seat_number} is not available`);
      releaseSeat(b);
      seat.status = 'booked';
      refreshFlight(b.flight.flight_id);
      b.seat_number = seat.seat_number;
      b.seat_type = seat.seat_type;
      b.seat_surcharge = seat.base_price_delta;
      b.booking_status = 'pending';
      retotal(b);
      return clone(b);
    },

    async changeBags(ref, count) {
      await delay();
      const b = get(ref);
      b.baggage_count = Math.max(b.included_bags, Math.min(3, count));
      b.booking_status = 'pending';
      retotal(b);
      return clone(b);
    },

    async quote(ref): Promise<Quote> {
      await delay();
      const b = get(ref);
      const o = confirmed.get(b.booking_reference)!;
      const flight_change = b.base_price - o.base_price;
      const seat_change = b.seat_surcharge - o.seat_surcharge;
      const baggage_change = b.baggage_charge - o.baggage_charge;
      return {
        flight_change,
        seat_change,
        baggage_change,
        total_change: flight_change + seat_change + baggage_change,
        currency: 'EUR',
      };
    },

    async confirm(ref) {
      await delay();
      const b = get(ref);
      if (!b.seat_number) throw new Error('Pick a seat before confirming');
      b.booking_status = 'confirmed';
      confirmed.set(b.booking_reference, clone(b));
      return clone(b);
    },
  };
}
