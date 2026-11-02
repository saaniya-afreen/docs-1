# Call Role-Play Trainer

A single-page trainer where an AI **customer** (a OneInbox voice agent) calls the trainee,
or the trainee calls it, so BPO operators can practise inbound and outbound calls.

Open `index.html` in a browser (or host it on any static host). No backend or build step.

## Flow
1. **Practice**: pick a customer (filter by project and inbound/outbound).
2. **Inbound**: optional brief → phone rings → Accept / Decline.
   **Outbound**: Dial → ringing → connected.
3. **In call**: the OneInbox widget on the left (it handles the conversation, live
   transcript and ending the call); caller info, timer and a notes pad on the right.
   When the call is over, click **Call finished → After-call work**.
4. **ACW**: summary, customer request, outcome, to-do checklist, edit the in-call notes → Save.
5. **History**: reopen, copy, delete or export past practice calls.

## Adding a customer (one OneInbox agent per customer)
The persona and prompt are set up on the agent in OneInbox. In the trainer:
**Customers → + New customer**, enter name, caller-ID phone, project, inbound/outbound, an
optional brief for the trainee, and the agent's widget `public-id` (or paste the full
embed snippet) → Save.

## Notes
- Each call loads `<oneinbox-widget>` in a fresh iframe (`allow="microphone"`), so ending a
  call fully stops the widget and releases the mic.
- Customers and history are stored in the browser's localStorage (per device). Use
  **Export / Import** to share customers between machines.
- Microphone access needs `https://` or `localhost`. Run it locally with
  `npx serve roleplay-trainer` rather than opening the file directly.
