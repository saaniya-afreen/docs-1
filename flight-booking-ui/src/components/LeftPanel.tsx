import { tools } from '../agent/tools';
import { notifyUi } from '../voice/session';
import { setState, useAppState } from '../state/store';
import { fmtDelta } from '../format';
import { BRAND } from '../config';
import { ChevronLeft, SparkIcon } from './icons';
import { RouteCompact } from './RouteHeader';
import { BagsView, ConfirmedView, FlightsView, ReviewView, SeatsView, TripView } from './views';
import { diff, hasPendingChanges } from './derived';

export function LeftPanel() {
  const view = useAppState((s) => s.view);
  const booking = useAppState((s) => s.booking);
  const original = useAppState((s) => s.original);
  const agentTouched = useAppState((s) => s.agentTouched);
  const busy = useAppState((s) => s.busy);
  const error = useAppState((s) => s.error);

  const pending = hasPendingChanges({ booking, original });
  const total = diff({ booking, original })?.total ?? 0;
  const isStep = view === 'flights' || view === 'seats' || view === 'bags' || view === 'review';

  const openReview = async () => {
    const q = await tools.getQuote({}, 'user').catch(() => null);
    if (q) notifyUi({ type: 'review_opened', total_change: q.total_change });
  };

  return (
    <main className="left" aria-busy={busy}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {BRAND.name}
        </div>
        <div className="who">
          {booking && (
            <div className="who-text">
              <strong>{booking.customer_name}</strong>
              <span>Booking {booking.booking_reference}</span>
            </div>
          )}
          <button className="pill" onClick={() => setState((s) => ({ backstageOpen: !s.backstageOpen }))}>
            Backstage
          </button>
        </div>
      </header>
      <div className={`agent-hint ${agentTouched && view !== 'trip' ? 'show' : ''}`}>
        <SparkIcon /> {BRAND.agentName} changed this
      </div>

      {isStep && <RouteCompact />}
      {isStep && pending && (
        <div className="banner">
          <span className="banner-dot" /> Not confirmed yet. Review and confirm to keep these changes.
        </div>
      )}

      <div className="view-host" key={view}>
        {view === 'trip' && <TripView />}
        {view === 'flights' && <FlightsView />}
        {view === 'seats' && <SeatsView />}
        {view === 'bags' && <BagsView />}
        {view === 'review' && <ReviewView />}
        {view === 'confirmed' && <ConfirmedView />}
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="link small" onClick={() => setState({ error: null })}>
            Dismiss
          </button>
        </div>
      )}

      <footer className="left-foot">
        {view !== 'trip' && view !== 'confirmed' ? (
          <button className="link back" onClick={() => setState({ view: 'trip' })}>
            <ChevronLeft /> Your trip
          </button>
        ) : (
          <span />
        )}
        {pending && view !== 'review' && (
          <button className="btn primary" disabled={busy} onClick={openReview}>
            Review · {fmtDelta(total)}
          </button>
        )}
      </footer>
      <div className="fineprint">Synthetic demo data</div>
    </main>
  );
}
