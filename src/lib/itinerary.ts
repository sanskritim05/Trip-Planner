import { crowdAt } from "./crowds";
import { addDays, tripLength } from "./dates";
import type { Activity, Day, Mode, Pace, Place, TripPlace } from "./types";

export const PACE_CAPACITY: Record<Pace, number> = {
  relaxed: 6 * 60,
  balanced: 7.5 * 60,
  packed: 9 * 60,
};
const DAY_END = 21 * 60; // latest a stop may start
const LUNCH_AFTER = 12 * 60;
const LUNCH_MIN = 60;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated travel minutes between two places (straight line × 1.3 detour factor). */
export function travelMinutes(a: Place, b: Place, mode: Mode) {
  const km = distanceKm(a, b) * 1.3;
  const raw = mode === "walk" ? km * 12 : mode === "transit" ? 8 + km * 3 : 5 + km * 2.2;
  // Long walks fall back to transit-like speeds; nobody walks 10km between stops.
  const capped = mode === "walk" && km > 3 ? 8 + km * 3 : raw;
  return Math.max(5, Math.round(capped / 5) * 5);
}

export type Lookup = (id: string) => Place | undefined;

/**
 * Recompute start times for a day in order. Completed/skipped activities keep their times;
 * pending ones flow after them, starting no earlier than `floorMin`.
 */
export function layoutDay(
  acts: Activity[],
  lookup: Lookup,
  startMin: number,
  mode: Mode,
  floorMin = 0,
) {
  let t = startMin;
  let prev: Place | undefined;
  const conflicts: string[] = [];
  const out = acts.map((a) => {
    const place = lookup(a.placeId ?? "");
    if (a.status !== "pending") {
      t = Math.max(t, a.start + a.duration);
      if (place) prev = place;
      return { ...a };
    }
    t = Math.max(t, floorMin);
    const travel = place && prev ? travelMinutes(prev, place, mode) : 0;
    let start = t + travel;
    let conflict: string | null = null;
    if (place) {
      start = Math.max(start, place.open * 60);
      if (start + a.duration > place.close * 60) {
        conflict = `${place.name} closes at ${place.close}:00, so this visit runs past closing.`;
        conflicts.push(conflict);
      }
      prev = place;
    }
    if (start > 23 * 60) {
      conflict = conflict ?? "Runs very late in the day.";
      conflicts.push(conflict);
    }
    t = start + a.duration;
    return { ...a, start, travelMin: travel, conflict };
  });
  return { activities: out, conflicts };
}

export type GenerateInput = {
  startDate: string;
  endDate: string;
  selected: TripPlace[];
  lookup: Lookup;
  pace: Pace;
  mode: Mode;
  startHour: number;
  /** Per-date weather; rainy days favour indoor stops. */
  weather?: Record<string, { rainy: boolean }>;
  /** Steer popular places away from their peak hours. */
  crowds?: boolean;
};

export type GenerateResult = { days: Day[]; unscheduled: { placeId: string; reason: string }[] };

/**
 * Deterministic itinerary generator. Must-visit places are seeded first each day,
 * nearby places are grouped together, opening hours and daily capacity are respected,
 * and a lunch break is inserted around midday.
 */
export function isIndoor(p: Place) {
  return p.indoor ?? ["Museum", "Food", "Shopping", "Entertainment"].includes(p.category);
}

