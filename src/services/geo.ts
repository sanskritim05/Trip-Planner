/**
 * Worldwide destinations: Open-Meteo geocoding (free, keyless) + a Wikipedia
 * photo & intro + a rough cost-of-travel index + seasons derived from real
 * climate observations.
 */
import { allCities } from "@/data/registry";
import { MONTH_NAMES } from "@/lib/dates";
import type { City, Interest, Season } from "@/lib/types";
import { citySummary, findPhoto, placeholderImage } from "./wiki";
import { comfortScore, getMonthlyClimate, type MonthClimate } from "./weather";
import { timeoutSignal } from "./http";

export type GeoResult = {
  geoId: number;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  timezone: string;
  population: number;
};

export async function searchCities(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`,
    { signal: timeoutSignal(10_000, signal) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: {
      id: number;
      name: string;
      country?: string;
      country_code?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
      population?: number;
      feature_code?: string;
    }[];
  };
  return (data.results ?? [])
    .filter((r) => r.feature_code?.startsWith("PPL") || (r.population ?? 0) > 5000)
    .map((r) => ({
      geoId: r.id,
      name: r.name,
      country: r.country ?? "",
      countryCode: r.country_code ?? "",
      region: r.admin1 ?? "",
      lat: r.latitude,
      lng: r.longitude,
      timezone: r.timezone ?? "UTC",
      population: r.population ?? 0,
    }));
}

/** Typical moderate travel spend per person per day (USD), by country. */
const COST: Record<string, number> = {
  CH: 280,
  NO: 250,
  IS: 260,
  DK: 230,
  US: 220,
  GB: 210,
  IE: 205,
  FR: 200,
  NL: 200,
  LU: 210,
  SE: 200,
  FI: 190,
  BE: 185,
  DE: 180,
  AT: 180,
  AU: 200,
  NZ: 185,
  CA: 190,
  JP: 170,
  SG: 210,
  HK: 190,
  KR: 150,
  IT: 170,
  ES: 150,
  PT: 130,
  GR: 135,
  HR: 135,
  MT: 140,
  CY: 140,
  SI: 130,
  EE: 130,
  CZ: 120,
  SK: 110,
  PL: 100,
  HU: 105,
  RO: 90,
  BG: 85,
  RS: 85,
  AE: 210,
  QA: 210,
  IL: 220,
  SA: 170,
  TR: 85,
  CN: 110,
  TW: 120,
  MO: 170,
  TH: 75,
  VN: 60,
  ID: 70,
  MY: 80,
  PH: 70,
  KH: 55,
  LA: 50,
  IN: 55,
  LK: 60,
  NP: 45,
  MV: 260,
  MX: 90,
  BR: 90,
  AR: 80,
  CL: 105,
  PE: 75,
  CO: 70,
  CR: 115,
  PA: 105,
  CU: 85,
  DO: 100,
  JM: 130,
  BS: 220,
  PR: 170,
  ZA: 95,
  MA: 70,
  EG: 60,
  TN: 60,
  KE: 95,
  TZ: 120,
  MU: 150,
};

export function dailyCostFor(countryCode: string) {
  const moderate = COST[countryCode.toUpperCase()] ?? 120;
  return { budget: Math.round(moderate * 0.5), moderate, luxury: Math.round(moderate * 2.3) };
}

const SEASON_NAMES_N = ["Winter", "Spring", "Summer", "Autumn"];
const QUARTERS = [
  [11, 0, 1],
  [2, 3, 4],
  [5, 6, 7],
  [8, 9, 10],
] as const;
const short = (m: number) => MONTH_NAMES[m]!.slice(0, 3);

/** Four seasons with real temperatures, rain and a crowd/cost estimate. */
export function seasonsFromClimate(climate: MonthClimate[], lat: number): Season[] {
  const tropical = Math.abs(lat) < 23.5;
  const south = lat < 0;
  const rows = QUARTERS.map((ms, qi) => {
    const cs = ms.map((m) => climate[m]!);
    const max = Math.round(cs.reduce((s, c) => s + c.max, 0) / 3);
    const min = Math.round(cs.reduce((s, c) => s + c.min, 0) / 3);
    const rainy = Math.round(cs.reduce((s, c) => s + c.rainyDays, 0) / 3);
    const score = Math.round(cs.reduce((s, c) => s + comfortScore(c), 0) / 3);
    const label = tropical
      ? rainy >= 12
        ? "Rainy season"
        : "Dry season"
      : SEASON_NAMES_N[south ? (qi + 2) % 4 : qi]!;
    return { ms, max, min, rainy, score, label };
  });
  // Warmest & most comfortable seasons draw the most visitors (and the highest prices).
  const byScore = [...rows].sort((a, b) => b.score - a.score);
  return rows.map((r) => {
    const rank = byScore.indexOf(r);
    const crowd = (rank === 0 ? 3 : rank === 3 ? 1 : 2) as 1 | 2 | 3;
    const weather = `${r.max >= 28 ? "Hot" : r.max >= 20 ? "Warm" : r.max >= 12 ? "Mild" : r.max >= 4 ? "Cool" : "Cold"}${r.rainy >= 12 ? ", often rainy" : r.rainy >= 7 ? ", some rain" : ", mostly dry"}`;
    return {
      label:
        r.label === "Rainy season" || r.label === "Dry season"
          ? `${r.label} (${short(r.ms[0])}–${short(r.ms[2])})`
          : r.label,
      months: `${short(r.ms[0])} – ${short(r.ms[2])}`,
      startMonth: r.ms[0],
      weather,
      temp: `${r.min}–${r.max}°C`,
      cost: crowd,
      crowd,
      highlight:
        rank === 0
          ? "Peak season: the best weather of the year"
          : rank === 3
            ? "Quiet season with the lowest prices"
            : "Shoulder season: a sweet spot",
      why: `About ${r.rainy} rainy days a month and highs around ${r.max}°C.`,
      recommended: rank === 1 || (rank === 0 && crowd < 3),
    };
  });
}

function guessTags(population: number, lat: number, extract = ""): Interest[] {
  const t = new Set<Interest>(["Food", "Photography"]);
  if (/beach|coast|island|sea|bay/i.test(extract)) t.add("Beaches");
  if (/museum|art|galler/i.test(extract)) t.add("Art");
  if (/historic|ancient|medieval|century|old town|unesco/i.test(extract)) t.add("History");
  if (/mountain|park|lake|nature|forest|alps/i.test(extract)) t.add("Nature");
  if (population > 1_500_000) {
    t.add("Shopping");
    t.add("Nightlife");
  }
  if (Math.abs(lat) < 25) t.add("Beaches");
  return [...t].slice(0, 5);
}

/** Build a full City from a geocoding result. Cities already known are reused. */
export async function buildCity(g: GeoResult, today: string): Promise<City> {
  const existing = allCities().find(
    (c) =>
      c.name.toLowerCase() === g.name.toLowerCase() &&
      Math.abs(c.lat - g.lat) < 0.3 &&
      Math.abs(c.lng - g.lng) < 0.3,
  );
  if (existing) return existing;
  const [summary, climate] = await Promise.all([
    citySummary(g.name)
      .then((s) =>
        s?.description &&
        /city|town|capital|municipality|village|island|commune|resort/i.test(s.description)
          ? s
          : citySummary(`${g.name}, ${g.country}`),
      )
      .catch(() => null),
    getMonthlyClimate(g.lat, g.lng, today).catch(() => null),
  ]);
  const seasons = climate ? seasonsFromClimate(climate, g.lat) : [];
  const first = summary?.extract?.split(/(?<=\.)\s/)[0];
  return {
    id: `geo-${g.geoId}`,
    name: g.name,
    country: g.country,
    region: g.region || g.country,
    image:
      summary?.image ??
      (await findPhoto({
        name: g.name,
        context: g.country,
        lat: g.lat,
        lng: g.lng,
        radius: 3000,
      }).catch(() => undefined)) ??
      placeholderImage("Neighborhood", g.name),
    blurb: first && first.length < 160 ? first : `Discover ${g.name}, ${g.country}.`,
    overview:
      summary?.extract ??
      `${g.name} is waiting to be explored. We'll pull in its best sights, food and hidden gems as you plan.`,
    tags: guessTags(g.population, g.lat, summary?.extract),
    lat: g.lat,
    lng: g.lng,
    timezone: g.timezone,
    idealDays:
      g.population > 2_000_000 ? "4–6 days" : g.population > 300_000 ? "3–4 days" : "2–3 days",
    dailyCost: dailyCostFor(g.countryCode),
    seasons,
    source: "live",
  };
}
