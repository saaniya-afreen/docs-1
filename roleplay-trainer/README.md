# Role Play

Practice-call page for trainees. The OneInbox widget plays the customer (prompt, voice,
live transcript and call end are all handled by the widget); this page is the call interface.

## Flow
1. Choose **Inbound call** (phone rings → Accept / Decline) or **Outbound call** (Call → ringing).
2. **During the call:** widget with live transcript on the left, notes on the right, timer, End call.
3. **After call:** write a summary and a to-do list; the notes from the call are carried over. Save.
4. Saved calls appear under **Recent calls** on the home screen (stored in this browser).

## Widgets
Set in `index.html` → `WIDGETS`:
- Inbound: `n6w4jfcdje`
- Outbound: `braj8s3quq`

## Hosting
Static site on Render (`role-play`), publish directory `roleplay-trainer`, auto-deploys from
this branch. Needs https or localhost for microphone access (`npx serve roleplay-trainer`).
