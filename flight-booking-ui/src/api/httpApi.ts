import type { BookingApi } from './BookingApi';
import { endpoints, type Route } from './endpoints';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

/** Real backend client (Supabase Edge Function or any REST server). */
export function createHttpApi(baseUrl: string, apiKey?: string): BookingApi {
  const base = baseUrl.replace(/\/$/, '');

  async function call<T>(route: Route): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (route.body !== undefined) headers['Content-Type'] = 'application/json';
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers.apikey = apiKey; // Supabase gateway accepts either
    }
    const res = await fetch(base + route.path, {
      method: route.method,
      headers,
      body: route.body === undefined ? undefined : JSON.stringify(route.body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
      throw new ApiError(String(msg), res.status, data);
    }
    // Accept either a bare payload or a { data: ... } envelope.
    return (data && typeof data === 'object' && 'data' in data ? data.data : data) as T;
  }

  return {
    getBooking: (ref) => call(endpoints.getBooking(ref)),
    searchFlights: (p, ref) => call(endpoints.searchFlights(p, ref)),
    changeFlight: (ref, id) => call(endpoints.changeFlight(ref, id)),
    getSeats: (id) => call(endpoints.getSeats(id)),
    changeSeat: (ref, id) => call(endpoints.changeSeat(ref, id)),
    changeBags: (ref, n) => call(endpoints.changeBags(ref, n)),
    quote: (ref) => call(endpoints.quote(ref)),
    confirm: (ref) => call(endpoints.confirm(ref)),
  };
}
