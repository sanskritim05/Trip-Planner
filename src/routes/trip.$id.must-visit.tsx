import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gem, Heart, Loader2, Plus, Search, Sparkles, Star, X } from "lucide-react";
import { PlaceRow, PriorityStar } from "@/components/app/cards";
import {
  Chip,
  EmptyState,
  Page,
  PageHeader,
  SectionHeading,
  Steps,
  Tag,
  inputCls,
  pillButton,
} from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { useCityPlaces, useDebounced } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Category, Place } from "@/lib/types";
import { searchCityPlaces } from "@/services/wiki";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/must-visit")({
  head: () => seo("Must-visit places", "Add the places you already know you want to see."),
  component: MustVisit,
});

const FILTERS: { k: string; label: string; match: (p: Place) => boolean }[] = [
  { k: "all", label: "Everything", match: () => true },
  {
    k: "sights",
    label: "Landmarks",
    match: (p) => p.category === "Landmark" || p.category === "Neighborhood",
  },
  { k: "food", label: "Food & drink", match: (p) => p.category === "Food" },
  { k: "culture", label: "Museums", match: (p) => p.category === "Museum" },
  {
    k: "outdoors",
    label: "Outdoors",
    match: (p) => (["Nature", "Beach", "Adventure"] as Category[]).includes(p.category),
  },
  {
    k: "fun",
    label: "Activities",
    match: (p) =>
      p.category === "Entertainment" || p.category === "Shopping" || p.category === "Adventure",
  },
  { k: "gems", label: "Hidden gems", match: (p) => p.tags.includes("Hidden gems") },
];

