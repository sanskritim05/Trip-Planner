import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Bus,
  Clock,
  CloudRain,
  Compass,
  History,
  Hourglass,
  ListRestart,
  Plus,
  SkipForward,
  Timer,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  Chip,
  EmptyState,
  EstimateNote,
  Page,
  PageHeader,
  money,
  pillButton,
} from "@/components/app/ui";
import { getPlace } from "@/data/registry";
import { fmtTime, formatShort } from "@/lib/dates";
import { useCityPlaces } from "@/lib/hooks";
import {
  distanceKm,
  findAlternatives,
  layoutDay,
  replanDay,
  suggestDayFor,
  type AssistantAction,
} from "@/lib/itinerary";
import { tripDayIndex } from "@/lib/trip-status";
import { useApp } from "@/lib/store";
import type { Day, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/assistant")({
  validateSearch: (s: Record<string, unknown>): { pick?: Pick } =>
    typeof s["pick"] === "string" && QUICK.some((q) => q.k === s["pick"])
      ? { pick: s["pick"] as Pick }
      : {},
  head: () => seo("Change my plans", "Adjust the rest of today's itinerary on the go."),
  component: Assistant,
});

type Pick =
  | "late"
  | "skip"
  | "add"
  | "nearby"
  | "mode"
  | "extend"
  | "rearrange"
  | "rain"
  | "closed"
  | "missed";
const QUICK: { k: Pick; label: string; icon: typeof Clock }[] = [
  { k: "rain", label: "It's Raining", icon: CloudRain },
  { k: "closed", label: "This Place Is Closed", icon: Ban },
  { k: "missed", label: "I Missed a Place", icon: History },
  { k: "late", label: "I'm Running Late", icon: Clock },
  { k: "skip", label: "Skip This Place", icon: SkipForward },
  { k: "add", label: "Add a Stop", icon: Plus },
  { k: "nearby", label: "Find Something Nearby", icon: Compass },
  { k: "mode", label: "Change Transportation", icon: Bus },
  { k: "extend", label: "Spend More Time Here", icon: Hourglass },
  { k: "rearrange", label: "Rearrange My Day", icon: ListRestart },
];

