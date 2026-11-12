import { cityPlaces, getCity, getPlace } from "@/data/registry";
import { legCost } from "@/services/routing";
import { tripLength } from "./dates";
import { distanceKm, findAlternatives } from "./itinerary";
import type { Accommodation, Place, Trip } from "./types";

/** Nightly cost multiplier vs a standard double hotel room, and how many people share one unit. */
export const STAY: Record<Accommodation, { mult: number; sleeps: number; label: string }> = {
  hostel: { mult: 0.35, sleeps: 1, label: "Hostel bed" },
  airbnb: { mult: 1.15, sleeps: 4, label: "Rental (sleeps 4)" },
  hotel: { mult: 1, sleeps: 2, label: "Hotel room" },
  resort: { mult: 1.8, sleeps: 2, label: "Resort room" },
};

export type BudgetEstimate = Record<
  "Accommodation" | "Food" | "Transportation" | "Attractions",
  number
>;

export function estimateBudget(trip: Trip): BudgetEstimate {
  const city = getCity(trip.cityId);
  const days = trip.startDate
    ? tripLength(trip.startDate, trip.endDate)
    : Math.max(1, trip.days.length);
  const nights = Math.max(1, days - 1);
  const daily = city ? city.dailyCost[trip.budgetStyle] : 150;
  const stay = STAY[trip.accommodation ?? "hotel"];
  const units = Math.ceil(trip.travelers / stay.sleeps);
  const nightly = daily * 0.9 * stay.mult; // a double room ≈ 90% of one person's daily spend
  const placeActs = trip.days.flatMap((d) =>
    d.activities.filter((a) => a.kind === "place" && a.status !== "skipped"),
  );
  const attractions =
    placeActs.reduce((s, a) => s + (getPlace(a.placeId)?.cost ?? 0), 0) * trip.travelers;
  // Local travel between stops, plus getting to/from the airport or station.
  let transport = 0;
  for (const d of trip.days) {
    const ps = d.activities.map((a) => getPlace(a.placeId)).filter((p): p is Place => !!p);
    for (let i = 1; i < ps.length; i++)
      transport += legCost(trip.transport, distanceKm(ps[i - 1]!, ps[i]!) * 1.3);
  }
  transport =
    transport * (trip.transport === "drive" ? Math.ceil(trip.travelers / 4) : trip.travelers) +
    daily * 0.25 * trip.travelers;
  return {
    Accommodation: Math.round(nightly * nights * units),
    Food: Math.round(daily * 0.3 * days * trip.travelers),
    Transportation: Math.round(transport),
    Attractions: Math.round(attractions),
  };
}

export const total = (e: BudgetEstimate) => Object.values(e).reduce((a, b) => a + b, 0);

export type Saving =
  | { kind: "swap"; activityId: string; dayIdx: number; from: Place; to: Place; save: number }
  | { kind: "stay"; to: Accommodation; save: number }
  | { kind: "mode"; save: number };

/** Ways to bring an over-budget trip back in line, biggest savings first. */
export function cheaperOptions(trip: Trip): Saving[] {
  const out: Saving[] = [];
  const base = total(estimateBudget(trip));
  const scheduled = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.placeId)));
  const pool = cityPlaces(trip.cityId).filter((p) => !scheduled.has(p.id));
  const used = new Set<string>();
  trip.days.forEach((d, dayIdx) =>
    d.activities.forEach((a) => {
      const from = getPlace(a.placeId);
      if (!from || a.status !== "pending" || from.cost < 8) return;
      const priority = trip.places.find(
        (p) => p.placeId === from.id && (p.priority || p.source === "must"),
      );
      if (priority) return;
      const to = findAlternatives(
        from,
        pool.filter((p) => !used.has(p.id)),
        { cheaper: true, limit: 1 },
      )[0];
      if (!to) return;
      used.add(to.id);
      out.push({
        kind: "swap",
        activityId: a.id,
        dayIdx,
        from,
        to,
        save: (from.cost - to.cost) * trip.travelers,
      });
    }),
  );
  const order: Accommodation[] = ["hostel", "airbnb", "hotel", "resort"];
  for (const acc of order) {
    if (acc === trip.accommodation) continue;
    const save = base - total(estimateBudget({ ...trip, accommodation: acc }));
    if (save > 20) out.push({ kind: "stay", to: acc, save: Math.round(save) });
  }
  if (trip.transport === "drive") {
    const save = base - total(estimateBudget({ ...trip, transport: "transit" }));
    if (save > 10) out.push({ kind: "mode", save: Math.round(save) });
  }
  return out.sort((a, b) => b.save - a.save).slice(0, 6);
}
