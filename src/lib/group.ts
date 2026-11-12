/**
 * Shared group trips. The server keeps one document per invite code; every member
 * pushes their edits and pulls everyone else's. Plan fields are last-writer-wins,
 * while additive things (members, suggestions & votes, photos, check-ins) are merged
 * so nobody's contribution is lost.
 */
import type { Activity, City, Day, GroupMember, Place, Suggestion, Trip } from "./types";

export const SHARED_KEYS = [
  "id",
  "cityId",
  "name",
  "startDate",
  "endDate",
  "flexible",
  "budget",
  "currency",
  "budgetStyle",
  "budgetSplit",
  "accommodation",
  "travelers",
  "travelerType",
  "interests",
  "pace",
  "walking",
  "transport",
  "dietary",
  "startHour",
  "status",
  "step",
  "places",
  "passed",
  "days",
  "unscheduled",
  "photos",
  "group",
  "confirmed",
] as const satisfies readonly (keyof Trip)[];

type SharedKey = (typeof SHARED_KEYS)[number];
export type SharedTrip = Pick<Trip, SharedKey> & { placeData: Place[]; cityData: City | null };
export type GroupDoc = {
  code: string;
  ownerId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  trip: SharedTrip;
};

const COLORS: GroupMember["color"][] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
export const memberColor = (i: number) => COLORS[i % COLORS.length]!;

/** Everything other members need, including the place and city data so they can render them. */
export function toShared(
  trip: Trip,
  lookupPlace: (id: string) => Place | undefined,
  city: City | undefined,
): SharedTrip {
  const out = {} as SharedTrip;
  for (const k of SHARED_KEYS) (out as Record<string, unknown>)[k] = trip[k];
  const ids = new Set<string>([
    ...trip.places.map((p) => p.placeId),
    ...trip.days.flatMap((d) => d.activities.map((a) => a.placeId ?? "")),
    ...(trip.group?.suggestions ?? []).map((s) => s.placeId),
  ]);
  out.placeData = [...ids].map((id) => lookupPlace(id)).filter((p): p is Place => !!p);
  out.cityData = city ?? null;
  return out;
}

/** Stable fingerprint of the shared part of a trip (ignores the sync version). */
export function sharedHash(trip: Trip | SharedTrip): string {
  const pick: Record<string, unknown> = {};
  for (const k of SHARED_KEYS)
    pick[k] = k === "group" && trip.group ? { ...trip.group, version: 0 } : trip[k];
  return JSON.stringify(pick);
}

const RANK: Record<Activity["status"], number> = { pending: 0, skipped: 1, done: 2 };

function mergeDays(base: Day[], incoming: Day[]): Day[] {
  const baseByDate = new Map(base.map((d) => [d.date, d]));
  return incoming.map((d) => {
    const old = baseByDate.get(d.date);
    if (!old) return d;
    const oldById = new Map(old.activities.map((a) => [a.id, a]));
    return {
      ...d,
      activities: d.activities.map((a) => {
        const o = oldById.get(a.id);
        // A check-in by any member counts for the group.
        return o && RANK[o.status] > RANK[a.status] ? { ...a, status: o.status } : a;
      }),
    };
  });
}

function unionBy<T>(
  a: T[],
  b: T[],
  key: (x: T) => string,
  combine: (x: T, y: T) => T = (_x, y) => y,
): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(key(x), x);
  for (const y of b) {
    const k = key(y);
    const x = m.get(k);
    m.set(k, x ? combine(x, y) : y);
  }
  return [...m.values()];
}

export function mergeShared(base: SharedTrip, incoming: SharedTrip): SharedTrip {
  const bg = base.group;
  const ig = incoming.group;
  const group =
    bg && ig
      ? {
          ...ig,
          finalized: bg.finalized || ig.finalized,
          members: unionBy(bg.members, ig.members, (m) => m.id),
          suggestions: unionBy<Suggestion>(
            bg.suggestions,
            ig.suggestions,
            (s) => s.placeId,
            (x, y) => ({ ...y, votes: { ...x.votes, ...y.votes } }),
          ),
        }
      : (ig ?? bg);
  return {
    ...incoming,
    group,
    days: mergeDays(base.days, incoming.days),
    photos: unionBy(base.photos, incoming.photos, (p) => p.id),
    placeData: unionBy(base.placeData, incoming.placeData, (p) => p.id),
    cityData: incoming.cityData ?? base.cityData,
  };
}

/** Overlay the shared document onto a member's local copy (personal fields like expenses stay). */
export function applyShared(local: Trip | undefined, shared: SharedTrip, version: number): Trip {
  const { placeData: _p, cityData: _c, ...plan } = shared;
  const base: Trip =
    local ??
    ({
      ...plan,
      expenses: [],
      scrapbook: null,
      unavailableMonths: [],
      updatedAt: new Date().toISOString(),
    } as Trip);
  return {
    ...base,
    ...plan,
    group: plan.group ? { ...plan.group, shared: true, version } : null,
    updatedAt: new Date().toISOString(),
  };
}

/** Which member id represents the signed-in user on this trip. */
export function myMemberId(trip: Pick<Trip, "group">, userId: string | undefined) {
  const members = trip.group?.members ?? [];
  if (userId && members.some((m) => m.id === userId)) return userId;
  return members.find((m) => m.id === "me") ? "me" : (userId ?? "me");
}