function MustVisit() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, state, savePlaces } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const trip = getTrip(id);
  const city = getCity(trip?.cityId);
  const {
    places: all,
    loading,
    enriching,
    ai,
  } = useCityPlaces(trip?.cityId, trip, { enrich: true });
  const query = useDebounced(q.trim(), 450);
  const remote = useQuery({
    queryKey: ["place-search", city?.id, query],
    enabled: !!city && query.length >= 3,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => searchCityPlaces(city!, query, signal),
  });
  const selectedIds = new Set(trip?.places.map((p) => p.placeId) ?? []);
  const f = FILTERS.find((x) => x.k === filter)!;
  const lower = q.trim().toLowerCase();
  const results = useMemo(() => {
    const local = all.filter(
      (p) =>
        !selectedIds.has(p.id) &&
        f.match(p) &&
        (!lower ||
          `${p.name} ${p.category} ${p.description} ${p.tags.join(" ")}`
            .toLowerCase()
            .includes(lower)),
    );
    const names = new Set(local.map((p) => p.name.toLowerCase()));
    const extra = (remote.data ?? []).filter(
      (p) =>
        !selectedIds.has(p.id) &&
        !names.has(p.name.toLowerCase()) &&
        !all.some((a) => a.id === p.id),
    );
    return [...local, ...extra];
  }, [all, remote.data, lower, filter, trip?.places]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const bucketHere = state.bucket
    .map((b) => getPlace(b.refId))
    .filter((p): p is Place => !!p && p.cityId === trip.cityId && !selectedIds.has(p.id));
  const add = (p: Place, source: "must" | "bucket") => {
    savePlaces([p]);
    updateTrip(id, (t) => ({
      ...t,
      places: [...t.places, { placeId: p.id, source, priority: false }],
    }));
  };
  const remove = (placeId: string) =>
    updateTrip(id, (t) => ({ ...t, places: t.places.filter((p) => p.placeId !== placeId) }));
  const toggleP = (placeId: string) =>
    updateTrip(id, (t) => ({
      ...t,
      places: t.places.map((p) => (p.placeId === placeId ? { ...p, priority: !p.priority } : p)),
    }));
  const go = () => {
    updateTrip(id, (t) => ({ ...t, step: Math.max(t.step, 8) }));
    void navigate({ to: "/trip/$id/swipe", params: { id } });
  };
  const must = trip.places.filter((p) => p.source === "must" || p.source === "bucket");

  return (
    <Page>
      <PageHeader
        title="What's on your must-visit list?"
        subtitle={`${city?.name ?? ""} · these get top priority in your plan`}
      />
      <Steps current={1} total={3} labels={["Must-visit places", "Discover more", "Review"]} />

      <section className="mt-6">
        <SectionHeading title={`Selected (${must.length})`} />
        {must.length === 0 ? (
          <EmptyState
            icon={<Star className="h-6 w-6" />}
            title="No must-visits yet"
            body="Search below or add from your bucket list. You can also skip this step."
          />
        ) : (
          <div className="space-y-3">
            {must.map((tp) => {
              const p = getPlace(tp.placeId);
              if (!p) return null;
              return (
                <PlaceRow
                  key={p.id}
                  place={p}
                  badge={
                    <>
                      <Tag tone="blush" className="py-0.5">
                        Must-Visit
                      </Tag>
                      {tp.priority && (
                        <Tag tone="butter" className="py-0.5">
                          High priority
                        </Tag>
                      )}
                    </>
                  }
                  right={
                    <div className="flex gap-1">
                      <PriorityStar on={tp.priority} onClick={() => toggleP(p.id)} />
                      <button
                        aria-label={`Remove ${p.name}`}
                        onClick={() => remove(p.id)}
                        className="tap flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {bucketHere.length > 0 && (
        <section className="mt-8 rounded-3xl bg-primary-soft/60 p-4">
          <SectionHeading
            title="From your bucket list"
            subtitle={`You saved these for ${city?.name}. Include them?`}
            icon={<Heart className="h-5 w-5 fill-primary" />}
          />
          <div className="space-y-3">
            {bucketHere.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                right={<AddBtn onClick={() => add(p, "bucket")} name={p.name} />}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionHeading
          title={q ? "Search results" : `Explore ${city?.name ?? "this city"}`}
          subtitle={
            loading ? "gathering sights, eats & hidden gems…" : `${all.length} places to pick from`
          }
        />
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search attractions, restaurants, landmarks, activities…"
            aria-label="Search places"
            className={`${inputCls} pl-12`}
          />
          {(remote.isFetching || loading) && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-primary" />
          )}
        </div>
        <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {FILTERS.map((x) => (
            <Chip key={x.k} selected={filter === x.k} onClick={() => setFilter(x.k)}>
              {x.label}
            </Chip>
          ))}
        </div>
        {ai && (
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            {enriching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            )}
            {enriching
              ? "AI is fine-tuning prices, hours and restaurant picks"
              : "Prices, hours and restaurant picks tuned by AI"}{" "}
            for your interests
            {trip.dietary.filter((d) => d !== "No restrictions").length
              ? ` & ${trip.dietary.join(", ").toLowerCase()} diet`
              : ""}
            .
          </p>
        )}
        <div className="space-y-3">
          {loading &&
            !all.length &&
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-card/70" />
            ))}
          {results.slice(0, 60).map((p) => (
            <PlaceRow
              key={p.id}
              place={p}
              badge={
                <>
                  <span>{p.category}</span>
                  {p.tags.includes("Hidden gems") && (
                    <span className="flex items-center gap-0.5 text-sea-strong">
                      <Gem className="h-3 w-3" />
                      gem
                    </span>
                  )}
                  {p.diet?.length ? (
                    <span className="text-primary-strong">{p.diet.slice(0, 2).join(" · ")}</span>
                  ) : null}
                </>
              }
              right={<AddBtn onClick={() => add(p, "must")} name={p.name} />}
            />
          ))}
          {!loading && !remote.isFetching && !results.length && (
            <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground">
              Nothing matches yet. Try another word (e.g. “ramen”, “rooftop”, “castle”).
            </p>
          )}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t bg-card/95 p-4 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-3xl gap-3">
          <button onClick={go} className={pillButton({ variant: "ghost", size: "lg" })}>
            Skip for Now
          </button>
          <button onClick={go} className={pillButton({ size: "lg", className: "flex-1" })}>
            Continue to Recommendations
          </button>
        </div>
      </div>
      <div className="h-24" />
    </Page>
  );
}

function AddBtn({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button
      aria-label={`Add ${name}`}
      onClick={onClick}
      className="tap wiggle flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
