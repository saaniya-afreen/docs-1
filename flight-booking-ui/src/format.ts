// Times are stored as local wall-clock ISO strings (no TZ), so format by slicing
// instead of going through Date, which would shift them to the viewer's zone.

export const AIRPORTS: Record<string, { city: string; name: string }> = {
  SIN: { city: 'Singapore', name: 'Singapore Changi' },
  NRT: { city: 'Tokyo', name: 'Tokyo Narita' },
  HND: { city: 'Tokyo', name: 'Tokyo Haneda' },
  HKG: { city: 'Hong Kong', name: 'Hong Kong' },
  OSL: { city: 'Oslo', name: 'Oslo' },
  LHR: { city: 'London', name: 'London Heathrow' },
};

export const city = (code: string) => AIRPORTS[code]?.city ?? code;
export const airportName = (code: string) => AIRPORTS[code]?.name ?? code;

export function fmtTime(iso: string) {
  return iso.slice(11, 16);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, wd };
}

/** "Thu 8 Oct" */
export function fmtDayShort(iso: string) {
  const { m, d, wd } = parts(iso);
  return `${WD[wd]} ${d} ${MO[m - 1].slice(0, 3)}`;
}

/** "Thu 8 October" */
export function fmtDayLong(iso: string) {
  const { m, d, wd } = parts(iso);
  return `${WD[wd]} ${d} ${MO[m - 1]}`;
}

/** +1 when arrival is on a later calendar day than departure. */
export function dayOffset(dep: string, arr: string) {
  const a = Date.UTC(...(arr.slice(0, 10).split('-').map(Number) as [number, number, number]));
  const d = Date.UTC(...(dep.slice(0, 10).split('-').map(Number) as [number, number, number]));
  return Math.round((a - d) / 86400000);
}

export function fmtFlightNo(n: string) {
  return n.replace(/^([A-Z]{2})\s?(\d+)$/, '$1 $2');
}

/** "−€60", "+€25", "€0" with a real minus sign. */
export function fmtDelta(n: number) {
  if (n === 0) return '€0';
  return `${n < 0 ? '−' : '+'}€${Math.abs(n)}`;
}

export function fmtEur(n: number) {
  return `€${Math.abs(n)}`;
}

export function seatTypeLabel(t: string | null | undefined) {
  switch (t) {
    case 'window':
      return 'Window';
    case 'aisle':
      return 'Aisle';
    case 'middle':
      return 'Middle';
    case 'emergency_row':
      return 'Exit row';
    default:
      return '';
  }
}
