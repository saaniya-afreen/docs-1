import type { CallStatus, TranscriptLine } from '../state/store';

/**
 * Seam between the UI and whichever voice SDK runs the call.
 *
 * The UI never talks to an SDK directly: it calls these methods and listens
 * through `VoiceHandlers`. To plug in the OneInbox web SDK, implement this
 * interface in `oneInboxAdapter.ts` (skeleton provided) and set
 * VITE_VOICE_PROVIDER=oneinbox.
 */
export interface VoiceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Typed message from the "Type to Sara…" box. */
  sendText(text: string): void;
  setMuted(muted: boolean): void;
  /**
   * The customer changed something by clicking the left panel. Forward it so
   * the agent's context stays in sync (e.g. as a hidden/system message).
   */
  notifyUiAction(action: UiAction): void;
}

export type UiAction =
  | { type: 'flight_changed'; flight_number: string; price_delta: number }
  | { type: 'seat_changed'; seat_number: string; seat_type: string | null; surcharge: number }
  | { type: 'bags_changed'; count: number; charge: number }
  | { type: 'review_opened'; total_change: number }
  | { type: 'confirmed' };

export interface VoiceHandlers {
  onStatus(status: CallStatus): void;
  /** Called for partial and final lines; `id` stays stable while streaming. */
  onTranscript(line: TranscriptLine): void;
  /**
   * Client-side tool call from the agent. Resolve with the JSON result that
   * should be returned to the agent. Names match `tools` in agent/tools.ts.
   */
  onToolCall(name: string, args: unknown): Promise<unknown>;
  onError(error: Error): void;
}

export function describeUiAction(a: UiAction): string {
  switch (a.type) {
    case 'flight_changed':
      return `[UI] Customer selected flight ${a.flight_number} on screen (fare difference ${a.price_delta} EUR).`;
    case 'seat_changed':
      return `[UI] Customer selected seat ${a.seat_number} (${a.seat_type ?? 'seat'}, ${a.surcharge} EUR) on screen.`;
    case 'bags_changed':
      return `[UI] Customer set checked bags to ${a.count} (extra charge ${a.charge} EUR) on screen.`;
    case 'review_opened':
      return `[UI] Customer opened the review screen. Total change ${a.total_change} EUR.`;
    case 'confirmed':
      return `[UI] Customer confirmed the change on screen.`;
  }
}
