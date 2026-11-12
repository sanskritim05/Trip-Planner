/**
 * Street routing via the public OpenStreetMap OSRM servers (free, keyless).
 * Walking and driving use real road/footpath networks; public transit has no
 * free global API, so it is estimated from distance. Every call falls back to
 * straight-line estimates if the router is unreachable.
 */
import { distanceKm } from "@/lib/itinerary";
import type { Mode } from "@/lib/types";
import { timeoutSignal } from "./http";

export type Leg = { minutes: number; km: number };
export type Route = { coords: [number, number][]; legs: Leg[]; source: "osrm" | "estimate" };
type Pt = { lat: number; lng: number };

const PROFILE: Record<Exclude<Mode, "transit">, string> = {
  walk: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  drive: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
};

const cache = new Map<string, Promise<Route>>();

/** Transit estimate: wait + ride at ~20 km/h, never faster than driving. */
export function transitMinutes(km: number) {
  return Math.max(5, Math.round((8 + km * 1.3 * 3) / 5) * 5);
}

export function estimateLeg(a: Pt, b: Pt, mode: Mode): Leg {
  const km = distanceKm(a, b) * 1.3;
  const minutes =
    mode === "walk" ? km * 12 : mode === "transit" ? transitMinutes(km / 1.3) : 5 + km * 2.2;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(3, Math.round(minutes)) };
}

function estimateRoute(points: Pt[], mode: Mode): Route {
  return {
    coords: points.map((p) => [p.lat, p.lng]),
    legs: points.slice(1).map((p, i) => estimateLeg(points[i]!, p, mode)),
    source: "estimate",
  };
}

async function fetchRoute(points: Pt[], mode: Mode): Promise<Route> {
  const base = PROFILE[mode === "transit" ? "drive" : mode];
  const coords = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson&steps=false`, {
    signal: timeoutSignal(12_000),
  });
  if (!res.ok) throw new Error(`Routing ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: {
      geometry: { coordinates: [number, number][] };
      legs: { duration: number; distance: number }[];
    }[];
  };
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) throw new Error("No route");
  return {
    coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    legs: r.legs.map((l, i) => {
      const km = Math.round((l.distance / 1000) * 10) / 10;
      // Transit follows roads but runs slower than a car, with waiting time.
      const minutes =
        mode === "transit"
          ? transitMinutes(distanceKm(points[i]!, points[i + 1]!))
          : Math.max(2, Math.round(l.duration / 60));
      return { km, minutes };
    }),
    source: "osrm",
  };
}

/** Route through the given points in order. */
export function getRoute(points: Pt[], mode: Mode): Promise<Route> {
  if (points.length < 2)
    return Promise.resolve({
      coords: points.map((p) => [p.lat, p.lng]),
      legs: [],
      source: "estimate",
    });
  const k = `${mode}|${points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";")}`;
  let hit = cache.get(k);
  if (!hit) {
    hit = fetchRoute(points, mode).catch(() => estimateRoute(points, mode));
    cache.set(k, hit);
  }
  return hit;
}

/** Compare walking / transit / driving between two stops, with a suggested choice. */
export async function compareModes(a: Pt, b: Pt) {
  const [walk, transit, drive] = await Promise.all([
    getRoute([a, b], "walk"),
    getRoute([a, b], "transit"),
    getRoute([a, b], "drive"),
  ]);
  const legs = {
    walk: walk.legs[0] ?? estimateLeg(a, b, "walk"),
    transit: transit.legs[0] ?? estimateLeg(a, b, "transit"),
    drive: drive.legs[0] ?? estimateLeg(a, b, "drive"),
  };
  return { legs, suggested: suggestMode(legs.walk.km), live: walk.source === "osrm" };
}

/** Walk short hops, take transit across town, drive long distances. */
export function suggestMode(km: number): Mode {
  if (km <= 1.8) return "walk";
  if (km <= 12) return "transit";
  return "drive";
}

/** Rough per-person cost of a leg in USD. */
export function legCost(mode: Mode, km: number) {
  if (mode === "walk") return 0;
  if (mode === "transit") return km < 1 ? 0 : 2.5;
  return Math.round(3 + km * 1.6);
}
