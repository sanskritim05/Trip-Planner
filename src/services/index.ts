/**
 * Service layer used by screens. Data comes from free open services:
 * Open-Meteo (weather, geocoding), Wikipedia (places & photos), OpenStreetMap
 * (map tiles & routing), plus optional AI enrichment on the server.
 */
import { getCity, getPlace } from "@/data/registry";
import { addDays, tripLength } from "@/lib/dates";
import {
  generateItinerary,
  travelMinutes,
  type GenerateInput,
  type GenerateResult,
} from "@/lib/itinerary";
import type { Mode, Place } from "@/lib/types";
import { getTripWeather } from "./weather";

export const SERVICE_STATUS = {
  itinerary:
    "Smart planner: groups nearby stops, respects opening hours, dodges rain and peak crowds",
  weather: "Live forecast within 16 days; further out, last year's weather on the same dates",
  routes: "Walking & driving routes from OpenStreetMap; transit times are estimates",
  prices: "Prices are typical estimates. Check before you go",
} as const;

export const itineraryService = {
  async generate(
    input: Omit<GenerateInput, "lookup" | "weather" | "crowds"> & { cityId: string; today: string },
  ): Promise<GenerateResult & { weatherUsed: boolean }> {
    const city = getCity(input.cityId);
    let weather: GenerateInput["weather"];
    if (city) {
      const dates = Array.from(
        { length: Math.min(30, tripLength(input.startDate, input.endDate)) },
        (_, i) => addDays(input.startDate, i),
      );
      weather = await getTripWeather(city.lat, city.lng, dates, input.today).catch(() => undefined);
    }
    const res = generateItinerary({
      ...input,
      lookup: getPlace,
      crowds: true,
      ...(weather ? { weather } : {}),
    });
    return { ...res, weatherUsed: !!weather && Object.keys(weather).length > 0 };
  },
};

export const routeService = {
  estimate(a: Place, b: Place) {
    return (["walk", "transit", "drive"] as Mode[]).map((m) => ({
      mode: m,
      minutes: travelMinutes(a, b, m),
    }));
  },
  directionsUrl(to: Place, mode: Mode = "walk", from?: Place) {
    const travelmode = mode === "walk" ? "walking" : mode === "drive" ? "driving" : "transit";
    const origin = from ? `&origin=${from.lat},${from.lng}` : "";
    return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to.lat},${to.lng}&travelmode=${travelmode}`;
  },
};

/** Downscale an uploaded photo so it can be stored and synced. */
export async function compressImage(file: File, max = 1000): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}
