/**
 * Weather from Open-Meteo (free, keyless, CORS-enabled).
 *  - Dates within the 16-day window use the live forecast.
 *  - Further-out dates use what actually happened on the same dates last year
 *    ("typical"), until a forecast becomes available.
 *  - Monthly climate (temperature, rainy days, sunshine) powers Best Time to Travel.
 */
import { addDays, diffDays } from "@/lib/dates";
import { timeoutSignal } from "./http";

export type WeatherIcon = "sun" | "partly" | "cloud" | "fog" | "rain" | "storm" | "snow";
export type DayWeather = {
  date: string;
  code: number;
  icon: WeatherIcon;
  summary: string;
  max: number;
  min: number;
  precip: number; // mm
  rainChance: number | null; // % (forecast only)
  rainy: boolean;
  source: "forecast" | "typical";
};

export function describeCode(code: number): { icon: WeatherIcon; summary: string } {
  if (code === 0) return { icon: "sun", summary: "Clear & sunny" };
  if (code <= 2) return { icon: "partly", summary: "Mostly sunny" };
  if (code === 3) return { icon: "cloud", summary: "Overcast" };
  if (code === 45 || code === 48) return { icon: "fog", summary: "Foggy" };
  if (code >= 51 && code <= 57) return { icon: "rain", summary: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { icon: "rain", summary: code >= 80 ? "Showers" : "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { icon: "snow", summary: "Snow" };
  if (code >= 95) return { icon: "storm", summary: "Thunderstorms" };
  return { icon: "partly", summary: "Mild" };
}

type Daily = {
  time: string[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  sunshine_duration?: (number | null)[];
};

const cache = new Map<string, DayWeather>();
const key = (lat: number, lng: number, date: string) =>
  `${lat.toFixed(2)},${lng.toFixed(2)}|${date}`;

function toDay(d: Daily, i: number, source: DayWeather["source"], date = d.time[i]!): DayWeather {
  const code = d.weather_code[i] ?? 1;
  const precip = d.precipitation_sum[i] ?? 0;
  const chance = d.precipitation_probability_max?.[i] ?? null;
  const { icon, summary } = describeCode(code);
  const rainy = icon === "rain" || icon === "storm" || precip >= 4 || (chance ?? 0) >= 65;
  return {
    date,
    code,
    icon,
    summary,
    max: Math.round(d.temperature_2m_max[i] ?? 0),
    min: Math.round(d.temperature_2m_min[i] ?? 0),
    precip,
    rainChance: chance,
    rainy,
    source,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: timeoutSignal(15_000) });
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  return res.json() as Promise<T>;
}

/** Weather for each date: forecast where possible, otherwise last year's conditions. */
export async function getTripWeather(
  lat: number,
  lng: number,
  dates: string[],
  today: string,
): Promise<Record<string, DayWeather>> {
  const out: Record<string, DayWeather> = {};
  const need = dates.filter((d) => {
    const hit = cache.get(key(lat, lng, d));
    if (hit) out[d] = hit;
    return !hit;
  });
  if (!need.length) return out;
  const forecastDates = need.filter((d) => diffDays(today, d) >= -2 && diffDays(today, d) <= 15);
  const typicalDates = need.filter((d) => !forecastDates.includes(d));
  const jobs: Promise<void>[] = [];

  if (forecastDates.length) {
    const start = forecastDates.reduce((a, b) => (a < b ? a : b));
    const end = forecastDates.reduce((a, b) => (a > b ? a : b));
    jobs.push(
      getJson<{ daily: Daily }>(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&start_date=${start}&end_date=${end}`,
      ).then(({ daily }) => {
        daily.time.forEach((t, i) => {
          if (!forecastDates.includes(t)) return;
          const w = toDay(daily, i, "forecast");
          cache.set(key(lat, lng, t), w);
          out[t] = w;
        });
      }),
    );
  }
  if (typicalDates.length) {
    // Same calendar dates, one year earlier (or two, if last year's are still too recent for the archive).
    const shift = (d: string) => {
      const back = addDays(d, -364);
      return diffDays(back, today) > 6 ? back : addDays(d, -728);
    };
    const past = typicalDates.map(shift);
    const start = past.reduce((a, b) => (a < b ? a : b));
    const end = past.reduce((a, b) => (a > b ? a : b));
    jobs.push(
      getJson<{ daily: Daily }>(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${start}&end_date=${end}`,
      ).then(({ daily }) => {
        typicalDates.forEach((d, j) => {
          const i = daily.time.indexOf(past[j]!);
          if (i < 0) return;
          const w = toDay(daily, i, "typical", d);
          cache.set(key(lat, lng, d), w);
          out[d] = w;
        });
      }),
    );
  }
  await Promise.allSettled(jobs);
  return out;
}

export type MonthClimate = {
  month: number;
  max: number;
  min: number;
  rainyDays: number;
  precip: number;
  sunHours: number;
};

const climateCache = new Map<string, MonthClimate[]>();

/** Average conditions per month, from the last two full years of observations. */
export async function getMonthlyClimate(
  lat: number,
  lng: number,
  today: string,
): Promise<MonthClimate[]> {
  const k = `${lat.toFixed(1)},${lng.toFixed(1)}`;
  const hit = climateCache.get(k);
  if (hit) return hit;
  const y = Number(today.slice(0, 4)) - 1;
  const { daily } = await getJson<{ daily: Daily }>(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration&timezone=auto&start_date=${y - 1}-01-01&end_date=${y}-12-31`,
  );
  const acc = Array.from({ length: 12 }, () => ({
    max: 0,
    min: 0,
    rainy: 0,
    precip: 0,
    sun: 0,
    n: 0,
  }));
  daily.time.forEach((t, i) => {
    const m = Number(t.slice(5, 7)) - 1;
    const a = acc[m]!;
    if (daily.temperature_2m_max[i] == null) return;
    a.max += daily.temperature_2m_max[i] ?? 0;
    a.min += daily.temperature_2m_min[i] ?? 0;
    a.precip += daily.precipitation_sum[i] ?? 0;
    a.rainy += (daily.precipitation_sum[i] ?? 0) >= 1 ? 1 : 0;
    a.sun += (daily.sunshine_duration?.[i] ?? 0) / 3600;
    a.n++;
  });
  const res = acc.map((a, month) => ({
    month,
    max: Math.round(a.max / Math.max(1, a.n)),
    min: Math.round(a.min / Math.max(1, a.n)),
    rainyDays: Math.round((a.rainy / Math.max(1, a.n)) * 30),
    precip: Math.round((a.precip / Math.max(1, a.n)) * 30),
    sunHours: Math.round((a.sun / Math.max(1, a.n)) * 10) / 10,
  }));
  climateCache.set(k, res);
  return res;
}

/** 0–100 comfort score for sightseeing: mild temps, few rainy days, plenty of sun. */
export function comfortScore(c: MonthClimate) {
  const ideal = 23;
  const tempPenalty = Math.min(
    45,
    Math.abs(c.max - ideal) * 2.4 + (c.max > 31 ? (c.max - 31) * 3 : 0),
  );
  const rainPenalty = Math.min(35, c.rainyDays * 2.2);
  const sunBonus = Math.min(10, c.sunHours * 1.2);
  return Math.max(0, Math.min(100, Math.round(100 - tempPenalty - rainPenalty + sunBonus - 10)));
}
