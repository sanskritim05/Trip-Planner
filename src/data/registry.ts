import { tidy } from "@/lib/text";
import type { City, Place } from "@/lib/types";

/*
 * Runtime registry of every place and city the app knows about. Nothing is
 * hard-coded: entries come from live open data (Wikipedia, Open-Meteo), AI
 * enrichment, group suggestions and the traveler's own saved state, and are
 * registered here so the rest of the app can look them up synchronously.
 */
const livePlaces: Record<string, Place> = {};
const liveCities: Record<string, City> = {};
const listeners = new Set<() => void>();
let registryVersion = 0;

// Cleaned copies keyed by the original object, so identity stays stable across re-registers.
const cleaned = new WeakMap<object, Place | City>();

function cleanPlace(p: Place): Place {
  const hit = cleaned.get(p);
  if (hit) return hit as Place;
  const out: Place = {
    ...p,
    name: tidy(p.name),
    description: tidy(p.description),
    ...(p.funFact ? { funFact: tidy(p.funFact) } : {}),
    ...(p.film ? { film: { ...p.film, scene: tidy(p.film.scene) } } : {}),
  };
  cleaned.set(p, out);
  cleaned.set(out, out);
  return out;
}

function cleanCity(c: City): City {
  const hit = cleaned.get(c);
  if (hit) return hit as City;
  const out: City = {
    ...c,
    blurb: tidy(c.blurb),
    overview: tidy(c.overview),
    seasons: c.seasons.map((s) => ({ ...s, highlight: tidy(s.highlight), why: tidy(s.why) })),
  };
  cleaned.set(c, out);
  cleaned.set(out, out);
  return out;
}

function changed() {
  registryVersion++;
  listeners.forEach((l) => l());
}

export function registerPlaces(list: Place[]) {
  let dirty = false;
  for (const raw of list) {
    const x = cleanPlace(raw);
    if (livePlaces[x.id] !== x) {
      livePlaces[x.id] = x;
      dirty = true;
    }
  }
  if (dirty) changed();
}

export function registerCities(list: City[]) {
  let dirty = false;
  for (const raw of list) {
    const c = cleanCity(raw);
    if (liveCities[c.id] !== c) {
      liveCities[c.id] = c;
      dirty = true;
    }
  }
  if (dirty) changed();
}

export function onRegistryChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getRegistryVersion() {
  return registryVersion;
}

export function getPlace(id: string | null | undefined): Place | undefined {
  return id ? livePlaces[id] : undefined;
}

export function getCity(id: string | null | undefined): City | undefined {
  return id ? liveCities[id] : undefined;
}

export function cityPlaces(cityId: string): Place[] {
  return Object.values(livePlaces).filter((x) => x.cityId === cityId);
}

/** Cities the traveler has opened, searched or saved. */
export function allCities(): City[] {
  return Object.values(liveCities);
}

export function allFilmingPlaces(): Place[] {
  return Object.values(livePlaces).filter((x) => x.film);
}
