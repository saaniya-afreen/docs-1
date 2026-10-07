import { tools } from '../agent/tools';
import { notifyUi } from '../voice/session';
import { useAppState } from '../state/store';
import { fmtEur, seatTypeLabel } from '../format';
import type { Seat } from '../types';
import { Check } from './icons';

const TOP = ['A', 'B', 'C'] as const;
const BOTTOM = ['D', 'E', 'F'] as const;
const EXIT_ROWS = new Set([12, 13]);

/** Horizontal cabin: nose on the left, rows 1→30 across, A–C over the aisle, D–F under. */
export function SeatMap() {
  const seats = useAppState((s) => s.seats);
  const booking = useAppState((s) => s.booking);
  const original = useAppState((s) => s.original);
  const highlight = useAppState((s) => s.seatHighlight);
  const busy = useAppState((s) => s.busy);

  const rows = Math.max(0, ...seats.map((s) => s.row_number));
  const byNum = new Map(seats.map((s) => [s.seat_number, s]));
  const mine = booking?.seat_number;
  const oldSeat = original?.seat_number;

  const pick = async (s: Seat) => {
    if (busy || s.status !== 'available') return;
    const r = await tools.changeSeat({ seat_id: s.seat_id }, 'user').catch(() => null);
    if (r) notifyUi({ type: 'seat_changed', seat_number: s.seat_number, seat_type: s.seat_type, surcharge: s.base_price_delta });
  };

  const cell = (row: number, col: string) => {
    const s = byNum.get(`${row}${col}`);
    if (!s) return <span key={`${row}${col}`} className="seat ghost" />;
    const isMine = s.seat_number === mine;
    const isOld = !isMine && s.seat_number === oldSeat;
    const match = !isMine && s.status === 'available' && highlight && s.seat_type === highlight;
    const cls = [
      'seat',
      isMine ? 'mine' : s.status === 'blocked' ? 'blocked' : s.status === 'booked' ? 'taken' : 'free',
      match ? 'match' : '',
      isOld ? 'old' : '',
    ].join(' ');
    const label = `Seat ${s.seat_number}, ${seatTypeLabel(s.seat_type)}, ${
      isMine ? 'your seat' : s.status === 'available' ? (s.base_price_delta ? fmtEur(s.base_price_delta) : 'free') : 'unavailable'
    }`;
    return (
      <button key={s.seat_number} className={cls} disabled={s.status !== 'available' || isMine} onClick={() => pick(s)} title={label} aria-label={label}>
        {isMine && <Check size={10} />}
      </button>
    );
  };

  const rowNums = Array.from({ length: rows }, (_, i) => i + 1);

  return (
    <div className="seatmap-wrap">
      <div className="fuselage">
        <div className="nose" aria-hidden="true">
          <span className="cockpit" />
        </div>
        <div className="cabin" style={{ gridTemplateColumns: `14px repeat(${rows}, var(--seat-w))` }}>
          {TOP.map((col) => (
            <Row key={col} col={col} rows={rowNums} cell={cell} />
          ))}
          <span className="col-label" />
          {rowNums.map((r) => (
            <span key={r} className={`row-num ${EXIT_ROWS.has(r) ? 'exit' : ''}`}>
              {r === 1 || r % 5 === 0 || EXIT_ROWS.has(r) ? r : ''}
            </span>
          ))}
          {BOTTOM.map((col) => (
            <Row key={col} col={col} rows={rowNums} cell={cell} />
          ))}
        </div>
      </div>
      <ul className="legend">
        <li><span className="seat free" /> Free</li>
        {highlight && <li><span className="seat free match" /> Matches ({seatTypeLabel(highlight).toLowerCase()})</li>}
        <li><span className="seat taken" /> Taken</li>
        <li><span className="seat mine" /> Yours</li>
        {oldSeat && oldSeat !== mine && <li><span className="seat free old" /> Your old seat</li>}
        <li><span className="seat blocked" /> Unavailable</li>
      </ul>
    </div>
  );
}

function Row({ col, rows, cell }: { col: string; rows: number[]; cell: (r: number, c: string) => React.ReactNode }) {
  return (
    <>
      <span className="col-label">{col}</span>
      {rows.map((r) => cell(r, col))}
    </>
  );
}
