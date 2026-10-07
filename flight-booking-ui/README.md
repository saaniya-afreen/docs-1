# Flight Booking Voice Agent: UI

Two-panel demo UI for the flight-change voice agent. The left panel shows the booking (trip, flight options, seat map, bags, review, confirmed). The right panel shows the live conversation with the agent (Mia). The flow follows the PRD (scenes 1–6: SIN → NRT, NS1142 → NS1156, seat 23C → 6A, +1 bag, €15 refund).

It runs **today with no backend and no SDK**. A mock API (seeded data) and a mock voice agent (typed input, scripted replies) stand in for both. Each one is behind a small interface, so the real pieces plug in without touching the screens.

## Run

```bash
cd flight-booking-ui
npm install
npm run dev          # http://localhost:5173
```

Click **Start call** and type, for example "change my flight", "cheapest", "yes", "window seats?", "6A", "add a bag", "yes", "yes". You can also open **Dev panel** and click **Play demo script** to replay the whole demo conversation automatically. The dev panel also lists every API call with its request and response.

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

### 3. How the screen follows the agent (Supabase Realtime)

The voice agent calls the backend APIs itself, from the OneInbox side, so the browser never sees those calls. The screen stays in sync through Supabase Realtime (`src/agent/realtime.ts`):

1. **bookings table (automatic).** When the agent changes this booking (flight, seat, bags, confirm), the screen re-fetches `GET /bookings/{ref}` and jumps to the step that changed. No extra backend work is needed beyond turning on Realtime for `bookings`.
2. **ui_events table (optional).** For things that don't change a row, such as showing the flight list, highlighting window seats, or opening the review, each API inserts `{ booking_ref, type, payload }`. Types: `flights_shown` (`{"sort":"cheapest"}`), `seats_shown` (`{"seat_type":"window"}`), `quote_ready`, `show_view` (`{"view":"bags"}`). Payloads can be empty; the screen fetches the data itself.

Setup: run `supabase/ui_events.sql` in the Supabase SQL editor, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The dev panel shows the sync status.

```
Customer speaks → agent (OneInbox) → Supabase API → bookings row / ui_events row
                                                         ↓ Realtime
                                                   screen updates
```

If the OneInbox SDK can instead forward the agent's tool calls to the browser, `invokeTool(name, args)` handles them directly (tool names in `src/agent/tools.ts`).

Test from the browser console: `flightUI.handleUiEvent({ booking_ref: 'ABC123', type: 'flights_shown', payload: { sort: 'cheapest' } })`.

## Structure

```
src/
  api/         BookingApi interface, endpoints map, HTTP client, mock backend + seed data
  agent/       tools.ts (actions shared by agent + clicks), uiEvents.ts + realtime.ts (server-pushed updates)
supabase/      ui_events.sql (Realtime setup for screen sync)
  voice/       VoiceAdapter interface, mock agent, OneInbox SDK skeleton, session wiring
  state/       tiny global store
  components/  LeftPanel, views (trip/flights/seats/bags/review/confirmed), SeatMap, ConversationPanel, Backstage (dev panel)
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

Seat pricing: rows 1–5 cost €15, exit rows 12–13 cost €25, all other rows are free. Row 30 is blocked. Extra bags cost €45 each, with 1 bag included. **Reset demo** in the dev panel restores the seed data.

The UI has no airline branding. It has two themes: white and blue (default) and black-and-white. Switch in the dev panel, with `?theme=mono` in the URL, or set `VITE_THEME=mono` for the build. The agent name is set with `VITE_AGENT_NAME` (default "Mia").