function Assistant() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, today } = useApp();
  const navigate = useNavigate();
  const trip = getTrip(id);
  const { pick: initialPick } = Route.useSearch();
  const [pick, setPick] = useState<Pick | null>(initialPick ?? null);
  const [missedId, setMissedId] = useState<string | null>(null);
  const { places: cityPlacesList } = useCityPlaces(trip?.cityId, trip);
  const [lateMin, setLateMin] = useState(30);
  const [addId, setAddId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(trip?.transport ?? "walk");
  const [preview, setPreview] = useState<{
    day: Day;
    notes: string[];
    conflicts: string[];
    mode: Mode;
  } | null>(null);
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const di = tripDayIndex(trip, today);
  const day = trip.days[di];
  if (!day)
    return (
      <Page>
        <PageHeader title="Change my plans" />
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="No plan for today"
          body="Generate an itinerary first."
        />
      </Page>
    );
  const current = day.activities.find((a) => a.status === "pending" && a.kind === "place");
  const currentPlace = getPlace(current?.placeId);
  const lastDone =
    getPlace(
      [...day.activities].reverse().find((a) => a.status === "done" && a.placeId)?.placeId,
    ) ?? currentPlace;
  const inTrip = new Set(trip.days.flatMap((d) => d.activities.map((a) => a.placeId)));
  const candidates = cityPlacesList.filter((p) => !inTrip.has(p.id));
  const closedAlts = currentPlace
    ? findAlternatives(
        currentPlace,
        candidates.filter((p) => p.close * 60 > nowMinGuess() + p.duration),
      )
    : [];
  // Skipped stops from today or earlier days that could still fit later in the trip.
  const missed = trip.days.flatMap((d, i) =>
    i <= di
      ? d.activities
          .filter((a) => a.status === "skipped" && a.placeId)
          .map((a) => ({ a, dayIdx: i }))
      : [],
  );
  const nearest = lastDone
    ? [...candidates].sort((a, b) => distanceKm(lastDone, a) - distanceKm(lastDone, b))
    : candidates;
  const priorityIds = new Set(
    trip.places.filter((p) => p.priority || p.source === "must").map((p) => p.placeId),
  );
  const nowMin = Math.max(nowMinGuess(), trip.startHour * 60);

  const build = (): AssistantAction | null => {
    switch (pick) {
      case "late":
        return { type: "late", minutes: lateMin };
      case "skip":
        return current ? { type: "skip", activityId: current.id } : null;
      case "add":
        return addId ? { type: "add", placeId: addId } : null;
      case "nearby":
        return nearest[0] ? { type: "add", placeId: addId ?? nearest[0].id } : null;
      case "mode":
        return { type: "mode", mode };
      case "extend":
        return current ? { type: "extend", activityId: current.id, minutes: 30 } : null;
      case "rearrange":
        return { type: "rearrange" };
      case "rain":
        return { type: "rain", candidates: candidates.map((p) => p.id) };
      case "closed":
        return current && (addId ?? closedAlts[0]?.id)
          ? { type: "replace", activityId: current.id, placeId: addId ?? closedAlts[0]!.id }
          : null;
      default:
        return null;
    }
  };

  const reschedule = () => {
    const m = missed.find((x) => x.a.id === missedId) ?? missed[0];
    const place = getPlace(m?.a.placeId);
    if (!m || !place) return;
    const target = suggestDayFor(
      place,
      trip.days,
      di + (nowMin > 18 * 60 ? 1 : 0),
      trip.pace,
      getPlace,
    );
    if (target === null) {
      toast.error(`No room left for ${place.name}. Try removing something or adding a day.`);
      return;
    }
    updateTrip(id, (t) => ({
      ...t,
      days: t.days.map((d, i) => {
        const acts = i === m.dayIdx ? d.activities.filter((a) => a.id !== m.a.id) : d.activities;
        const withNew =
          i === target
            ? [
                ...acts,
                {
                  ...m.a,
                  id: `${m.a.id}-again`,
                  status: "pending" as const,
                  duration: place.duration,
                  start: 0,
                },
              ]
            : acts;
        return i === m.dayIdx || i === target
          ? {
              ...d,
              activities: layoutDay(
                withNew,
                getPlace,
                t.startHour * 60,
                t.transport,
                i === di ? nowMin : 0,
              ).activities,
            }
          : d;
      }),
    }));
    toast.success(
      `${place.name} moved to Day ${target + 1} (${formatShort(trip.days[target]!.date)})`,
    );
    void navigate({ to: "/trip/$id/active", params: { id } });
  };

  const run = () => {
    if (pick === "missed") return reschedule();
    const action = build();
    if (!action) {
      toast.error("Pick an option first");
      return;
    }
    setPreview(
      replanDay(day, action, {
        lookup: getPlace,
        mode: trip.transport,
        nowMin,
        startHour: trip.startHour,
        priorityIds,
      }),
    );
  };

  const apply = () => {
    if (!preview) return;
    updateTrip(id, (t) => ({
      ...t,
      transport: preview.mode,
      days: t.days.map((d, i) => (i === di ? preview.day : d)),
    }));
    toast.success("Your day has been updated");
    void navigate({ to: "/trip/$id/active", params: { id } });
  };

  const costOf = (d: Day) =>
    d.activities
      .filter((a) => a.status === "pending")
      .reduce((s, a) => s + (getPlace(a.placeId)?.cost ?? 0), 0) * trip.travelers;
  const travelOf = (d: Day) =>
    d.activities.filter((a) => a.status === "pending").reduce((s, a) => s + a.travelMin, 0);

  return (
    <Page>
      <PageHeader
        title="Change my plans"
        subtitle={currentPlace ? `Currently: ${currentPlace.name}` : "Adjust the rest of today"}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QUICK.map(({ k, label, icon: I }) => (
          <button
            key={k}
            onClick={() => {
              setPick(k);
              setPreview(null);
            }}
            aria-pressed={pick === k}
            className={cn(
              "tap flex min-h-24 flex-col items-start justify-between rounded-3xl p-4 text-left font-bold shadow-soft",
              pick === k ? "bg-foreground text-background" : "bg-card",
            )}
          >
            <I className={cn("h-6 w-6", pick === k ? "text-butter" : "text-sea")} />
            {label}
          </button>
        ))}
      </div>

      {pick && (
        <Card className="mt-5 space-y-3">
          {pick === "late" && (
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90].map((m) => (
                <Chip key={m} selected={lateMin === m} onClick={() => setLateMin(m)}>
                  {m} min
                </Chip>
              ))}
            </div>
          )}
          {pick === "skip" && (
            <p className="text-sm">
              We'll skip <b>{currentPlace?.name ?? "the current stop"}</b> and move everything up.{" "}
              {current && priorityIds.has(current.placeId ?? "") && (
                <span className="font-bold text-sea">Heads up: this is a must-visit.</span>
              )}
            </p>
          )}
          {(pick === "add" || pick === "nearby") && (
            <div className="space-y-2">
              <p className="text-sm font-bold">
                {pick === "nearby"
                  ? `Closest to ${lastDone?.name ?? "you"}`
                  : "Choose a place to add"}
              </p>
              {(pick === "nearby" ? nearest.slice(0, 4) : candidates).map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setAddId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl p-2 text-left",
                    (addId ?? (pick === "nearby" && i === 0 ? nearest[0]?.id : null)) === p.id
                      ? "bg-primary-soft ring-2 ring-primary"
                      : "bg-secondary",
                  )}
                >
                  <img src={p.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  <span className="flex-1 text-sm font-bold">{p.name}</span>
                  {lastDone && (
                    <span className="text-xs text-muted-foreground">
                      {distanceKm(lastDone, p).toFixed(1)} km
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {pick === "mode" && (
            <div className="flex gap-2">
              {(["walk", "transit", "drive"] as Mode[]).map((m) => (
                <Chip key={m} selected={mode === m} onClick={() => setMode(m)}>
                  {m === "walk" ? "Walking" : m === "transit" ? "Transit" : "Car / taxi"}
                </Chip>
              ))}
            </div>
          )}
          {pick === "extend" && (
            <p className="text-sm">
              Add 30 more minutes at <b>{currentPlace?.name ?? "this stop"}</b>.
            </p>
          )}
          {pick === "rearrange" && (
            <p className="text-sm">
              We'll reorder your remaining stops to cut travel time, keeping must-visits early.
            </p>
          )}
          {pick === "rain" && (
            <p className="text-sm">
              We'll swap today's remaining outdoor stops for nearby indoor ones (museums, markets,
              cafés) and keep everything else.
            </p>
          )}
          {pick === "closed" && (
            <div className="space-y-2">
              <p className="text-sm font-bold">
                Closed? Here's what's similar & open near {currentPlace?.name ?? "you"}:
              </p>
              {closedAlts.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setAddId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl p-2 text-left",
                    (addId ?? (i === 0 ? p.id : null)) === p.id
                      ? "bg-primary-soft ring-2 ring-primary"
                      : "bg-secondary",
                  )}
                >
                  <img src={p.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  <span className="flex-1 text-sm font-bold">
                    {p.name}
                    <span className="block text-xs font-semibold text-muted-foreground">
                      {p.category} · open till {p.close}:00
                    </span>
                  </span>
                  {currentPlace && (
                    <span className="text-xs text-muted-foreground">
                      {distanceKm(currentPlace, p).toFixed(1)} km
                    </span>
                  )}
                </button>
              ))}
              {!closedAlts.length && (
                <p className="text-sm text-muted-foreground">
                  No open alternatives nearby. Try “Skip This Place”.
                </p>
              )}
            </div>
          )}
          {pick === "missed" && (
            <div className="space-y-2">
              {missed.length ? (
                <>
                  <p className="text-sm font-bold">
                    Which place did you miss? We'll find the best later slot for it.
                  </p>
                  {missed.map(({ a, dayIdx }, i) => (
                    <button
                      key={a.id}
                      onClick={() => setMissedId(a.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl p-2 text-left",
                        (missedId ?? (i === 0 ? a.id : null)) === a.id
                          ? "bg-primary-soft ring-2 ring-primary"
                          : "bg-secondary",
                      )}
                    >
                      <img
                        src={getPlace(a.placeId)?.image}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                      <span className="flex-1 text-sm font-bold">
                        {getPlace(a.placeId)?.name}
                        <span className="block text-xs font-semibold text-muted-foreground">
                          Skipped on Day {dayIdx + 1}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No missed stops. You're crushing it! (Skipped places show up here.)
                </p>
              )}
            </div>
          )}
          <button
            onClick={run}
            disabled={pick === "missed" && !missed.length}
            className={pillButton({ className: "w-full" })}
          >
            <Timer className="h-4 w-4" />
            {pick === "missed" ? "Find a new time" : "Preview changes"}
          </button>
        </Card>
      )}

      {preview && (
        <section className="mt-6 animate-in fade-in slide-in-from-bottom-3">
          <h2 className="mb-3 text-xl font-semibold">Before & after</h2>
          {preview.notes.map((n) => (
            <p key={n} className="mb-1 text-sm font-semibold text-primary-strong">
              <Check className="mr-1 inline h-4 w-4" />
              {n}
            </p>
          ))}
          {preview.conflicts.map((c) => (
            <p key={c} className="mb-1 flex items-start gap-1.5 text-sm font-bold text-sea">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {c}
            </p>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Compare
              title="Before"
              d={day}
              cost={costOf(day)}
              travel={travelOf(day)}
              currency={trip.currency}
            />
            <Compare
              title="After"
              d={preview.day}
              cost={costOf(preview.day)}
              travel={travelOf(preview.day)}
              currency={trip.currency}
              highlight
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setPreview(null)}
              className={pillButton({ variant: "outline", size: "lg" })}
            >
              Cancel
            </button>
            <button onClick={apply} className={pillButton({ size: "lg", className: "flex-1" })}>
              Apply Changes <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}
      <div className="mt-5">
        <EstimateNote>
          Re-planning uses estimated travel times and typical opening hours. Completed stops are
          never changed.
        </EstimateNote>
      </div>
    </Page>
  );
}

function Compare({
  title,
  d,
  cost,
  travel,
  currency,
  highlight,
}: {
  title: string;
  d: Day;
  cost: number;
  travel: number;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-3xl p-3", highlight ? "bg-primary-soft" : "bg-card shadow-soft")}>
      <p className="mb-2 font-extrabold">{title}</p>
      <ul className="space-y-1.5">
        {d.activities.map((a) => (
          <li
            key={a.id}
            className={cn("flex gap-2 text-xs", a.status !== "pending" && "opacity-50")}
          >
            <span className="w-14 shrink-0 font-bold">
              {a.status === "pending" ? fmtTime(a.start) : a.status === "done" ? "done" : "skipped"}
            </span>
            <span className={cn("truncate", a.conflict && "text-sea")}>
              {a.kind === "meal" ? a.label : getPlace(a.placeId)?.name}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t pt-2 text-[11px] font-bold text-muted-foreground">
        ~{money(cost, currency)} · {travel} min travel
      </p>
    </div>
  );
}

function nowMinGuess() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
