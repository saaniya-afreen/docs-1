import type { VoiceAdapter, VoiceHandlers } from './VoiceAdapter';
import { describeUiAction } from './VoiceAdapter';

/**
 * Skeleton for the real OneInbox web voice SDK. Fill in once the SDK is shared.
 *
 * What needs mapping (search for TODO):
 *  1. connect/disconnect  → SDK start/stop call (mic permission, agent id, token)
 *  2. SDK status events   → handlers.onStatus('connecting' | 'listening' | 'speaking' | 'thinking' | 'ended')
 *  3. SDK transcript      → handlers.onTranscript({ id, role, text, final })
 *  4. SDK tool/function calls → await handlers.onToolCall(name, args) and send the result back
 *     (only if tools run client-side; if the agent calls the Supabase API itself,
 *     push UI updates through agent/uiEvents.ts instead — see README).
 *  5. sendText / notifyUiAction → SDK "send user message" / "send context" call
 */
export function createOneInboxAdapter(handlers: VoiceHandlers): VoiceAdapter {
  // TODO: const client = new OneInboxWebSDK({ agentId: import.meta.env.VITE_AGENT_ID, ... })
  const client: unknown = null;

  return {
    async connect() {
      handlers.onStatus('connecting');
      if (!client) {
        handlers.onError(new Error('OneInbox SDK not wired yet — set VITE_VOICE_PROVIDER=mock or finish oneInboxAdapter.ts'));
        handlers.onStatus('idle');
        return;
      }
      // TODO: await client.start();
      // client.on('status', (s) => handlers.onStatus(mapStatus(s)));
      // client.on('transcript', (t) => handlers.onTranscript({ id: t.id, role: t.role === 'assistant' ? 'agent' : 'user', text: t.text, final: t.isFinal }));
      // client.on('tool_call', async (c) => client.sendToolResult(c.id, await handlers.onToolCall(c.name, c.arguments)));
      // client.on('error', (e) => handlers.onError(e));
      // client.on('end', () => handlers.onStatus('ended'));
    },
    async disconnect() {
      // TODO: await client.stop();
      handlers.onStatus('ended');
    },
    sendText(_text) {
      // TODO: client.sendUserMessage(_text);
    },
    setMuted(_muted) {
      // TODO: client.setMicrophoneEnabled(!_muted);
    },
    notifyUiAction(action) {
      void describeUiAction(action);
      // TODO: client.sendContext(describeUiAction(action));
    },
  };
}
