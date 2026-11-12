import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CloudRain,
  Loader2,
  Sparkles,
  Sun,
  Thermometer,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Card, EstimateNote, Page, PageHeader, Tag, pillButton } from "@/components/app/ui";
import { getCity } from "@/data/registry";
import { MONTH_NAMES, addDays, formatRange, tripLength } from "@/lib/dates";
import { useApp } from "@/lib/store";
import type { City } from "@/lib/types";
import { cn } from "@/lib/utils";
import { comfortScore, getMonthlyClimate, type MonthClimate } from "@/services/weather";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/best-time")({
  head: () =>
    seo("Best Time to Travel", "Compare months by weather, cost and crowds to pick your dates."),
  component: BestTime,
});

type MonthRow = {
  month: number;
  climate: MonthClimate | null;
  weather: number;
  crowd: 1 | 2 | 3;
  cost: 1 | 2 | 3;
  score: number;
  highlight: string;
};

/** Crowd & cost level for a month, from the destination's seasons (or the climate when unknown). */
function seasonFor(city: City, month: number) {
  const s = [...city.seasons]
    .sort((a, b) => ((month - b.startMonth + 12) % 12) - ((month - a.startMonth + 12) % 12))
    .pop();
  return s;
}

function rows(city: City, climate: MonthClimate[] | null): MonthRow[] {
  const weathers = climate?.map(comfortScore) ?? [];
  const ranked = [...weathers].sort((a, b) => b - a);
  return Array.from({ length: 12 }, (_, m) => {
    const c = climate?.[m] ?? null;
    const s = seasonFor(city, m);
    const weather = c ? comfortScore(c) : s ? ([0, 55, 75, 85][4 - s.crowd] ?? 60) : 60;
    // Without season data, the best-weather months are assumed busiest & priciest.
    const crowd = (s?.crowd ??
      (c && weathers.length ? (weather >= ranked[3]! ? 3 : weather <= ranked[8]! ? 1 : 2) : 2)) as
      1 | 2 | 3;
    const cost = (s?.cost ?? crowd) as 1 | 2 | 3;
    const score = Math.round(weather * 0.6 + (4 - crowd) * 10 + (4 - cost) * 6.5);
    return { month: m, climate: c, weather, crowd, cost, score, highlight: s?.highlight ?? "" };
  });
}

const dots = (n: number, label: string) => (
  <span aria-label={`${label} ${n} of 3`} className="inline-flex gap-1 align-middle">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className={cn("inline-block h-2 w-2 rounded-full bg-current", i >= n && "opacity-25")}
      />
    ))}
  </span>
);

