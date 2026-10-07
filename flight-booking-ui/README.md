# Flight Booking Voice Agent: UI

Two-panel demo UI for the flight-change voice agent. The left panel shows the booking (trip, flight options, seat map, bags, review, confirmed). The right panel shows the live conversation with the agent (Sara). Layout and flow follow the reference video and the PRD (scenes 1–6: SIN → NRT, NS1142 → NS1156, seat 23C → 6A, +1 bag, €15 refund).

It runs **today with no backend and no SDK**. A mock API (seeded data) and a mock voice agent (typed input, scripted replies) stand in for both. Each one is behind a small interface, so the real pieces plug in without touching the screens.

## Run

```bash
cd flight-booking-ui
npm install
npm run dev          # http://localhost:5173
```

Click **Talk to Sara** and type, for example "change my flight", "cheapest", "yes", "window seats?", "6A", "add a bag", "yes", "yes". You can also open **Backstage** and click **Play demo script** to replay the whole video conversation automatically. Backstage also lists every API call with its request and response.

Every screen also works by clicking (change flight, pick a seat, add a bag, review, confirm). Clicks go through the same code path the agent uses.

## Plugging in the real pieces

### 1. Backend API (Supabase)

Copy `.env.example` to `.env.local` and set:

```
VITE_API_BASE_URL=https://<project>.supabase.co/functions/v1/<function>
VITE_API_KEY=<anon key>
```

If `VITE_API_BASE_URL` is set, the UI uses `src/api/httpApi.ts` instead of the mock. All routes live in **`src/api/endpoints.ts`**. If the backend team merges endpoints (for example, one `POST /bookings` for book and modify, as discussed in the meeting), change only that file. Responses may be a bare object or a `{ data: ... }` envelope.

The UI expects these routes:

| # | Call | Used for |
|---|------|----------|
| 1 | `GET /bookings/{ref}` | Load trip (scene 1) |
| 2 | `GET /flights/search?origin&destination&date&passengers&booking_ref` | Flight list with `price_delta` vs current flight (scene 2) |
| 3 | `PATCH /bookings/{ref}/flight` `{ new_flight_id }` | Change flight; clears seat (scene 3) |
| 4 | `GET /flights/{id}/seats` | Seat map (scenes 3–4) |
| 5 | `PATCH /bookings/{ref}/seat` `{ new_seat_id }` | Change seat (scene 4) |
| – | `PATCH /bookings/{ref}/bags` `{ baggage_count }` | Extra bag (scene 5). **Not in the PRD's 7 endpoints.** Add it or fold it into a single modify endpoint. |
| 6 | `POST /bookings/{ref}/quote` | `{ flight_change, seat_change, baggage_change, total_change }` (scene 5) |
| 7 | `POST /bookings/{ref}/confirm` `{ confirm: true }` | Lock booking (scene 6) |

The response shapes are in `src/types.ts` and follow the PRD tables. Two additions to the PRD schema:

- `seat_type` also allows `middle`, for B and E seats.
- A booking also carries `baggage_count`, `included_bags`, `baggage_weight_kg` and an optional `return_flight`.

### 2. Voice SDK

Implement `src/voice/oneInboxAdapter.ts`; the skeleton has the TODOs. Then set `VITE_VOICE_PROVIDER=oneinbox`. The adapter only needs to:

- start and stop the call
- report status (`connecting / listening / speaking / thinking / ended`)
- forward transcript lines (partial and final)
- forward typed text, and send short context notes when the customer clicks something on screen

### 3. How the screen follows the agent

This is the key decision for tomorrow. It depends on where the agent's tools run:

- **Tools run in the browser.** The SDK emits a tool call and the page returns the result. Forward the call to `invokeTool(name, args)` (already wired as `onToolCall`). Tool names: `getBooking`, `searchFlights`, `changeFlight`, `showSeats`, `changeSeat`, `setBags`, `getQuote`, `confirmBooking`, `showView`. Arguments are in `src/agent/tools.ts`. This gives instant UI updates.
- **Tools run on the server.** The agent calls Supabase directly, so the page never sees the calls. The UI then needs a push channel, for example Supabase Realtime on a `ui_events` table, or an SDK custom event. Feed each message into `applyAgentEvent()` in `src/agent/uiEvents.ts`. The event types are listed there.

To test from the browser console: `flightUI.invokeTool('searchFlights', { sort: 'cheapest' })`.

## Structure

```
src/
  api/         BookingApi interface, endpoints map, HTTP client, mock backend + seed data
  agent/       tools.ts (actions shared by agent + clicks), uiEvents.ts (server-pushed updates)
  voice/       VoiceAdapter interface, mock agent, OneInbox SDK skeleton, session wiring
  state/       tiny global store
  components/  LeftPanel, views (trip/flights/seats/bags/review/confirmed), SeatMap, ConversationPanel, Backstage
```

## Mock data / test scenarios

The mock data covers these cases (all flights SIN → NRT, Thu 8 Oct 2026):

| Flight | Time | Fare delta | Seats | Scenario |
|--------|------|------------|-------|----------|
| NS1142 | 14:05 | current | ~60% full | Customer's booking, seat 23C |
| NS1156 | 20:30 | −€60 | ~55% full | Cheapest. 23C taken, 6A/6F free (demo path) |
| NS1150 | 17:15 | −€35 | ~60% full | Moderate availability |
| NS1180 | 23:00 | −€20 | ~50% full | Arrives +1 day |
| NS1146 | 11:05 | −€10 | 95% full | 1 stop, no window seats left (scarce scenario) |
| NS1134 | 09:40 | +€25 | 100% | Sold out (can't be selected) |
| NS1120 | 06:50 | +€40 | ~55% full | Early option |

Seat pricing: rows 1–5 cost €15, exit rows 12–13 cost €25, all other rows are free. Row 30 is blocked. Extra bags cost €45 each, with 1 bag included. **Reset demo** in Backstage restores the seed data.

Brand and agent name are set with `VITE_BRAND_NAME` and `VITE_AGENT_NAME` (defaults: "SKYLINE AIR", "Sara").
