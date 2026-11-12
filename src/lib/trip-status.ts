import { addDays, diffDays, tripLength } from "./dates";
import type { Trip } from "./types";

export type TripPhase = "draft" | "upcoming" | "active" | "past";

export function tripPhase(
  trip: Pick<Trip, "status" | "startDate" | "endDate">,
  today: string,
): TripPhase {
  if (trip.status === "draft") return "draft";
  if (today < trip.startDate) return "upcoming";
  if (today > trip.endDate) return "past";
  return "active";
}

/** 0-based index of today within the trip, clamped to the trip length. */
export function tripDayIndex(trip: Pick<Trip, "startDate" | "endDate">, today: string) {
  const n = tripLength(trip.startDate, trip.endDate);
  return Math.min(n - 1, Math.max(0, diffDays(trip.startDate, today)));
}

/** The time capsule unlocks ON the final day of the trip. */
export function capsuleUnlockDate(trip: Pick<Trip, "endDate">) {
  return trip.endDate;
}
export function isCapsuleUnlocked(trip: Pick<Trip, "endDate">, today: string) {
  return today >= capsuleUnlockDate(trip);
}

/** The scrapbook is released exactly one day after the trip ends. */
export function scrapbookReleaseDate(trip: Pick<Trip, "endDate">) {
  return addDays(trip.endDate, 1);
}
export function isScrapbookReleased(trip: Pick<Trip, "endDate">, today: string) {
  return today >= scrapbookReleaseDate(trip);
}

export function tripProgress(trip: Pick<Trip, "days">) {
  const acts = trip.days.flatMap((d) => d.activities).filter((a) => a.kind === "place");
  const done = acts.filter((a) => a.status !== "pending").length;
  return {
    done,
    total: acts.length,
    pct: acts.length ? Math.round((done / acts.length) * 100) : 0,
  };
}
