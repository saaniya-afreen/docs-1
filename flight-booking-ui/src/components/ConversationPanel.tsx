import { useEffect, useRef, useState } from 'react';
import { endCall, sendText, startCall, toggleMute } from '../voice/session';
import { useAppState, type CallStatus } from '../state/store';
import { BRAND } from '../config';
import { MicIcon, MicOffIcon, SendIcon } from './icons';

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Ready',
  connecting: 'Connecting',
  listening: 'Listening',
  speaking: 'Speaking',
  thinking: 'Working on it',
  ended: 'Call ended',
};

export function ConversationPanel() {
  const status = useAppState((s) => s.callStatus);
  const transcript = useAppState((s) => s.transcript);
  const muted = useAppState((s) => s.muted);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  const live = status !== 'idle' && status !== 'ended';
  const lastAgentIdx = transcript.map((l) => l.role).lastIndexOf('agent');

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (!live) return;
    sendText(draft);
    setDraft('');
  };

  return (
    <aside className="right" aria-label={`Conversation with ${BRAND.agentName}`}>
      <header className="right-head">
        <span className="agent-name">{BRAND.agentName.toUpperCase()}</span>
        <span className={`status s-${status}`}>
          <span className="status-dot" /> {STATUS_LABEL[status]}
        </span>
      </header>

      <div className="transcript" ref={scroller} aria-live="polite">
        {!transcript.length && (
          <div className="t-empty">
            {status === 'connecting' ? 'Connecting you to ' + BRAND.agentName + '…' : `Start a call and ask ${BRAND.agentName} to change your flight, seat or bags.`}
          </div>
        )}
        {transcript.map((l, i) => (
          <div key={l.id} className={`t-line ${l.role} ${i === lastAgentIdx && i >= transcript.length - 2 ? 'latest' : ''} ${l.final ? '' : 'partial'}`}>
            <div className="t-who">{l.role === 'agent' ? BRAND.agentName.toUpperCase() : 'YOU'}</div>
            <div className="t-text">{l.text}</div>
          </div>
        ))}
        {status === 'thinking' && (
          <div className="t-line agent typing" aria-label="Agent is working">
            <span /> <span /> <span />
          </div>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={live ? `Type to ${BRAND.agentName}…` : 'Start the call to type'}
          disabled={!live}
          aria-label={`Message ${BRAND.agentName}`}
        />
        <button type="submit" className="icon-btn" disabled={!live || !draft.trim()} aria-label="Send">
          <SendIcon />
        </button>
      </form>

      <div className="call-row">
        {live && (
          <button className={`icon-btn round ${muted ? 'on' : ''}`} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicOffIcon /> : <MicIcon />}
          </button>
        )}
        {live ? (
          <button className="call-btn live" onClick={() => endCall()}>
            <MicIcon />
            <Wave active={status === 'speaking' || status === 'listening'} speaking={status === 'speaking'} />
            <span>End call</span>
          </button>
        ) : (
          <button className="call-btn" onClick={() => startCall()}>
            <MicIcon /> <span>{status === 'ended' ? 'Call again' : 'Start call'}</span>
          </button>
        )}
      </div>
      <p className="hint">Voice or text · changes stay pending until you confirm</p>
    </aside>
  );
}

function Wave({ active, speaking }: { active: boolean; speaking: boolean }) {
  return (
    <span className={`wave ${active ? 'active' : ''} ${speaking ? 'speaking' : ''}`} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />
      ))}
    </span>
  );
}
