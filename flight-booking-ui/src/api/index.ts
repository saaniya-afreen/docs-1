import type { ApiLogEntry, BookingApi } from './BookingApi';
import { endpoints } from './endpoints';
import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';

const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiKey = import.meta.env.VITE_API_KEY as string | undefined;

export const usingMockApi = !baseUrl;

type Listener = (entry: ApiLogEntry) => void;
const listeners = new Set<Listener>();
export function onApiLog(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let seq = 0;
/** Wraps every call so the dev panel can show the HTTP traffic. */
function withLogging(api: BookingApi): BookingApi {
  const wrapped = {} as BookingApi;
  for (const name of Object.keys(api) as (keyof BookingApi)[]) {
    wrapped[name] = (async (...args: unknown[]) => {
      const route = (endpoints[name] as (...a: unknown[]) => { method: string; path: string; body?: unknown })(...args);
      const entry: ApiLogEntry = { id: ++seq, at: Date.now(), method: route.method, path: route.path, body: route.body, status: 'pending' };
      listeners.forEach((l) => l(entry));
      const t0 = performance.now();
      try {
        const res = await (api[name] as (...a: unknown[]) => Promise<unknown>)(...args);
        listeners.forEach((l) => l({ ...entry, status: 'ok', ms: Math.round(performance.now() - t0), response: res }));
        return res;
      } catch (e) {
        listeners.forEach((l) =>
          l({ ...entry, status: 'error', ms: Math.round(performance.now() - t0), error: (e as Error).message }),
        );
        throw e;
      }
    }) as never;
  }
  return wrapped;
}

export const api: BookingApi = withLogging(baseUrl ? createHttpApi(baseUrl, apiKey) : createMockApi());
export type { ApiLogEntry, BookingApi };
