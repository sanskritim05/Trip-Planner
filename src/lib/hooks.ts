import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { cityPlaces, getCity, getRegistryVersion, onRegistryChange } from "@/data/registry";
import { buildCity, searchCities, type GeoResult } from "@/services/geo";
import { discoverPlaces, enrichPlaces } from "@/services/live";
import { fillPhotos, isPlaceholderImage } from "@/services/wiki";
import { getRoute } from "@/services/routing";
import { getTripWeather, type DayWeather } from "@/services/weather";
import { addDays, tripLength } from "./dates";
import { useApp } from "./store";
import type { Mode, Place, Trip } from "./types";

/** Places we've already looked for a photo for this session, so we never search twice. */
const photoTried = new Set<string>();

/** Re-render when places/cities are registered at runtime. */
export function useRegistry() {
  return useSyncExternalStore(onRegistryChange, getRegistryVersion, () => 0);
}

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * All places for a city, discovered from open data
 * (and AI-enriched when available). Discovery runs once per city and is saved.
 */
export function useCityPlaces(
  cityId: string | undefined,
  prefs?: Pick<Trip, "interests" | "dietary" | "budgetStyle">,
  /** Ask the AI to fine-tune places only while actively planning, to stay within AI rate limits. */
  opts: { enrich?: boolean } = {},
) {
  const app = useApp();
  useRegistry();
  const city = getCity(cityId);
  // A thin result (e.g. the open-data API was rate-limiting) is retried on a later visit.
  const discovered =
    !!cityId &&
    Object.values(app.state.places).filter(
      (p) => p.cityId === cityId && (p.source === "wiki" || p.source === "ai"),
    ).length >= 8;
  const prefsFor = () => ({
    interests: prefs?.interests ?? app.state.prefs.activities,
    dietary: prefs?.dietary ?? app.state.prefs.dietary,
    budgetStyle: prefs?.budgetStyle ?? app.state.prefs.budget,
  });
  // 1) Open data first, so places appear right away.
  const q = useQuery({
    queryKey: ["city-places", cityId],
    enabled: !!city && !discovered,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const list = await discoverPlaces(city!, cityPlaces(city!.id));
      app.savePlaces(list);
      return list.length;
    },
  });
  // 2) Then, if AI is on, quietly upgrade the top places and add tailored picks.
  const enriched =
    !!cityId &&
    Object.values(app.state.places).some((p) => p.cityId === cityId && p.source === "ai");
  const e = useQuery({
    queryKey: ["city-enrich", cityId],
    enabled:
      !!city &&
      app.ai &&
      !q.isFetching &&
      !enriched &&
      Object.values(app.state.places).some((p) => p.cityId === cityId && p.source === "wiki"),
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const ranked = cityPlaces(city!.id).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
      const list = await enrichPlaces(city!, ranked, prefsFor());
      if (list) app.savePlaces(list);
      return list?.length ?? 0;
    },
  });
  const places = useMemo(() => (cityId ? cityPlaces(cityId) : []), [cityId, app.state.places]); // eslint-disable-line react-hooks/exhaustive-deps
  // 3) Finally, find real photos for anything still showing a placeholder.
  const needPhotos = places
    .filter((p) => isPlaceholderImage(p.image) && !photoTried.has(p.id))
    .map((p) => p.id);
  useQuery({
    queryKey: ["city-photos", cityId, needPhotos.join(",")],
    enabled: !!city && needPhotos.length > 0 && !q.isFetching && !e.isFetching,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      needPhotos.forEach((id) => photoTried.add(id));
      const todo = cityPlaces(city!.id).filter((p) => needPhotos.includes(p.id));
      const filled = await fillPhotos(todo, () => city!.name);
      const changed = filled.filter((p, i) => p.image !== todo[i]!.image);
      if (changed.length) app.savePlaces(changed);
      return changed.length;
    },
  });
  return { places, loading: q.isFetching, enriching: e.isFetching, failed: q.isError, ai: app.ai };
}

/** Weather for each day of a trip (forecast within 16 days, otherwise last year's conditions). */
export function useTripWeather(trip: Pick<Trip, "cityId" | "startDate" | "endDate"> | undefined) {
  const { today } = useApp();
  const city = getCity(trip?.cityId);
  const dates =
    trip?.startDate && trip.endDate
      ? Array.from({ length: Math.min(30, tripLength(trip.startDate, trip.endDate)) }, (_, i) =>
          addDays(trip.startDate, i),
        )
      : [];
  const q = useQuery({
    queryKey: ["weather", city?.lat, city?.lng, dates[0], dates.length, today],
    enabled: !!city && dates.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () => getTripWeather(city!.lat, city!.lng, dates, today),
  });
  return { weather: (q.data ?? {}) as Record<string, DayWeather>, loading: q.isLoading };
}

/** Street route through stops (walking/driving via OSM routing, transit estimated). */
export function useRoute(points: Pick<Place, "lat" | "lng">[], mode: Mode) {
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";");
  return useQuery({
    queryKey: ["route", mode, key],
    enabled: points.length > 1,
    staleTime: Infinity,
    queryFn: () => getRoute(points, mode),
  });
}

/** Worldwide city search (debounced). */
export function useCitySearch(query: string) {
  const q = useDebounced(query.trim(), 300);
  return useQuery({
    queryKey: ["city-search", q],
    enabled: q.length >= 2,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => searchCities(q, signal),
  });
}

/** Turn a geocoding result into a saved City and return its id. */
export function useOpenCity() {
  const app = useApp();
  const [busy, setBusy] = useState<number | null>(null);
  const open = async (g: GeoResult) => {
    setBusy(g.geoId);
    try {
      const city = await buildCity(g, app.today);
      app.saveCity(city);
      return city.id;
    } finally {
      setBusy(null);
    }
  };
  return { open, busy };
}
