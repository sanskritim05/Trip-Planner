import { tidy } from "@/lib/text";
/**
 * Live destination data: discover a city's places from open data, optionally have
 * the AI enrich them (accurate prices/hours, fun facts, dietary-friendly restaurants,
 * local gems), and ground every AI suggestion against Wikipedia for real
 * coordinates and photos.
 */
import { aiDestinationsFn, aiEnrichFn, aiFilmingFn } from "@/server/fns";
import { INTERESTS, type Category, type City, type Interest, type Place } from "@/lib/types";
import {
  discoverCityPlaces,
  fillPhotos,
  findPhoto,
  pickFunFact,
  placeholderImage,
  resolveTitles,
} from "./wiki";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
const clampHour = (h: number) => Math.max(0, Math.min(24, Math.round(h)));

const CATEGORIES: Category[] = [
  "Landmark",
  "Museum",
  "Food",
  "Nature",
  "Shopping",
  "Neighborhood",
  "Beach",
  "Adventure",
  "Entertainment",
];
/** Keep only values the app understands (the AI may get creative). */
export const toCategory = (c: string, fallback: Category = "Landmark"): Category =>
  CATEGORIES.find((x) => x.toLowerCase() === c.trim().toLowerCase()) ?? fallback;
export const toTags = (tags: string[]): Interest[] => [
  ...new Set(
    tags
      .map((t) => INTERESTS.find((i) => i.toLowerCase() === t.trim().toLowerCase()))
      .filter((t): t is Interest => !!t),
  ),
];

/** Fast: places from open data, shown immediately. */
export async function discoverPlaces(city: City, existing: Place[]): Promise<Place[]> {
  const known = new Set(existing.map((p) => p.name.toLowerCase()));
  return (await discoverCityPlaces(city)).filter((p) => !known.has(p.name.toLowerCase()));
}

/** Enrich the most popular places this many at a time (keeps requests within free-tier AI limits). */
const ENRICH_BATCH = 20;

/**
 * Slow, optional: AI-tuned prices/hours/fun facts for the top places, plus extra
 * picks (dietary-friendly restaurants, local gems) grounded via Wikipedia.
 * Returns the updated and new places, or null if the AI is unavailable.
 */
export async function enrichPlaces(
  city: City,
  places: Place[],
  prefs: { interests: string[]; dietary: string[]; budgetStyle: string },
): Promise<Place[] | null> {
  const batch = places.filter((p) => p.source === "wiki").slice(0, ENRICH_BATCH);
  const res = await aiEnrichFn({
    data: {
      city: city.name,
      country: city.country,
      places: batch.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
      })),
      interests: prefs.interests,
      dietary: prefs.dietary,
      budgetStyle: prefs.budgetStyle,
    },
  }).catch(() => null);
  if (!res) return null;

  const byId = new Map(res.places.map((x) => [x.id, x]));
  const updated = batch.flatMap((p): Place[] => {
    const x = byId.get(p.id);
    if (!x) return [];
    const gem = p.tags.includes("Hidden gems");
    const tags = toTags(x.tags);
    return [
      {
        ...p,
        category: toCategory(x.category, p.category),
        cost: Math.max(0, Math.round(x.costUsd)),
        duration: Math.max(15, Math.round(x.durationMin)),
        open: clampHour(x.openHour),
        close: clampHour(x.closeHour) || 24,
        indoor: x.indoor,
        tags: tags.length
          ? [...new Set<Interest>([...tags, ...(gem ? (["Hidden gems"] as Interest[]) : [])])]
          : p.tags,
        description: x.blurb || p.description,
        ...(x.funFact || p.funFact ? { funFact: x.funFact || p.funFact! } : {}),
        source: "ai",
      },
    ];
  });

  const known = new Set(places.map((p) => p.name.toLowerCase()));
  const wiki = await resolveTitles(res.extra.map((e) => e.wikipediaTitle)).catch(() => null);
  const extras: Place[] = res.extra
    .filter((e) => !known.has(e.name.toLowerCase()))
    .map((e) => {
      const w = e.wikipediaTitle ? wiki?.get(e.wikipediaTitle) : null;
      const category = toCategory(e.category);
      return {
        id: `ai-${city.id}-${slug(e.name)}`,
        cityId: city.id,
        name: e.name,
        category,
        description: e.blurb,
        image: w?.image ?? placeholderImage(category, e.name),
        lat: w?.lat ?? e.lat,
        lng: w?.lng ?? e.lng,
        cost: Math.max(0, Math.round(e.costUsd)),
        duration: Math.max(15, Math.round(e.durationMin)),
        open: clampHour(e.openHour),
        close: clampHour(e.closeHour) || 24,
        tags: toTags(e.tags),
        indoor: e.indoor,
        ...(e.address ? { address: e.address } : {}),
        ...(e.funFact ? { funFact: e.funFact } : {}),
        ...(e.diet.length ? { diet: e.diet } : {}),
        ...(w?.popularity != null ? { popularity: w.popularity } : {}),
        source: "ai",
        ...(w?.title ? { wiki: w.title } : {}),
      };
    });
  return [...updated, ...(await fillPhotos(extras, () => city.name).catch(() => extras))];
}