export function generateItinerary(input: GenerateInput): GenerateResult {
  const n = tripLength(input.startDate, input.endDate);
  const cap = PACE_CAPACITY[input.pace];
  const pool = input.selected
    .map((s) => ({ s, place: input.lookup(s.placeId) }))
    .filter((x): x is { s: TripPlace; place: Place } => !!x.place)
    .sort(
      (a, b) =>
        Number(b.s.priority) - Number(a.s.priority) ||
        b.place.duration - a.place.duration ||
        a.place.id.localeCompare(b.place.id),
    );
  const remaining = [...pool];
  const days: Day[] = [];

  for (let d = 0; d < n; d++) {
    const acts: Activity[] = [];
    let t = input.startHour * 60;
    let used = 0;
    let prev: Place | undefined;
    let lunch = false;
    const date = addDays(input.startDate, d);
    const rainy = !!input.weather?.[date]?.rainy;

    for (;;) {
      if (!lunch && t >= LUNCH_AFTER && acts.length) {
        acts.push({
          id: `meal-${d}`,
          kind: "meal",
          placeId: null,
          label: "Lunch break",
          start: t,
          duration: LUNCH_MIN,
          travelMin: 0,
          status: "pending",
        });
        t += LUNCH_MIN;
        lunch = true;
      }
      if (t >= DAY_END || !remaining.length) break;
      const here = prev;
      const now = t;
      const cost = (x: { s: TripPlace; place: Place }) => {
        let c = (here ? distanceKm(here, x.place) : 0) - (x.s.priority ? 3 : 0);
        if (input.weather) {
          const indoor = isIndoor(x.place);
          c += rainy ? (indoor ? -1.5 : 4) : indoor ? 0.4 : -0.4;
        }
        if (input.crowds) c += crowdAt(x.place, date, Math.max(now, x.place.open * 60)) / 30;
        return c;
      };
      const ranked = [...remaining].sort((a, b) => cost(a) - cost(b));
      const pick = ranked.find(({ place }) => {
        const travel = here ? travelMinutes(here, place, input.mode) : 0;
        const start = Math.max(t + travel, place.open * 60);
        return (
          start + place.duration <= place.close * 60 &&
          used + travel + place.duration <= cap &&
          start < DAY_END
        );
      });
      if (!pick) break;
      const travel = here ? travelMinutes(here, pick.place, input.mode) : 0;
      const start = Math.max(t + travel, pick.place.open * 60);
      acts.push({
        id: `${pick.place.id}-d${d}`,
        kind: "place",
        placeId: pick.place.id,
        start,
        duration: pick.place.duration,
        travelMin: travel,
        status: "pending",
      });
      used += travel + pick.place.duration;
      t = start + pick.place.duration;
      prev = pick.place;
      remaining.splice(remaining.indexOf(pick), 1);
    }
    const laid = layoutDay(acts, input.lookup, input.startHour * 60, input.mode);
    days.push({ date, activities: laid.activities });
  }

  const unscheduled = remaining.map(({ s, place }) => ({
    placeId: place.id,
    reason:
      place.close - place.open < place.duration / 60
        ? `${place.name} isn't open long enough for a full visit.`
        : `${s.priority ? "Must-visit, but it " : "It "}didn't fit into ${n} day${n > 1 ? "s" : ""} at a ${input.pace} pace. Try adding a day or removing a stop.`,
  }));
  return { days, unscheduled };
}

/** Rough check of whether selected places fit the trip. */
export function capacityCheck(selected: Place[], days: number, pace: Pace) {
  const need = selected.reduce((s, p) => s + p.duration + 25, 0);
  const have = days * PACE_CAPACITY[pace];
  return { need, have, over: need > have, ratio: have ? need / have : 0 };
}

export type AssistantAction =
  | { type: "late"; minutes: number }
  | { type: "replace"; activityId: string; placeId: string }
  | { type: "rain"; candidates: string[] }
  | { type: "skip"; activityId: string }
  | { type: "add"; placeId: string }
  | { type: "mode"; mode: Mode }
  | { type: "extend"; activityId: string; minutes: number }
  | { type: "rearrange" };

