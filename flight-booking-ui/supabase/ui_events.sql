-- Screen sync for the flight booking demo.
-- Run in the Supabase SQL editor.

-- 1. Required: broadcast changes to bookings so the screen follows the agent.
alter publication supabase_realtime add table public.bookings;

-- 2. Optional: events for things that don't change a booking row
--    (showing the flight list, highlighting seats, opening the review).
create table if not exists public.ui_events (
  id          bigint generated always as identity primary key,
  booking_ref text        not null,
  type        text        not null,  -- flights_shown | seats_shown | quote_ready | show_view
  payload     jsonb,                 -- e.g. {"sort":"cheapest"}, {"seat_type":"window"}, {"view":"bags"}
  created_at  timestamptz not null default now()
);
create index if not exists ui_events_booking_ref_idx on public.ui_events (booking_ref, created_at desc);

alter table public.ui_events enable row level security;
-- Demo only: lets the browser (anon key) receive events. Tighten for production.
create policy "demo read ui_events" on public.ui_events for select to anon using (true);

alter publication supabase_realtime add table public.ui_events;

-- The browser also needs read access to bookings for Realtime to deliver rows:
-- create policy "demo read bookings" on public.bookings for select to anon using (true);

-- Example inserts from the Edge Functions:
--   GET  /flights/search      -> insert into ui_events (booking_ref, type, payload) values ('ABC123', 'flights_shown', '{"sort":"cheapest"}');
--   GET  /flights/{id}/seats  -> ... 'seats_shown', '{"seat_type":"window"}'
--   POST /bookings/{ref}/quote -> ... 'quote_ready', '{}'
-- PATCH flight/seat/bags and POST confirm need no event: the bookings row change is enough.
