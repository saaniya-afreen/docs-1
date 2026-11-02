# Call Role-Play Trainer

A browser interface where call-centre trainees practise **inbound** and **outbound**
calls against OneInbox voice agents that play the **customer**.

- **Phone-like flow.** For inbound, the trainee goes available, the phone rings with a
  caller ID, and they answer. For outbound, the trainee sees a lead card and dials.
- **Voice and live transcript** come from the OneInbox widget, which is embedded in the call screen.
- **Notes during the call.** There is a notes pad next to the transcript, with timestamps
  (`+ Timestamp` or Ctrl/Cmd+Enter).
- **After-call work (ACW).** The in-call notes carry over. The trainee writes a call
  summary, what the customer wants, a to-do checklist, the call result and a self-review.
  The ACW timer runs while they work.
- **Easy customer setup.** "+ New scenario" makes a customer for any project: name, age,
  gender, brief, and the widget code. Scenarios are exported and imported as JSON so a
  scenario set can be shared per client project.
- **History.** Saved calls are kept in the browser. They can be downloaded as `.txt` for
  each call or exported together as JSON.

No build step and no dependencies. It is plain HTML, CSS and JS.

## How it fits together

```
OneInbox                                   This interface
────────                                   ──────────────
Agent = AI customer persona   ──widget──▶  Call screen (voice + live transcript)
(prompt from agent-prompts/)               + notes pad, timers, ACW form, history
```

1. **Build the customer agent in OneInbox.** Use
   [`agent-prompts/customer-persona-template.md`](agent-prompts/customer-persona-template.md)
   together with the client's inbound/outbound script templates. Make one agent for each
   customer persona.
2. **Copy the agent's widget embed code** from OneInbox.
3. **Open the trainer** and go to **Edit** (or **+ New scenario**). Paste the code and save.
   You can also paste it into `widgetCode` in `scenarios.js` to ship it as a default.

## Run it

The microphone only works on `https://` or `http://localhost`, so serve the folder.
Opening the file directly will not work:

```bash
cd roleplay-trainer && python3 -m http.server 8080
```

Then open http://localhost:8080. To share it with the client, deploy the folder to any
static host (Netlify, Vercel, GitHub Pages, S3).

## Widget modes

| Mode | Use when |
|---|---|
| **Isolated frame** (default) | Most widgets. The widget runs in its own frame that has microphone permission, and it is destroyed on hang-up, so no call stays open afterwards. |
| **Inline** | Use this if the widget refuses to run inside a frame. The snippet is injected into the page instead. If the widget leaves a floating button behind after hang-up, reload the page. |

The trainee clicks the widget's own call/start button after answering. The trainer does
not control the widget. It only hosts it.

## Data

Everything is stored in the trainee's browser (`localStorage`): scenarios, history and
trainee name. Nothing is sent anywhere except whatever the OneInbox widget itself sends.
Use **Export** to back up or share. If the client needs central reporting (supervisor
dashboard, scoring), that is the next step and needs a backend.