/** "pending:City|Country" ids name the city an AI filming spot is in. */
const pendingPlaceCity = (p: Place) =>
  p.cityId.startsWith("pending:") ? p.cityId.slice(8).replace("|", " ") : "";

/** Filming locations for any movie/show (AI), grounded via Wikipedia. Null when AI is unavailable. */
export async function findFilmingLocations(title: string): Promise<{
  title: string;
  kind: "Movie" | "TV";
  places: Place[];
  cities: { name: string; country: string; lat: number; lng: number }[];
} | null> {
  const res = await aiFilmingFn({ data: { title } }).catch(() => null);
  if (!res) return null;
  const wiki = await resolveTitles(res.locations.map((l) => l.wikipediaTitle)).catch(() => null);
  const places: Place[] = res.locations.map((l) => {
    const w = l.wikipediaTitle ? wiki?.get(l.wikipediaTitle) : null;
    return {
      id: `film-${slug(res.title)}-${slug(l.name)}`,
      cityId: `pending:${l.city}|${l.country}`,
      name: l.name,
      category: toCategory(l.category),
      description: w?.description
        ? w.description.charAt(0).toUpperCase() + w.description.slice(1) + "."
        : l.scene,
      image: w?.image ?? placeholderImage(toCategory(l.category), l.name),
      lat: w?.lat ?? l.lat,
      lng: w?.lng ?? l.lng,
      cost: Math.max(0, Math.round(l.costUsd)),
      duration: Math.max(15, Math.round(l.durationMin)),
      open: clampHour(l.openHour),
      close: clampHour(l.closeHour) || 24,
      tags: ["Filming locations", "Photography"],
      ...(l.address ? { address: l.address } : {}),
      film: { title: res.title, kind: res.kind, scene: l.scene },
      ...(pickFunFact(w?.extract) ? { funFact: pickFunFact(w?.extract)! } : {}),
      source: "ai",
    };
  });
  const withPhotos = await fillPhotos(places, (p) => pendingPlaceCity(p)).catch(() => places);
  const cities = [
    ...new Map(
      res.locations.map((l) => [
        `${l.city}|${l.country}`,
        { name: l.city, country: l.country, lat: l.lat, lng: l.lng },
      ]),
    ).values(),
  ];
  return { title: res.title, kind: res.kind, places: withPhotos, cities };
}

export async function aiDestinationIdeas(input: Parameters<typeof aiDestinationsFn>[0]["data"]) {
  const res = await aiDestinationsFn({ data: input }).catch(() => null);
  if (!res) return null;
  const wiki = await resolveTitles(res.destinations.map((d) => d.wikipediaTitle)).catch(() => null);
  return Promise.all(
    res.destinations.map(async (d) => {
      const image =
        (d.wikipediaTitle && wiki?.get(d.wikipediaTitle)?.image) ||
        (await findPhoto({
          name: d.name,
          context: d.country,
          lat: d.lat,
          lng: d.lng,
          radius: 3000,
        }).catch(() => undefined)) ||
        placeholderImage("Neighborhood", d.name);
      return { ...d, why: tidy(d.why), image };
    }),
  );
}
