import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { onApiLog } from './api';
import { tools, invokeTool } from './agent/tools';
import { applyAgentEvent } from './agent/uiEvents';
import { logApi } from './state/store';
import { LeftPanel } from './components/LeftPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { Backstage } from './components/Backstage';
import './styles.css';
import { initTheme } from './theme';

initTheme();

onApiLog(logApi);

// Handy for wiring/testing the SDK from the browser console.
Object.assign(window, { flightUI: { tools, invokeTool, applyAgentEvent } });

function App() {
  useEffect(() => {
    // Show the current booking before the call starts, like the reference.
    tools.getBooking({}, 'user').catch(() => {});
  }, []);
  return (
    <div className="stage">
      <div className="device">
        <LeftPanel />
        <ConversationPanel />
        <Backstage />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
