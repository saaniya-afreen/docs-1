// Shapes follow the Flight Booking PRD (tables FLIGHTS, SEATS, BOOKINGS and the
// 7 REST endpoints). Adjust here if the backend contract changes.

export type SeatType = 'window' | 'middle' | 'aisle' | 'emergency_row';
export type SeatStatus = 'available' | 'booked' | 'blocked';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Flight {
  flight_id: number;
  flight_number: string; // "NS1142"
  origin_airport: string; // "SIN"
  destination_airport: string; // "NRT"
  departure_time: string; // ISO, local time of origin
  arrival_time: string; // ISO, local time of destination
  stops: number;
  via?: string | null;
  total_seats: number;
  occupied_seats: number;
  base_fare: number; // EUR
  aircraft_type: string;
}

/** Row returned by GET /flights/search. */
export interface FlightOption extends Flight {
  price_delta: number; // vs the customer's current flight, EUR
  available_seats: number;
}

export interface Seat {
  seat_id: number;
  flight_id: number;
  seat_number: string; // "6A"
  row_number: number;
  column_letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  seat_type: SeatType;
  base_price_delta: number;
  status: SeatStatus;
}

export interface Booking {
  booking_reference: string;
  customer_name: string;
  account_number?: string;
  flight: Flight;
  seat_number: string | null;
  seat_type: SeatType | null;
  seat_surcharge: number;
  passenger_count: number;
  baggage_count: number;
  baggage_weight_kg: number; // per bag
  included_bags: number;
  baggage_charge: number;
  base_price: number;
  total_price: number;
  booking_status: BookingStatus;
  return_flight?: { flight_number: string; departure_time: string; arrival_time: string; seat_number: string } | null;
}

/** POST /bookings/{ref}/quote */
export interface Quote {
  flight_change: number;
  seat_change: number;
  baggage_change: number;
  total_change: number;
  currency: 'EUR';
}

export interface SearchParams {
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  passengers?: number;
}
