import { invokeTool } from '../agent/tools';
import { getState, setState, upsertTranscript } from '../state/store';
import { createMockAdapter, DEMO_SCRIPT } from './mockAdapter';
import { createOneInboxAdapter } from './oneInboxAdapter';
import type { UiAction, VoiceAdapter, VoiceHandlers } from './VoiceAdapter';

const provider = (import.meta.env.VITE_VOICE_PROVIDER as string | undefined) ?? 'mock';
export const usingMockVoice = provider !== 'oneinbox';

const handlers: VoiceHandlers = {
  onStatus: (callStatus) => setState({ callStatus }),
  onTranscript: upsertTranscript,
  onToolCall: (name, args) => invokeTool(name, args),
  onError: (e) => setState({ error: e.message }),
};

const adapter: VoiceAdapter = usingMockVoice ? createMockAdapter(handlers) : createOneInboxAdapter(handlers);

let demoTimer: number | undefined;

export async function startCall() {
  if (getState().callStatus !== 'idle' && getState().callStatus !== 'ended') return;
  // Keep the loaded booking on screen; clear only the conversation-scoped bits.
  setState({ transcript: [], view: 'trip', quote: null, seatHighlight: null, agentTouched: false, error: null });
  await adapter.connect();
}

export async function endCall() {
  stopDemo();
  await adapter.disconnect();
}

export function sendText(text: string) {
  const t = text.trim();
  if (t) adapter.sendText(t);
}

export function toggleMute() {
  const muted = !getState().muted;
  setState({ muted });
  adapter.setMuted(muted);
}

export function notifyUi(action: UiAction) {
  adapter.notifyUiAction(action);
}

/** Mock only: plays the customer side of the reference video. */
export async function playDemo() {
  stopDemo();
  await startCall();
  let i = 0;
  const tick = () => {
    const s = getState();
    if (s.callStatus === 'ended' || s.callStatus === 'idle') return stopDemo();
    if (s.callStatus === 'listening' && !s.busy && i < DEMO_SCRIPT.length) {
      sendText(DEMO_SCRIPT[i++]);
      demoTimer = window.setTimeout(tick, 2600);
      return;
    }
    if (i < DEMO_SCRIPT.length) demoTimer = window.setTimeout(tick, 400);
  };
  demoTimer = window.setTimeout(tick, 1500);
}

export function stopDemo() {
  if (demoTimer) window.clearTimeout(demoTimer);
  demoTimer = undefined;
}