/** Re-plan the rest of a day while traveling. Completed activities are always preserved. */
export function replanDay(
  day: Day,
  action: AssistantAction,
  ctx: { lookup: Lookup; mode: Mode; nowMin: number; startHour: number; priorityIds: Set<string> },
) {
  let acts = day.activities.map((a) => ({ ...a }));
  let mode = ctx.mode;
  let delay = 0;
  const notes: string[] = [];
  const firstPending = acts.find((a) => a.status === "pending");

  switch (action.type) {
    case "late":
      delay = action.minutes;
      notes.push(`Shifted remaining stops by ${action.minutes} min.`);
      break;
    case "skip": {
      const a = acts.find((x) => x.id === action.activityId);
      if (a) {
        a.status = "skipped";
        a.start = Math.max(a.start, ctx.nowMin);
        a.duration = 0;
        notes.push(`Skipped ${ctx.lookup(a.placeId ?? "")?.name ?? "stop"}.`);
      }
      break;
    }
    case "add": {
      const place = ctx.lookup(action.placeId);
      if (place) {
        const idx = firstPending ? acts.indexOf(firstPending) + 1 : acts.length;
        acts.splice(idx, 0, {
          id: `${place.id}-add-${acts.length}`,
          kind: "place",
          placeId: place.id,
          start: 0,
          duration: place.duration,
          travelMin: 0,
          status: "pending",
        });
        notes.push(`Added ${place.name} after your current stop.`);
      }
      break;
    }
    case "replace": {
      const a = acts.find((x) => x.id === action.activityId);
      const from = ctx.lookup(a?.placeId ?? "");
      const to = ctx.lookup(action.placeId);
      if (a && to) {
        a.placeId = to.id;
        a.id = `${to.id}-swap-${acts.length}`;
        a.duration = to.duration;
        notes.push(`Swapped ${from?.name ?? "that stop"} for ${to.name}.`);
      }
      break;
    }
    case "rain": {
      const used = new Set(acts.map((x) => x.placeId));
      for (const a of acts) {
        const p = ctx.lookup(a.placeId ?? "");
        if (a.status !== "pending" || a.kind !== "place" || !p || isIndoor(p)) continue;
        const alt = findAlternatives(
          p,
          action.candidates.map(ctx.lookup).filter((x): x is Place => !!x && !used.has(x.id)),
          { indoorOnly: true },
        )[0];
        if (alt) {
          used.add(alt.id);
          notes.push(`Rain plan: ${p.name} → ${alt.name} (indoors).`);
          a.placeId = alt.id;
          a.id = `${alt.id}-rain-${acts.length}`;
          a.duration = alt.duration;
        } else notes.push(`Couldn't find an indoor swap for ${p.name}. Bring an umbrella!`);
      }
      if (!notes.length) notes.push("Everything left today is already indoors.");
      break;
    }
    case "mode":
      mode = action.mode;
      notes.push(
        `Travel times recalculated for ${action.mode === "walk" ? "walking" : action.mode}.`,
      );
      break;
    case "extend": {
      const a = acts.find((x) => x.id === action.activityId);
      if (a) {
        a.duration += action.minutes;
        notes.push(
          `Added ${action.minutes} min at ${ctx.lookup(a.placeId ?? "")?.name ?? "this stop"}.`,
        );
      }
      break;
    }
    case "rearrange": {
      const fixed = acts.filter((a) => a.status !== "pending");
      const pending = acts.filter((a) => a.status === "pending" && a.kind === "place");
      const meals = acts.filter((a) => a.status === "pending" && a.kind === "meal");
      let cur = ctx.lookup([...fixed].reverse().find((a) => a.placeId)?.placeId ?? "");
      const ordered: Activity[] = [];
      const left = [...pending];
      while (left.length) {
        left.sort((a, b) => {
          const pa = ctx.lookup(a.placeId ?? "")!;
          const pb = ctx.lookup(b.placeId ?? "")!;
          const da = cur ? distanceKm(cur, pa) : 0;
          const db = cur ? distanceKm(cur, pb) : 0;
          const wa = ctx.priorityIds.has(pa.id) ? -1.5 : 0;
          const wb = ctx.priorityIds.has(pb.id) ? -1.5 : 0;
          return da + wa - (db + wb) || pa.close - pb.close;
        });
        const next = left.shift()!;
        ordered.push(next);
        cur = ctx.lookup(next.placeId ?? "");
      }
      if (meals.length && ordered.length > 1)
        ordered.splice(Math.ceil(ordered.length / 2), 0, ...meals);
      else ordered.push(...meals);
      acts = [...fixed, ...ordered];
      notes.push("Reordered remaining stops to reduce travel, keeping must-visits early.");
      break;
    }
  }

  const laid = layoutDay(acts, ctx.lookup, ctx.startHour * 60, mode, ctx.nowMin + delay);
  // Suggest dropping the lowest-priority stop if the day overruns.
  const last = [...laid.activities].reverse().find((a) => a.status === "pending");
  if (last && last.start + last.duration > 22 * 60) {
    const droppable = laid.activities.filter(
      (a) => a.status === "pending" && a.kind === "place" && !ctx.priorityIds.has(a.placeId ?? ""),
    );
    const victim = droppable[droppable.length - 1];
    if (victim)
      notes.push(`Day now runs late. Consider skipping ${ctx.lookup(victim.placeId ?? "")?.name}.`);
  }
  return { day: { ...day, activities: laid.activities }, conflicts: laid.conflicts, notes, mode };
}

/**
 * Nearby alternatives for a place: same category first, close by, and optionally
 * indoors-only (rain) or cheaper (budget).
 */
export function findAlternatives(
  p: Place,
  candidates: Place[],
  opts: { indoorOnly?: boolean; cheaper?: boolean; limit?: number } = {},
) {
  return candidates
    .filter(
      (c) =>
        c.id !== p.id && (!opts.indoorOnly || isIndoor(c)) && (!opts.cheaper || c.cost < p.cost),
    )
    .map((c) => ({
      c,
      score:
        distanceKm(p, c) +
        (c.category === p.category ? 0 : 1.5) -
        c.tags.filter((t) => p.tags.includes(t)).length * 0.4 +
        (opts.cheaper ? c.cost / 20 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, opts.limit ?? 4)
    .map((x) => x.c);
}

/**
 * Best later day to fit a missed stop: needs spare capacity, prefers days whose
 * stops are nearby. Returns the day index or null if nothing fits.
 */
export function suggestDayFor(
  place: Place,
  days: Day[],
  fromDay: number,
  pace: Pace,
  lookup: Lookup,
): number | null {
  const cap = PACE_CAPACITY[pace];
  let best: { i: number; score: number } | null = null;
  days.forEach((d, i) => {
    if (i < fromDay) return;
    const used = d.activities.reduce(
      (s, a) => s + (a.status === "skipped" ? 0 : a.duration + a.travelMin),
      0,
    );
    const free = cap - used;
    if (free < place.duration + 15) return;
    const stops = d.activities.map((a) => lookup(a.placeId ?? "")).filter((x): x is Place => !!x);
    const near = stops.length ? Math.min(...stops.map((s) => distanceKm(s, place))) : 3;
    const score = near + (i === fromDay ? 1 : 0) - free / 240;
    if (!best || score < best.score) best = { i, score };
  });
  return (best as { i: number; score: number } | null)?.i ?? null;
}
