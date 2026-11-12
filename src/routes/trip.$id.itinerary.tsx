import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarHeart,
  CheckCircle2,
  CloudRain,
  Map,
  PencilLine,
  Plus,
  RefreshCw,
  Umbrella,
  Users,
  Wallet,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceRow } from "@/components/app/cards";
import { Timeline } from "@/components/app/Timeline";
import { WeatherChip } from "@/components/app/Weather";
import { Burst } from "@/components/app/whimsy";
import {
  EmptyState,
  EstimateNote,
  Modal,
  Page,
  PageHeader,
  Tag,
  money,
  pillButton,
} from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { estimateBudget, total } from "@/lib/budget";
import { addDays, formatRange, fmtDuration, weekday, formatShort } from "@/lib/dates";
import { useCityPlaces, useTripWeather } from "@/lib/hooks";
import { generateItinerary, isIndoor, layoutDay, replanDay } from "@/lib/itinerary";
import { useApp } from "@/lib/store";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SERVICE_STATUS, itineraryService } from "@/services";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/itinerary")({
  head: () => seo("Itinerary", "Your day-by-day travel plan."),
  component: Itinerary,
});

function Itinerary() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, notify, today } = useApp();
  const trip = getTrip(id);
  const [dayIdx, setDayIdx] = useState(0);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const { places: cityPlaces } = useCityPlaces(trip?.cityId, trip);
  const { weather } = useTripWeather(trip);
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const city = getCity(trip.cityId);
  const day = trip.days[Math.min(dayIdx, trip.days.length - 1)];
  const dayWeather = day ? weather[day.date] : undefined;
  const priorityIds = new Set(
    trip.places
      .filter((p) => p.priority || p.source === "must" || p.source === "bucket")
      .map((p) => p.placeId),
  );
  const estTotal = total(estimateBudget(trip));
  const over = trip.budget > 0 && estTotal > trip.budget;
  const scheduled = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.placeId)));
  const addable = cityPlaces.filter((p) => !scheduled.has(p.id));
  const outdoorToday =
    day?.activities.filter(
      (a) =>
        a.status === "pending" &&
        a.kind === "place" &&
        getPlace(a.placeId) &&
        !isIndoor(getPlace(a.placeId)!),
    ) ?? [];

  const relayout = (acts: Activity[]) =>
    layoutDay(acts, getPlace, trip.startHour * 60, trip.transport).activities;
  const setDay = (fn: (acts: Activity[]) => Activity[]) =>
    updateTrip(id, (t) => ({
      ...t,
      days: t.days.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              activities: layoutDay(fn(d.activities), getPlace, t.startHour * 60, t.transport)
                .activities,
            }
          : d,
      ),
    }));
  const move = (a: Activity, dir: -1 | 1) =>
    setDay((acts) => {
      const arr = [...acts];
      const i = arr.findIndex((x) => x.id === a.id);
      const j = i + dir;
      if (j < 0 || j >= arr.length || arr[j]?.status !== "pending") return acts;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return arr;
    });
  const remove = (a: Activity) => {
    setDay((acts) => acts.filter((x) => x.id !== a.id));
    if (a.placeId)
      updateTrip(id, (t) => ({
        ...t,
        unscheduled: [
          ...t.unscheduled.filter((u) => u.placeId !== a.placeId),
          { placeId: a.placeId!, reason: "You removed this from the plan." },
        ],
      }));
  };
  const regenerate = () => {
    if (!day) return;
    const ids = day.activities
      .filter((a) => a.placeId && a.status === "pending")
      .map((a) => a.placeId!);
    const res = generateItinerary({
      startDate: day.date,
      endDate: day.date,
      selected: ids.map((placeId) => ({
        placeId,
        source: "swipe",
        priority: priorityIds.has(placeId),
      })),
      lookup: getPlace,
      pace: trip.pace,
      mode: trip.transport,
      startHour: trip.startHour,
      crowds: true,
      ...(Object.keys(weather).length ? { weather } : {}),
    });
    const fresh = res.days[0]?.activities ?? [];
    updateTrip(id, (t) => ({
      ...t,
      days: t.days.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              activities: relayout([
                ...d.activities.filter((a) => a.status !== "pending"),
                ...fresh.map((a) => ({ ...a, id: `${a.id}-r${Date.now() % 1000}` })),
              ]),
            }
          : d,
      ),
      unscheduled: [...t.unscheduled, ...res.unscheduled],
    }));
    toast.success(`Day ${dayIdx + 1} re-planned around opening hours, crowds & weather`);
  };
  /** Rainy day: trade outdoor stops with indoor ones from a drier day, or swap in nearby indoor places. */
  const rainProof = () => {
    if (!day) return;
    const dryIdx = trip.days.findIndex(
      (d, i) =>
        i !== dayIdx &&
        !weather[d.date]?.rainy &&
        d.activities.some(
          (a) => a.status === "pending" && getPlace(a.placeId) && isIndoor(getPlace(a.placeId)!),
        ),
    );
    if (dryIdx >= 0) {
      const dry = trip.days[dryIdx]!;
      const indoorThere = dry.activities.filter(
        (a) => a.status === "pending" && getPlace(a.placeId) && isIndoor(getPlace(a.placeId)!),
      );
      const n = Math.min(indoorThere.length, outdoorToday.length);
      const give = outdoorToday.slice(0, n);
      const take = indoorThere.slice(0, n);
      updateTrip(id, (t) => ({
        ...t,
        days: t.days.map((d, i) =>
          i === dayIdx
            ? {
                ...d,
                activities: relayout([...d.activities.filter((a) => !give.includes(a)), ...take]),
              }
            : i === dryIdx
              ? {
                  ...d,
                  activities: relayout([...d.activities.filter((a) => !take.includes(a)), ...give]),
                }
              : d,
        ),
      }));
      toast.success(
        `Swapped ${n} outdoor stop${n > 1 ? "s" : ""} with Day ${dryIdx + 1}, which looks drier`,
      );
      if (n >= outdoorToday.length) return;
    }
    const res = replanDay(
      trip.days[dayIdx]!,
      { type: "rain", candidates: addable.map((p) => p.id) },
      {
        lookup: getPlace,
        mode: trip.transport,
        nowMin: trip.startHour * 60,
        startHour: trip.startHour,
        priorityIds,
      },
    );
    updateTrip(id, (t) => ({ ...t, days: t.days.map((d, i) => (i === dayIdx ? res.day : d)) }));
    res.notes.forEach((n) => toast(n));
  };
  const addDayAndReplan = async () => {
    setBusy(true);
    const endDate = addDays(trip.endDate, 1);
    const res = await itineraryService.generate({
      cityId: trip.cityId,
      today,
      startDate: trip.startDate,
      endDate,
      selected: trip.places,
      pace: trip.pace,
      mode: trip.transport,
      startHour: trip.startHour,
    });
    updateTrip(id, (t) => ({ ...t, endDate, days: res.days, unscheduled: res.unscheduled }));
    setBusy(false);
    toast.success(
      res.unscheduled.length
        ? `Added a day, but ${res.unscheduled.length} still don't fit`
        : "Added a day. Everything fits now!",
    );
  };
  const confirm = () => {
    updateTrip(id, (t) => ({ ...t, status: "planned", confirmed: true, step: 10 }));
    notify({
      title: `${trip.name} is confirmed`,
      body: "We'll remind you before you leave.",
      kind: "reminder",
      link: `/trip/${id}/itinerary`,
    });
    setBurst((b) => b + 1);
    toast.success("Trip confirmed! Bon voyage");
  };

  return (
    <Page>
      <PageHeader
        title={trip.name || city?.name || "Itinerary"}
        subtitle={`${city?.name}, ${city?.country}`}
        backTo="/trips"
        action={
          <Link
            to="/create-trip"
            search={{ tripId: id, step: 1 }}
            className={pillButton({ variant: "outline", size: "sm" })}
          >
            <PencilLine className="h-4 w-4" />
            Edit Trip
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Tag tone="blush">
          <CalendarHeart className="h-3.5 w-3.5" />
          {trip.startDate ? formatRange(trip.startDate, trip.endDate) : "No dates"}
        </Tag>
        <Tag tone="butter">{trip.days.length} days</Tag>
        <Tag tone={over ? "peach" : "sea"}>
          <Wallet className="h-3.5 w-3.5" />~{money(estTotal, trip.currency)} est. of{" "}
          {money(trip.budget, trip.currency)}
        </Tag>
        {trip.group && (
          <Tag tone="lilac">
            <Users className="h-3.5 w-3.5" />
            {trip.group.members.length} travelers{trip.group.shared ? " · live" : ""}
          </Tag>
        )}
        {trip.confirmed ? (
          <Tag tone="mint">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirmed
          </Tag>
        ) : (
          <Tag tone="sand">Not confirmed yet</Tag>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/trip/$id/map"
          params={{ id }}
          search={{ day: dayIdx }}
          className={pillButton({ variant: "soft", size: "sm" })}
        >
          <Map className="h-4 w-4" />
          View on Map
        </Link>
        <Link
          to="/trip/$id/budget"
          params={{ id }}
          className={pillButton({ variant: "soft", size: "sm" })}
        >
          <Wallet className="h-4 w-4" />
          Budget
        </Link>
        <Link
          to="/trip/$id/group"
          params={{ id }}
          className={pillButton({ variant: "soft", size: "sm" })}
        >
          <Users className="h-4 w-4" />
          {trip.group ? "Group" : "Invite friends"}
        </Link>
      </div>

      {over && (
        <Link
          to="/trip/$id/budget"
          params={{ id }}
          className="tap mt-4 flex items-center gap-3 rounded-3xl bg-peach p-4 text-sm font-bold"
        >
          <Wallet className="h-5 w-5 text-primary-strong" />
          <span className="flex-1">
            This plan runs about {money(estTotal - trip.budget, trip.currency)} over budget. See
            cheaper swaps →
          </span>
        </Link>
      )}

      {!trip.days.length ? (
        <div className="mt-6">
          <EmptyState
            icon={<CalendarHeart className="h-6 w-6" />}
            title="No itinerary yet"
            body="Review your places and generate a plan."
          >
            <Link to="/trip/$id/review" params={{ id }} className={pillButton()}>
              Review places
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <div
            className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-2"
            role="tablist"
          >
            {trip.days.map((d, i) => (
              <button
                key={d.date}
                role="tab"
                aria-selected={i === dayIdx}
                onClick={() => setDayIdx(i)}
                className={cn(
                  "tap shrink-0 rounded-2xl px-4 py-2 text-left",
                  i === dayIdx ? "bg-foreground text-background shadow-soft" : "bg-card",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-extrabold">
                  Day {i + 1} {weather[d.date] && <WeatherChip w={weather[d.date]!} compact />}
                </span>
                <span className="block text-[11px] opacity-80">
                  {weekday(d.date)}, {formatShort(d.date)}
                </span>
              </button>
            ))}
          </div>
          {day && (
            <div className="mt-4">
              {dayWeather && (
                <div
                  className={cn(
                    "mb-3 flex flex-wrap items-center gap-3 rounded-3xl p-3 text-sm",
                    dayWeather.rainy ? "bg-sea-soft" : "bg-butter/60",
                  )}
                >
                  <WeatherChip w={dayWeather} />
                  <span className="flex-1 font-semibold">
                    {dayWeather.summary}, {dayWeather.min}–{dayWeather.max}°C
                    {dayWeather.rainChance != null
                      ? ` · ${dayWeather.rainChance}% chance of rain`
                      : ""}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({dayWeather.source === "forecast" ? "forecast" : "typical for this date"})
                    </span>
                  </span>
                  {dayWeather.rainy && outdoorToday.length > 0 && (
                    <button
                      onClick={rainProof}
                      className={pillButton({ variant: "sea", size: "xs" })}
                    >
                      <Umbrella className="h-3.5 w-3.5" />
                      Rain-proof this day
                    </button>
                  )}
                </div>
              )}
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-muted-foreground">
                  {day.activities.filter((a) => a.kind === "place").length} stops ·{" "}
                  {fmtDuration(day.activities.reduce((s, a) => s + a.duration + a.travelMin, 0))}
                  <span className="hidden font-semibold lg:inline"> · drag stops to reorder</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdding(true)}
                    className={pillButton({ variant: "outline", size: "xs" })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                  <button
                    onClick={regenerate}
                    className={pillButton({ variant: "outline", size: "xs" })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-plan day
                  </button>
                </div>
              </div>
              {day.activities.length ? (
                <Timeline
                  activities={day.activities}
                  mode={trip.transport}
                  priorityIds={priorityIds}
                  editable
                  onEdit={setEditing}
                  onRemove={remove}
                  onMove={move}
                  onReorder={(from, to) =>
                    setDay((acts) => {
                      const arr = [...acts];
                      const i = arr.findIndex((x) => x.id === from);
                      const j = arr.findIndex((x) => x.id === to);
                      if (i < 0 || j < 0) return acts;
                      const [item] = arr.splice(i, 1);
                      arr.splice(j, 0, item!);
                      return arr;
                    })
                  }
                  date={day.date}
                  rainy={!!dayWeather?.rainy}
                />
              ) : (
                <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground">
                  A free day! Add something or enjoy wandering.
                </p>
              )}
            </div>
          )}
          {trip.unscheduled.length > 0 && (
            <div className="mt-6 rounded-3xl bg-peach/70 p-4">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 text-primary-strong" />
                Not in the plan ({trip.unscheduled.length})
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {trip.unscheduled.map((u) => (
                  <li key={u.placeId}>
                    <b>{getPlace(u.placeId)?.name}:</b> {u.reason}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => void addDayAndReplan()}
                  className={pillButton({ variant: "dark", size: "xs" })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {busy ? "Re-planning…" : "Add a day & re-plan"}
                </button>
                <button
                  onClick={() => updateTrip(id, (t) => ({ ...t, unscheduled: [] }))}
                  className={pillButton({ variant: "outline", size: "xs" })}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="mt-4">
            <EstimateNote>
              {SERVICE_STATUS.itinerary}. {SERVICE_STATUS.prices}.
            </EstimateNote>
          </div>
          <div className="relative mt-6 flex items-center gap-3">
            <Burst trigger={burst} />
            <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <Check className="h-3.5 w-3.5" />
              Saved automatically
            </p>
            <button
              onClick={confirm}
              disabled={trip.confirmed && trip.status === "planned"}
              className={pillButton({ size: "lg", className: "flex-1" })}
            >
              <CheckCircle2 className="h-4 w-4" />
              {trip.confirmed && trip.status === "planned" ? "Trip confirmed" : "Confirm Trip"}
            </button>
          </div>
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${getPlace(editing?.placeId)?.name ?? editing?.label ?? "activity"}`}
      >
        {editing && (
          <div className="space-y-4">
            <p className="text-sm font-bold">How long do you want here?</p>
            <div className="flex flex-wrap gap-2">
              {[30, 45, 60, 90, 120, 150, 180, 240].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setDay((acts) =>
                      acts.map((a) => (a.id === editing.id ? { ...a, duration: m } : a)),
                    );
                    setEditing(null);
                  }}
                  className={cn(
                    "tap rounded-full border px-4 py-2 text-sm font-bold",
                    editing.duration === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card",
                  )}
                >
                  {fmtDuration(m)}
                </button>
              ))}
            </div>
            {trip.days.length > 1 && editing.kind === "place" && (
              <>
                <p className="text-sm font-bold">Move to another day</p>
                <div className="flex flex-wrap gap-2">
                  {trip.days.map(
                    (d, i) =>
                      i !== dayIdx && (
                        <button
                          key={d.date}
                          onClick={() => {
                            const act = editing;
                            updateTrip(id, (t) => ({
                              ...t,
                              days: t.days.map((dd, di) => {
                                if (di === dayIdx)
                                  return {
                                    ...dd,
                                    activities: layoutDay(
                                      dd.activities.filter((a) => a.id !== act.id),
                                      getPlace,
                                      t.startHour * 60,
                                      t.transport,
                                    ).activities,
                                  };
                                if (di === i)
                                  return {
                                    ...dd,
                                    activities: layoutDay(
                                      [...dd.activities, { ...act, status: "pending" }],
                                      getPlace,
                                      t.startHour * 60,
                                      t.transport,
                                    ).activities,
                                  };
                                return dd;
                              }),
                            }));
                            setEditing(null);
                          }}
                          className={pillButton({ variant: "outline", size: "sm" })}
                        >
                          Day {i + 1}
                          {weather[d.date]?.rainy ? " (rain)" : ""}
                        </button>
                      ),
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title={`Add to Day ${dayIdx + 1}`}>
        <div className="space-y-2">
          <button
            onClick={() => {
              setDay((acts) => [
                ...acts,
                {
                  id: `meal-x${Date.now() % 10000}`,
                  kind: "meal",
                  placeId: null,
                  label: "Café break",
                  start: 0,
                  duration: 45,
                  travelMin: 0,
                  status: "pending",
                },
              ]);
              setAdding(false);
            }}
            className={pillButton({ variant: "soft", className: "w-full" })}
          >
            + Meal or café break
          </button>
          {dayWeather?.rainy && (
            <p className="flex items-center gap-1.5 px-1 text-xs font-bold text-sea-strong">
              <CloudRain className="h-3.5 w-3.5" />
              Rain expected: indoor picks first
            </p>
          )}
          {[...addable]
            .sort((a, b) => (dayWeather?.rainy ? Number(isIndoor(b)) - Number(isIndoor(a)) : 0))
            .slice(0, 40)
            .map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                badge={
                  <span>
                    {p.category}
                    {isIndoor(p) ? " · indoors" : ""}
                  </span>
                }
                onClick={() => {
                  setDay((acts) => [
                    ...acts,
                    {
                      id: `${p.id}-d${dayIdx}-${Date.now() % 1000}`,
                      kind: "place",
                      placeId: p.id,
                      start: 0,
                      duration: p.duration,
                      travelMin: 0,
                      status: "pending",
                    },
                  ]);
                  updateTrip(id, (t) => ({
                    ...t,
                    places: t.places.some((x) => x.placeId === p.id)
                      ? t.places
                      : [...t.places, { placeId: p.id, source: "swipe", priority: false }],
                    unscheduled: t.unscheduled.filter((u) => u.placeId !== p.id),
                  }));
                  setAdding(false);
                }}
              />
            ))}
        </div>
      </Modal>
    </Page>
  );
}
