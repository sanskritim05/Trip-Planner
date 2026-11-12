const DAY = 86_400_000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "June",
  "July",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toUTC(iso: string) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function localISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(toUTC(iso) + n * DAY);
  return d.toISOString().slice(0, 10);
}

/** b - a in whole days */
export function diffDays(a: string, b: string) {
  return Math.round((toUTC(b) - toUTC(a)) / DAY);
}

export function daysUntil(start: string, today: string) {
  return Math.max(0, diffDays(today, start));
}

export function tripLength(start: string, end: string) {
  return diffDays(start, end) + 1;
}

export function formatRange(start: string, end: string) {
  const s = new Date(toUTC(start));
  const e = new Date(toUTC(end));
  const sm = MONTHS[s.getUTCMonth()];
  const em = MONTHS[e.getUTCMonth()];
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const tail = sm === em && sameYear ? `${e.getUTCDate()}` : `${em} ${e.getUTCDate()}`;
  return `${sm} ${s.getUTCDate()}${sameYear ? "" : `, ${s.getUTCFullYear()}`}–${tail}, ${e.getUTCFullYear()}`;
}

export function formatShort(iso: string) {
  const d = new Date(toUTC(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function weekday(iso: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(toUTC(iso)).getUTCDay()];
}

export function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtHours(open: number, close: number) {
  if (open === 0 && close === 24) return "Open 24 hours";
  return `${fmtTime(open * 60)} – ${fmtTime(close * 60)}`;
}
