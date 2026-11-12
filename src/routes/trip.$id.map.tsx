import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, Navigation, Plus, Sparkles, X, Check } from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/app/MapView";
import { PlaceDetails } from "@/components/app/PlaceSheet";
import { modeIcon } from "@/components/app/Timeline";
import { Chip, EstimateNote, Page, PageHeader, money, pillButton } from "@/components/app/ui";
import { getPlace } from "@/data/registry";
import { fmtDuration, fmtTime } from "@/lib/dates";
import { useCityPlaces, useRoute } from "@/lib/hooks";
import { distanceKm, layoutDay } from "@/lib/itinerary";
import { useApp } from "@/lib/store";
import type { Mode, Place } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SERVICE_STATUS, routeService } from "@/services";
import { compareModes, legCost } from "@/services/routing";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/map")({
  validateSearch: (s: Record<string, unknown>): { day?: number } =>
    typeof s["day"] === "number" ? { day: s["day"] } : {},
  head: () => seo("Trip map", "See your itinerary on a map with routes and travel times."),
  component: TripMap,
});

const MODE_LABEL: Record<Mode, string> = { walk: "Walk", transit: "Transit", drive: "Drive" };

function TripMap() {
  const { id } = Route.useParams();
  const { day: initialDay } = Route.useSearch();
  const { getTrip, state, setState, updateTrip, today } = useApp();
  const trip = getTrip(id);
  const [dayIdx, setDayIdx] = useState(initialDay ?? 0);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(trip?.transport ?? "walk");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [showNearby, setShowNearby] = useState(true);
  const { places: cityPlaces } = useCityPlaces(trip?.cityId, trip);
  const day = trip?.days[dayIdx];
  const acts = (day?.activities ?? []).filter((a) => a.kind === "place");
  const stops = acts
    .map((a, i) => ({ place: getPlace(a.placeId)!, n: i + 1, status: a.status, act: a }))
    .filter((s) => s.place);
  const route = useRoute(
    stops.filter((s) => s.status !== "skipped").map((s) => s.place),
    mode,
  );
  const selected: Place | undefined = getPlace(sel);
  const selIdx = stops.findIndex((s) => s.place.id === sel);
  const nextStop = selIdx >= 0 ? stops[selIdx + 1] : undefined;
  const compare = useQuery({
    queryKey: ["compare", selected?.id, nextStop?.place.id],
    enabled: !!selected && !!nextStop,
    queryFn: () => compareModes(selected!, nextStop!.place),
    staleTime: Infinity,
  });
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const inTrip = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.placeId)));
  const anchor = selected ?? stops[0]?.place;
  const nearby = anchor
    ? cityPlaces
        .filter((p) => !inTrip.has(p.id) && p.id !== anchor.id && distanceKm(anchor, p) < 2.5)
        .sort((a, b) => distanceKm(anchor, a) - distanceKm(anchor, b))
        .slice(0, 6)
    : [];
  const legs = route.data?.legs ?? [];
  const totalMin = legs.reduce((s, l) => s + l.minutes, 0);
  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  const ModeIcon = modeIcon[mode];

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const first = stops[0]?.place;
        if (first && distanceKm(here, first) > 60)
          toast(
            `You're about ${Math.round(distanceKm(here, first))} km away. Your dot shows up once you're nearby.`,
          );
        else setMe(here);
        if (!state.settings.shareLocation)
          setState((s) => ({ ...s, settings: { ...s.settings, shareLocation: true } }));
      },
      () => toast.error("Location permission was denied"),
    );
  };
  const addToDay = (p: Place) => {
    updateTrip(id, (t) => ({
      ...t,
      places: t.places.some((x) => x.placeId === p.id)
        ? t.places
        : [...t.places, { placeId: p.id, source: "swipe", priority: false }],
      days: t.days.map((d, i) => {
        if (i !== dayIdx) return d;
        // Slot it right after the closest stop to keep the route tidy.
        const idx = d.activities.reduce(
          (best, a, j) => {
            const q = getPlace(a.placeId);
            return q && distanceKm(q, p) < (best.km ?? Infinity)
              ? { j, km: distanceKm(q, p) }
              : best;
          },
          { j: d.activities.length - 1, km: undefined as number | undefined },
        ).j;
        const arr = [...d.activities];
        arr.splice(idx + 1, 0, {
          id: `${p.id}-m${Date.now() % 10000}`,
          kind: "place",
          placeId: p.id,
          start: 0,
          duration: p.duration,
          travelMin: 0,
          status: "pending",
        });
        return {
          ...d,
          activities: layoutDay(arr, getPlace, t.startHour * 60, t.transport).activities,
        };
      }),
    }));
    toast.success(`Added ${p.name} to Day ${dayIdx + 1}`);
    setSel(p.id);
  };

  return (
    <Page wide>
      <PageHeader
        title="Trip map"
        subtitle={`Day ${dayIdx + 1} · ${stops.length} stops${legs.length ? ` · ${fmtDuration(totalMin)} on the move (${totalKm.toFixed(1)} km)` : ""}`}
        action={
          <button
            onClick={locate}
            aria-label="Show my location"
            className="tap flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        }
      />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
        {trip.days.map((d, i) => (
          <Chip
            key={d.date}
            selected={i === dayIdx}
            onClick={() => {
              setDayIdx(i);
              setSel(null);
            }}
          >
            Day {i + 1}
          </Chip>
        ))}
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div>
          <MapView
            className="h-[52vh] min-h-80"
            stops={stops}
            extra={showNearby ? nearby : []}
            me={me}
            route={route.data?.coords ?? null}
            selectedId={sel}
            onSelect={setSel}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-sea" />
              Visited
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-primary" />
              Up next
            </span>
            <button onClick={() => setShowNearby(!showNearby)} className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-butter ring-1 ring-border" />
              Nearby ideas {showNearby ? "(on)" : "(off)"}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {(["walk", "transit", "drive"] as Mode[]).map((m) => {
              const I = modeIcon[m];
              return (
                <Chip key={m} selected={mode === m} onClick={() => setMode(m)}>
                  <span className="flex items-center gap-1.5">
                    <I className="h-4 w-4" />
                    {MODE_LABEL[m]}
                  </span>
                </Chip>
              );
            })}
          </div>
        </div>

        <aside>
          {selected ? (
            <div className="overflow-hidden rounded-3xl bg-card p-4 shadow-soft animate-in fade-in slide-in-from-bottom-2">
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="font-display text-xl font-semibold leading-tight">
                  {selIdx >= 0 ? `${selIdx + 1}. ` : ""}
                  {selected.name}
                </p>
                <button
                  onClick={() => setSel(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <PlaceDetails
                place={selected}
                date={day?.date ?? today}
                {...(selIdx >= 0 ? { scheduledAt: stops[selIdx]!.act.start } : {})}
              />
              {selIdx < 0 && (
                <button
                  onClick={() => addToDay(selected)}
                  className={pillButton({ className: "mt-3 w-full" })}
                >
                  <Plus className="h-4 w-4" />
                  Add to Day {dayIdx + 1}
                </button>
              )}
              {nextStop && (
                <div className="mt-4 border-t pt-3 text-sm">
                  <p className="font-bold">
                    Getting to stop {selIdx + 2}: {nextStop.place.name}
                  </p>
                  {compare.data ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["walk", "transit", "drive"] as Mode[]).map((m) => {
                        const I = modeIcon[m];
                        const l = compare.data.legs[m];
                        return (
                          <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                              "rounded-2xl p-2 text-left text-xs font-bold",
                              compare.data.suggested === m
                                ? "bg-primary-soft ring-2 ring-primary"
                                : "bg-secondary",
                            )}
                          >
                            <I className="mb-1 h-4 w-4" />
                            {fmtDuration(l.minutes)}
                            <br />
                            <span className="text-muted-foreground">
                              {legCost(m, l.km) ? `~${money(legCost(m, l.km))}` : "free"}
                            </span>
                            {compare.data.suggested === m && (
                              <span className="mt-1 flex items-center gap-0.5 text-primary-strong">
                                <Sparkles className="h-3 w-3" />
                                best
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Comparing routes…</p>
                  )}
                </div>
              )}
              <a
                href={routeService.directionsUrl(
                  selected,
                  mode,
                  selIdx > 0 ? stops[selIdx - 1]!.place : undefined,
                )}
                target="_blank"
                rel="noreferrer"
                className={pillButton({ variant: "outline", size: "sm", className: "mt-3 w-full" })}
              >
                <Navigation className="h-4 w-4" />
                Turn-by-turn directions
              </a>
            </div>
          ) : (
            <ul className="space-y-2">
              {stops.map((s, i) => (
                <li key={s.act.id}>
                  {i > 0 && legs[i - 1] && s.status !== "skipped" && (
                    <p className="ml-4 flex items-center gap-1.5 py-1 text-xs font-bold text-muted-foreground">
                      <ModeIcon className="h-3.5 w-3.5" />
                      {fmtDuration(legs[i - 1]!.minutes)} · {legs[i - 1]!.km} km
                    </p>
                  )}
                  <button
                    onClick={() => setSel(s.place.id)}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-primary-foreground",
                        s.status === "done"
                          ? "bg-sea"
                          : s.status === "skipped"
                            ? "bg-muted-foreground"
                            : "bg-primary",
                      )}
                    >
                      {s.status === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{s.place.name}</span>
                      <span className="text-xs text-muted-foreground">{fmtTime(s.act.start)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {nearby.length > 0 && (
                <li className="pt-3">
                  <p className="mb-2 text-sm font-bold">Nearby ideas</p>
                  {nearby.map((p) => (
                    <div
                      key={p.id}
                      className="mb-2 flex items-center gap-2 rounded-2xl bg-card/80 p-2"
                    >
                      <button
                        onClick={() => setSel(p.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <img src={p.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{p.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {anchor ? `${distanceKm(anchor, p).toFixed(1)} km away` : p.category}
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={() => addToDay(p)}
                        aria-label={`Add ${p.name}`}
                        className="tap flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </li>
              )}
            </ul>
          )}
        </aside>
      </div>
      <div className="mt-4">
        <EstimateNote>
          {SERVICE_STATUS.routes}
          {route.data?.source === "estimate"
            ? " (live routing unavailable, showing estimates)"
            : ""}
          .
        </EstimateNote>
      </div>
    </Page>
  );
}
