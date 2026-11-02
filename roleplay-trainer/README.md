# Call Role-Play Trainer

A single-page trainer where an AI **customer** (a OneInbox voice agent) calls the trainee,
or the trainee calls it, so BPO operators can practise inbound and outbound calls.

Open `index.html` in a browser (or host it on any static host). No backend or build step.

## Flow
1. **Practice**: pick a customer (filter by project and inbound/outbound).
2. **Inbound**: optional brief → phone rings → Accept / Decline.
   **Outbound**: Dial → ringing → connected.
3. **In call**: the OneInbox widget (live transcript) on the left; caller info, timer and
   a notes pad on the right; End call.
4. **ACW**: summary, customer request, outcome, to-do checklist, edit the in-call notes → Save.
5. **History**: reopen, copy, delete or export past practice calls.

## Adding a customer (one OneInbox agent per customer)
1. **Customers → + New customer**: fill in the persona.
2. Click **Copy agent prompt** and paste it into a new OneInbox agent's prompt.
3. Copy that agent's widget `public-id` (or paste the whole embed snippet) into the form → Save.

Prompt templates also live in `prompts/` (keep them in sync with `PROMPTS` in `index.html`).

## Notes
- Each call loads `<oneinbox-widget>` in a fresh iframe (`allow="microphone"`), so ending a
  call fully stops the widget and releases the mic.
- Customers and history are stored in the browser's localStorage (per device). Use
  **Export / Import** to share customers between machines.
- Microphone access needs `https://` or `localhost`. Run it locally with
  `npx serve roleplay-trainer` rather than opening the file directly.
