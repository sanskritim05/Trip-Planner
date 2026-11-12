import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PartyPopper, Heart, Shell } from "lucide-react";
import { SwipeDeck } from "@/components/app/SwipeDeck";
import { EmptyState, Page, PageHeader, Steps, pillButton } from "@/components/app/ui";
import { Burst } from "@/components/app/whimsy";
import { getPlace } from "@/data/registry";
import { useCityPlaces } from "@/lib/hooks";
import { recommend } from "@/lib/recommend";
import { useApp } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/swipe")({
  head: () => seo("Discover places", "Swipe through places picked for your interests."),
  component: Swipe,
});

function Swipe() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, state, nudgeTaste, tasteKeys } = useApp();
  const [burst, setBurst] = useState(0);
  const navigate = useNavigate();
  const [history, setHistory] = useState<{ placeId: string; yes: boolean }[]>([]);
  const trip = getTrip(id);
  const bucketIds = useMemo(() => new Set(state.bucket.map((b) => b.refId)), [state.bucket]);
  const { places, loading } = useCityPlaces(trip?.cityId, trip, { enrich: true });
  const recs = useMemo(
    () => (trip ? recommend(trip, bucketIds, state.taste) : []),
    [trip, bucketIds, places.length],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const accepted = trip.places.filter((p) => p.source === "swipe" || p.source === "group").length;

  const decide = (placeId: string, yes: boolean) => {
    setHistory((h) => [...h, { placeId, yes }]);
    // Learn from every swipe so the next cards fit better.
    nudgeTaste(tasteKeys(getPlace(placeId)), yes ? 1 : -0.6);
    if (yes) setBurst((b) => b + 1);
    updateTrip(id, (t) =>
      yes
        ? { ...t, places: [...t.places, { placeId, source: "swipe", priority: false }] }
        : { ...t, passed: [...t.passed, placeId] },
    );
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    updateTrip(id, (t) => ({
      ...t,
      places: t.places.filter((p) => !(p.placeId === last.placeId && p.source === "swipe")),
      passed: t.passed.filter((x) => x !== last.placeId),
    }));
  };
  const done = () => {
    updateTrip(id, (t) => ({ ...t, step: Math.max(t.step, 9) }));
    void navigate({ to: "/trip/$id/review", params: { id } });
  };

  return (
    <Page>
      <PageHeader
        title="Discover places you'll love."
        subtitle={`${accepted} added · ${recs.length} left to explore`}
        action={
          <span className="mt-1 rounded-full bg-primary px-3 py-1.5 text-sm font-extrabold text-primary-foreground">
            <Heart className="h-4 w-4 fill-current" /> {accepted}
          </span>
        }
      />
      <Steps current={2} total={3} labels={["Must-visit places", "Discover more", "Review"]} />
      <div className="relative mt-5">
        <Burst trigger={burst} />
        {loading && !recs.length ? (
          <div className="mx-auto flex h-[min(66vh,560px)] max-w-sm flex-col items-center justify-center gap-3 rounded-[2rem] bg-card/70 text-center shadow-soft">
            <span className="bob flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Shell className="h-8 w-8" />
            </span>
            <p className="font-display text-xl font-semibold">Finding places you'll love…</p>
            <p className="text-sm text-muted-foreground">Gathering sights, eats & hidden gems</p>
          </div>
        ) : recs.length ? (
          <SwipeDeck recs={recs} onDecide={decide} onUndo={undo} canUndo={history.length > 0} />
        ) : (
          <EmptyState
            icon={<PartyPopper className="h-6 w-6" />}
            title="You've seen everything!"
            body="Nice picking. Review your places to build your itinerary."
          >
            {history.length > 0 && (
              <button onClick={undo} className={pillButton({ variant: "ghost" })}>
                Undo last
              </button>
            )}
          </EmptyState>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Swipe right or tap the heart to add · swipe left or tap X to skip · arrow keys work too.
        Picks get smarter with every swipe.
      </p>
      <div className="mt-5 flex gap-3">
        <Link
          to="/trip/$id/must-visit"
          params={{ id }}
          className={pillButton({ variant: "outline", size: "lg" })}
        >
          Back
        </Link>
        <button onClick={done} className={pillButton({ size: "lg", className: "flex-1" })}>
          Done Selecting Places
        </button>
      </div>
    </Page>
  );
}
