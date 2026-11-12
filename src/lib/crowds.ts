/**
 * Crowd prediction. There is no free global busyness API, so this models typical
 * visitor patterns: category-specific daily curves (museums peak early afternoon,
 * restaurants at lunch & dinner…), scaled by how popular the place is, the day of
 * the week and the destination's season. Values are 0–100.
 */
import { getCity } from "@/data/registry";
import type { Category, Place } from "./types";

type Curve = number[]; // 24 hourly weights, 0..1

function bell(peaks: [number, number, number][]): Curve {
  return Array.from({ length: 24 }, (_, h) =>
    Math.min(
      1,
      peaks.reduce(
        (s, [at, width, height]) => s + height * Math.exp(-((h - at) ** 2) / (2 * width ** 2)),
        0,
      ),
    ),
  );
}

const CURVES: Record<Category, Curve> = {
  Landmark: bell([
    [13, 2.6, 1],
    [19.5, 1.4, 0.5],
  ]), // midday rush + sunset crowd
  Museum: bell([[13.5, 2, 1]]),
  Food: bell([
    [12.8, 1, 0.95],
    [19.8, 1.3, 1],
  ]),
  Nature: bell([[14, 3, 0.9]]),
  Shopping: bell([[16, 2.5, 1]]),
  Neighborhood: bell([[17, 3.5, 0.9]]),
  Beach: bell([[14.5, 2.2, 1]]),
  Adventure: bell([[11, 2.5, 0.8]]),
  Entertainment: bell([[20, 2, 1]]),
};

const WEEKDAY: Record<Category, number[]> = {
  // Sun..Sat multipliers
  Landmark: [1.2, 0.85, 0.85, 0.9, 0.95, 1.05, 1.25],
  Museum: [1.25, 0.6, 0.8, 0.85, 0.9, 1, 1.3],
  Food: [1, 0.75, 0.8, 0.85, 0.95, 1.2, 1.25],
  Nature: [1.3, 0.75, 0.75, 0.8, 0.85, 1, 1.35],
  Shopping: [1.1, 0.75, 0.8, 0.85, 0.9, 1.1, 1.35],
  Neighborhood: [1.15, 0.8, 0.8, 0.85, 0.95, 1.15, 1.3],
  Beach: [1.35, 0.75, 0.75, 0.8, 0.85, 1, 1.4],
  Adventure: [1.25, 0.8, 0.8, 0.8, 0.85, 1, 1.3],
  Entertainment: [0.9, 0.6, 0.7, 0.8, 0.95, 1.3, 1.4],
};

function popularityFactor(p: Place) {
  if (p.popularity != null)
    return Math.min(1.25, Math.max(0.35, Math.log10(p.popularity + 10) / 4));
  // Curated places without view data: big-ticket sights are busier.
  return p.tags.includes("Hidden gems") ? 0.5 : p.cost >= 20 || p.duration >= 150 ? 1.05 : 0.8;
}

function seasonFactor(p: Place, isoDate: string) {
  const city = getCity(p.cityId);
  const month = Number(isoDate.slice(5, 7)) - 1;
  const seasons = city?.seasons ?? [];
  if (!seasons.length) return 1;
  const s = [...seasons]
    .sort((a, b) => ((month - b.startMonth + 12) % 12) - ((month - a.startMonth + 12) % 12))
    .pop();
  return s ? [0.75, 1, 1.25][s.crowd - 1]! : 1;
}

/** Predicted crowd level (0–100) for each hour of the given date. Closed hours are 0. */
export function crowdCurve(p: Place, isoDate: string): number[] {
  const dow = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  const base = CURVES[p.category] ?? CURVES.Landmark;
  const k = popularityFactor(p) * (WEEKDAY[p.category]?.[dow] ?? 1) * seasonFactor(p, isoDate);
  return base.map((v, h) =>
    h < p.open || h >= p.close ? 0 : Math.round(Math.min(100, v * k * 88 + 6)),
  );
}

export function crowdAt(p: Place, isoDate: string, minute: number) {
  return crowdCurve(p, isoDate)[Math.min(23, Math.floor(minute / 60))] ?? 0;
}

export function crowdLabel(v: number) {
  return v < 30 ? "Quiet" : v < 55 ? "Moderate" : v < 78 ? "Busy" : "Very busy";
}

/** Quietest start hours that still leave time for a full visit before closing. */
export function bestVisitTimes(p: Place, isoDate: string, count = 3) {
  const curve = crowdCurve(p, isoDate);
  const lastStart = Math.min(22, p.close - Math.ceil(p.duration / 60));
  const options: { hour: number; level: number }[] = [];
  for (let h = Math.max(p.open, 7); h <= lastStart; h++) {
    const span = Math.max(1, Math.ceil(p.duration / 60));
    const level = Math.round(curve.slice(h, h + span).reduce((s, v) => s + v, 0) / span);
    options.push({ hour: h, level });
  }
  return options.sort((a, b) => a.level - b.level || a.hour - b.hour).slice(0, count);
}
