import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  Loader2,
  Plus,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { PlaceRow } from "@/components/app/cards";
import { MapView } from "@/components/app/MapView";
import {
  Card,
  EmptyState,
  EstimateNote,
  Page,
  PageHeader,
  SectionHeading,
  Steps,
  Tag,
  money,
  pillButton,
} from "@/components/app/ui";
import { getPlace } from "@/data/registry";
import { addDays, fmtDuration, tripLength } from "@/lib/dates";
import { capacityCheck } from "@/lib/itinerary";
import { useApp } from "@/lib/store";
import type { Place, TripPlace } from "@/lib/types";
import { itineraryService, SERVICE_STATUS } from "@/services";
import { toast } from "sonner";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/review")({
  head: () =>
    seo("Review your places", "Check your selected places before generating your itinerary."),
  component: Review,
});

function Review() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, notify, today, state } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const trip = getTrip(id);
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const rows = trip.places
    .map((tp) => ({ tp, place: getPlace(tp.placeId) }))
    .filter((r): r is { tp: TripPlace; place: Place } => !!r.place);
  const must = rows.filter((r) => r.tp.source === "must" || r.tp.source === "bucket");
  const extra = rows.filter((r) => !(r.tp.source === "must" || r.tp.source === "bucket"));
  const days = trip.startDate ? tripLength(trip.startDate, trip.endDate) : 1;
  const cap = capacityCheck(
    rows.map((r) => r.place),
    days,
    trip.pace,
  );
  const totalTime = rows.reduce((s, r) => s + r.place.duration, 0);
  const totalCost = rows.reduce((s, r) => s + r.place.cost, 0) * trip.travelers;

  const move = (placeId: string, dir: -1 | 1) =>
    updateTrip(id, (t) => {
      const arr = [...t.places];
      const i = arr.findIndex((p) => p.placeId === placeId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return t;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...t, places: arr };
    });
  const remove = (placeId: string) =>
    updateTrip(id, (t) => ({ ...t, places: t.places.filter((p) => p.placeId !== placeId) }));
  const addDay = () => updateTrip(id, (t) => ({ ...t, endDate: addDays(t.endDate, 1) }));
  // Lowest-value optional picks (not must-visit, not liked by taste) until the plan fits.
  const droppable = (() => {
    if (!cap.over) return [] as string[];
    const opt = rows.filter(
      (r) => !(r.tp.source === "must" || r.tp.source === "bucket" || r.tp.priority),
    );
    const value = (p: Place) =>
      p.tags.reduce((s2, t) => s2 + (state.taste[t] ?? 0), 0) +
      (trip.interests.some((i) => p.tags.includes(i)) ? 2 : 0);
    const sorted = [...opt].sort((a, b) => value(a.place) - value(b.place));
    let need = cap.need;
    const out: string[] = [];
    for (const r of sorted) {
      if (need <= cap.have) break;
      need -= r.place.duration + 25;
      out.push(r.place.id);
    }
    return out;
  })();
  const trim = () => {
    updateTrip(id, (t) => ({
      ...t,
      places: t.places.filter((p) => !droppable.includes(p.placeId)),
      passed: [...t.passed, ...droppable],
    }));
    toast.success(`Trimmed ${droppable.length} optional place${droppable.length > 1 ? "s" : ""}`);
  };

  const generate = async () => {
    if (!trip.startDate) {
      toast.error("Add travel dates first");
      return;
    }
    setBusy(true);
    try {
      const res = await itineraryService.generate({
        cityId: trip.cityId,
        today,
        startDate: trip.startDate,
        endDate: trip.endDate,
        selected: trip.places,
        pace: trip.pace,
        mode: trip.transport,
        startHour: trip.startHour,
      });
      updateTrip(id, (t) => ({ ...t, days: res.days, unscheduled: res.unscheduled, step: 10 }));
      notify({
        title: "Your itinerary is ready",
        body: `${trip.name}: ${res.days.length} days planned${res.weatherUsed ? ", arranged around the weather" : ""}. Review and confirm when ready.`,
        kind: "planning",
        link: `/trip/${id}/itinerary`,
      });
      void navigate({ to: "/trip/$id/itinerary", params: { id } });
    } catch {
      toast.error("We couldn't build your plan. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const list = (items: typeof rows) => (
    <div className="space-y-3">
      {items.map(({ tp, place }) => (
        <PlaceRow
          key={place.id}
          place={place}
          badge={
            tp.source === "must" || tp.source === "bucket" ? (
              <Tag tone="sea" className="py-0.5">
                Must-Visit
              </Tag>
            ) : (
              <Tag className="py-0.5">{tp.source === "group" ? "Group pick" : "Recommended"}</Tag>
            )
          }
          right={
            <div className="flex flex-col gap-1 sm:flex-row">
              <IconBtn label={`Move ${place.name} up`} onClick={() => move(place.id, -1)}>
                <ArrowUp className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={`Move ${place.name} down`} onClick={() => move(place.id, 1)}>
                <ArrowDown className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={`Remove ${place.name}`} onClick={() => remove(place.id)}>
                <X className="h-4 w-4" />
              </IconBtn>
            </div>
          }
        />
      ))}
    </div>
  );

  return (
    <Page>
      <PageHeader title="Review your places" subtitle={`${rows.length} places · ${days} days`} />
      <Steps current={3} total={3} labels={["Must-visit places", "Discover more", "Review"]} />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Activity time
          </p>
          <p className="font-display text-2xl font-semibold">{fmtDuration(totalTime)}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            Entry costs (est.)
          </p>
          <p className="font-display text-2xl font-semibold">{money(totalCost, trip.currency)}</p>
        </Card>
      </div>
      {cap.over && (
        <div className="mt-3 rounded-2xl bg-butter/80 p-4 text-sm">
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />
            That's about {fmtDuration(cap.need)} of sightseeing for {fmtDuration(cap.have)} of{" "}
            {trip.pace} days, so not everything will fit. Must-visits always get priority.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={addDay} className={pillButton({ variant: "dark", size: "xs" })}>
              <Plus className="h-3.5 w-3.5" />
              Add a day
            </button>
            {droppable.length > 0 && (
              <button onClick={trim} className={pillButton({ variant: "outline", size: "xs" })}>
                Trim {droppable.length} optional pick{droppable.length > 1 ? "s" : ""}
              </button>
            )}
            {trip.pace !== "packed" && (
              <button
                onClick={() => updateTrip(id, (t) => ({ ...t, pace: "packed" }))}
                className={pillButton({ variant: "outline", size: "xs" })}
              >
                Switch to a packed pace
              </button>
            )}
          </div>
        </div>
      )}
      <MapView
        className="mt-4 h-56"
        stops={rows.map((r, i) => ({ place: r.place, n: i + 1, status: "selected" }))}
      />

      {!rows.length && (
        <div className="mt-6">
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No places yet"
            body="Add a few places to build your itinerary."
          />
        </div>
      )}
      {must.length > 0 && (
        <section className="mt-6">
          <SectionHeading title="Must-Visit Places" />
          {list(must)}
        </section>
      )}
      {extra.length > 0 && (
        <section className="mt-6">
          <SectionHeading title="Additional Places" />
          {list(extra)}
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/trip/$id/must-visit"
          params={{ id }}
          className={pillButton({ variant: "outline" })}
        >
          <Plus className="h-4 w-4" />
          Add places
        </Link>
        <Link to="/trip/$id/swipe" params={{ id }} className={pillButton({ variant: "outline" })}>
          Discover more
        </Link>
      </div>
      <button
        disabled={busy || !rows.length}
        onClick={generate}
        className={pillButton({ size: "lg", variant: "dark", className: "mt-6 w-full" })}
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Building your days…
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Generate My Itinerary
          </>
        )}
      </button>
      <div className="mt-3">
        <EstimateNote>
          {SERVICE_STATUS.itinerary}. Times, hours and costs are estimates.
        </EstimateNote>
      </div>
    </Page>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="tap flex h-8 w-8 items-center justify-center rounded-full bg-secondary"
    >
      {children}
    </button>
  );
}