function BestTime() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, today } = useApp();
  const navigate = useNavigate();
  const trip = getTrip(id);
  const city = getCity(trip?.cityId);
  const climate = useQuery({
    queryKey: ["climate", city?.lat, city?.lng],
    enabled: !!city,
    staleTime: Infinity,
    queryFn: () => getMonthlyClimate(city!.lat, city!.lng, today),
  });
  const data = useMemo(() => (city ? rows(city, climate.data ?? null) : []), [city, climate.data]);
  const blocked = new Set(trip?.unavailableMonths ?? []);
  const available = data.filter((r) => !blocked.has(r.month));
  const best = [...available].sort((a, b) => b.score - a.score);
  const [compare, setCompare] = useState<number[]>([]);
  const picks = compare.length ? compare : best.slice(0, 3).map((r) => r.month);
  const [chosen, setChosen] = useState<number | null>(null);
  if (!trip || !city)
    return (
      <Page>
        <PageHeader title="Best time to travel" subtitle="Pick a destination first." />
      </Page>
    );
  const len = trip.startDate && trip.endDate ? tripLength(trip.startDate, trip.endDate) : 5;
  const top = chosen ?? best[0]?.month ?? null;

  const datesFor = (month: number) => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7)) - 1;
    const year = month > m ? y : y + 1;
    const start = `${year}-${String(month + 1).padStart(2, "0")}-08`;
    return { start, end: addDays(start, len - 1) };
  };
  const toggleBlocked = (m: number) =>
    updateTrip(id, (t) => ({
      ...t,
      unavailableMonths: t.unavailableMonths?.includes(m)
        ? t.unavailableMonths.filter((x) => x !== m)
        : [...(t.unavailableMonths ?? []), m],
    }));
  const toggleCompare = (m: number) =>
    setCompare((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m].slice(-3)));
  const choose = () => {
    if (top === null) return;
    const d = datesFor(top);
    updateTrip(id, (t) => ({
      ...t,
      startDate: d.start,
      endDate: d.end,
      step: Math.max(t.step, 2),
    }));
    void navigate({ to: "/create-trip", search: { tripId: id } });
  };
  const maxTemp = Math.max(30, ...data.map((r) => r.climate?.max ?? 0));

  return (
    <Page>
      <PageHeader
        title={`Best time for ${city.name}`}
        subtitle={`${len}-day trip · tap months you can't go`}
      />
      {climate.isLoading && (
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading two years of weather records…
        </p>
      )}

      {best[0] && (
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-soft via-card to-sea-soft p-5 shadow-soft">
          <p className="font-script text-2xl text-sea-strong">our pick for you</p>
          <p className="font-display text-4xl font-semibold">{MONTH_NAMES[best[0].month]}</p>
          <p className="mt-1 text-sm">
            {best[0].climate
              ? `Highs around ${best[0].climate.max}°C, ~${best[0].climate.rainyDays} rainy days, ${best[0].climate.sunHours}h of sun a day. `
              : ""}
            {best[0].crowd === 1
              ? "Quiet streets"
              : best[0].crowd === 2
                ? "Comfortable crowds"
                : "Busy but buzzing"}{" "}
            and{" "}
            {best[0].cost === 1 ? "low prices" : best[0].cost === 2 ? "fair prices" : "peak prices"}
            .
          </p>
          <p className="mt-2 text-xs font-bold text-primary-strong">
            Suggested dates:{" "}
            {formatRange(datesFor(best[0].month).start, datesFor(best[0].month).end)}
          </p>
        </div>
      )}

      <Card className="mt-5">
        <p className="mb-1 font-bold">All year at a glance</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Taller bar = better overall · tap a month to compare · tap the X under months you can't
          travel
        </p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {data.map((r) => {
            const off = blocked.has(r.month);
            const inCompare = picks.includes(r.month);
            return (
              <div key={r.month} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => (off ? toggleBlocked(r.month) : toggleCompare(r.month))}
                  aria-pressed={inCompare}
                  aria-label={`${MONTH_NAMES[r.month]}: score ${r.score}${off ? ", unavailable" : ""}`}
                  className={cn(
                    "relative flex h-24 w-full items-end overflow-hidden rounded-xl bg-secondary",
                    inCompare && !off && "ring-2 ring-primary",
                    off && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "w-full rounded-t-lg transition-all",
                      r.score >= 70 ? "bg-primary" : r.score >= 50 ? "bg-sea" : "bg-sea/40",
                    )}
                    style={{ height: `${Math.max(8, r.score)}%` }}
                  />
                  {r.climate && (
                    <span className="absolute inset-x-0 top-1 text-center text-[9px] font-bold">
                      {r.climate.max}°
                    </span>
                  )}
                </button>
                <span className="text-[11px] font-extrabold">
                  {MONTH_NAMES[r.month]!.slice(0, 3)}
                </span>
                <button
                  onClick={() => toggleBlocked(r.month)}
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    off
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                  aria-label={
                    off
                      ? `I can go in ${MONTH_NAMES[r.month]}`
                      : `I can't go in ${MONTH_NAMES[r.month]}`
                  }
                >
                  {off ? "can't" : <X className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
        {climate.data && (
          <div className="mt-4 flex h-14 items-end gap-2" aria-hidden>
            {data.map((r) => (
              <span
                key={r.month}
                className="flex-1 rounded-t bg-peach"
                style={{ height: `${((r.climate?.max ?? 0) / maxTemp) * 100}%` }}
                title={`${r.climate?.max}°C`}
              />
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-3 mt-6 text-xl font-semibold">Compare {picks.length} options</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {picks.map((m) => {
          const r = data[m]!;
          const d = datesFor(m);
          return (
            <button
              key={m}
              onClick={() => setChosen(m)}
              aria-pressed={top === m}
              className={cn(
                "tap rounded-3xl bg-card p-4 text-left shadow-soft",
                top === m && "ring-4 ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-xl font-semibold">{MONTH_NAMES[m]}</p>
                {best[0]?.month === m && (
                  <Tag tone="blush">
                    <Sparkles className="h-3 w-3" />
                    Best
                  </Tag>
                )}
              </div>
              <p className="text-xs font-bold text-primary-strong">{formatRange(d.start, d.end)}</p>
              <ul className="mt-3 space-y-1.5 text-xs font-bold">
                {r.climate && (
                  <li className="flex items-center gap-1.5">
                    <Thermometer className="h-3.5 w-3.5 text-sea" />
                    {r.climate.min}–{r.climate.max}°C
                  </li>
                )}
                {r.climate && (
                  <li className="flex items-center gap-1.5">
                    <CloudRain className="h-3.5 w-3.5 text-sea" />~{r.climate.rainyDays} rainy days
                  </li>
                )}
                {r.climate && (
                  <li className="flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-sea" />
                    {r.climate.sunHours}h sun / day
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-sea" />
                  Cost {dots(r.cost, "cost")}
                </li>
                <li className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-sea" />
                  Crowds {dots(r.crowd, "crowds")}
                </li>
              </ul>
              {r.highlight && <p className="mt-2 text-xs text-muted-foreground">{r.highlight}</p>}
              <p className="mt-2 font-display text-2xl font-semibold">
                {r.score}
                <span className="text-xs text-muted-foreground">/100</span>
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <EstimateNote>
          Weather comes from real observations over the last two years; crowds and prices are
          seasonal estimates.
        </EstimateNote>
      </div>
      <button
        onClick={choose}
        disabled={top === null}
        className={pillButton({ size: "lg", className: "mt-6 w-full" })}
      >
        <CalendarCheck className="h-4 w-4" />
        Use {top !== null ? MONTH_NAMES[top] : "these"} dates
      </button>
    </Page>
  );
}
