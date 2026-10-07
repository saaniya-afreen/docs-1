import { useSyncExternalStore } from 'react';
import type { ApiLogEntry } from '../api/BookingApi';
import type { Booking, FlightOption, Quote, Seat, SeatType } from '../types';

export type CallStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'ended';
export type View = 'trip' | 'flights' | 'seats' | 'bags' | 'review' | 'confirmed';
export type FlightSort = 'earliest' | 'later' | 'direct' | 'cheapest';

export interface TranscriptLine {
  id: string;
  role: 'agent' | 'user';
  text: string;
  final: boolean;
}

export interface AppState {
  callStatus: CallStatus;
  muted: boolean;
  transcript: TranscriptLine[];

  booking: Booking | null;
  /** Last confirmed booking; the "before" side of every diff on screen. */
  original: Booking | null;
  view: View;
  flights: FlightOption[];
  flightSort: FlightSort;
  seats: Seat[];
  seatHighlight: SeatType | null;
  quote: Quote | null;
  /** Shows the "Updated by Sara" hint after an agent-driven update. */
  agentTouched: boolean;

  busy: boolean;
  error: string | null;
  apiLog: ApiLogEntry[];
  backstageOpen: boolean;
}

const initialState: AppState = {
  callStatus: 'idle',
  muted: false,
  transcript: [],
  booking: null,
  original: null,
  view: 'trip',
  flights: [],
  flightSort: 'later',
  seats: [],
  seatHighlight: null,
  quote: null,
  agentTouched: false,
  busy: false,
  error: null,
  apiLog: [],
  backstageOpen: false,
};

let state: AppState = initialState;
const subs = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  subs.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

/** Upsert by id so streaming (partial) transcripts update the same line. */
export function upsertTranscript(line: TranscriptLine) {
  setState((s) => {
    const i = s.transcript.findIndex((l) => l.id === line.id);
    if (i === -1) return { transcript: [...s.transcript, line] };
    const transcript = s.transcript.slice();
    transcript[i] = line;
    return { transcript };
  });
}

export function logApi(entry: ApiLogEntry) {
  setState((s) => {
    const i = s.apiLog.findIndex((e) => e.id === entry.id);
    if (i === -1) return { apiLog: [...s.apiLog, entry].slice(-100) };
    const apiLog = s.apiLog.slice();
    apiLog[i] = entry;
    return { apiLog };
  });
}
