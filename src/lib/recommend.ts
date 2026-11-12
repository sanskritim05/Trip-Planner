import { cityPlaces, getPlace } from "@/data/registry";
import { distanceKm } from "./itinerary";
import type { Place, Trip } from "./types";

export type Rec = { place: Place; score: number; reasons: string[]; nearestKm: number | null };

const DIET_WORDS: Record<string, RegExp> = {
  Vegetarian: /vegetarian|veggie|plant/i,
  Vegan: /vegan|plant/i,
  "Gluten-free": /gluten/i,
  Halal: /halal/i,
  Kosher: /kosher/i,
  "Dairy-free": /dairy|vegan/i,
};

/**
 * Rank attractions for the swipe deck using interests, learned taste (from swipes,
 * saves, visits and skips), budget, available time, proximity to places already
 * picked, bucket-list saves and dietary needs. Never repeats a place that is
 * already selected or was passed on.
 */
export function recommend(
  trip: Trip,
  bucketIds: Set<string>,
  taste: Record<string, number> = {},
): Rec[] {
  const chosen = trip.places.map((p) => getPlace(p.placeId)).filter((p): p is Place => !!p);
  const excluded = new Set([...trip.places.map((p) => p.placeId), ...trip.passed]);
  const days = Math.max(
    1,
    trip.days.length ||
      (trip.startDate
        ? Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 864e5) + 1
        : 4),
  );
  const perPersonDaily = trip.budget / Math.max(1, trip.travelers) / days;
  const diets = trip.dietary.filter((d) => d !== "No restrictions");
  const likedNames = chosen
    .filter((c) => trip.places.find((p) => p.placeId === c.id)?.source === "swipe")
    .map((c) => c);

  return cityPlaces(trip.cityId)
    .filter((p) => !excluded.has(p.id))
    .map((place) => {
      const reasons: string[] = [];
      let score = 0;
      const matches = place.tags.filter((t) => trip.interests.includes(t));
      if (matches.length) {
        score += matches.length * 3;
        reasons.push(`Matches your love of ${matches.join(" & ").toLowerCase()}`);
      }
      const learned = [...place.tags, place.category].reduce((s, k) => s + (taste[k] ?? 0), 0);
      if (learned > 1.5) {
        const twin = likedNames.find(
          (l) => l.category === place.category || l.tags.some((t) => place.tags.includes(t)),
        );
        reasons.push(
          twin ? `Because you liked ${twin.name}` : "You've been loving places like this",
        );
      }
      score += Math.max(-4, Math.min(6, learned * 0.7));
      if (bucketIds.has(place.id)) {
        score += 5;
        reasons.unshift("It's on your bucket list");
      }
      let nearestKm: number | null = null;
      if (chosen.length) {
        nearestKm = Math.min(...chosen.map((c) => distanceKm(c, place)));
        if (nearestKm < 1.5) {
          score += 2.5;
          reasons.push("Close to places you've already picked");
        } else if (nearestKm > 12) score -= 1.5;
      }
      if (place.category === "Food" && diets.length) {
        const ok = diets.filter(
          (d) =>
            place.diet?.includes(d) || DIET_WORDS[d]?.test(`${place.name} ${place.description}`),
        );
        if (ok.length) {
          score += 3;
          reasons.push(`${ok.join(" & ")}-friendly`);
        }
      }
      if (place.cost === 0) {
        score += 1;
        reasons.push("Free to visit");
      } else if (place.cost > perPersonDaily * 0.5) score -= 2;
      if (trip.pace === "relaxed" && place.duration > 200) score -= 1;
      if (place.tags.includes("Hidden gems") && trip.interests.includes("Hidden gems"))
        reasons.push("A local hidden gem");
      if (place.popularity) score += Math.min(2, Math.log10(place.popularity + 1) / 2.5);
      if (!reasons.length)
        reasons.push(
          place.popularity && place.popularity > 5000
            ? "One of the city's most-loved sights"
            : `A local favorite ${place.category === "Food" ? "spot to eat" : "worth a look"}`,
        );
      return { place, score, reasons, nearestKm };
    })
    .sort((a, b) => b.score - a.score || a.place.id.localeCompare(b.place.id));
}
