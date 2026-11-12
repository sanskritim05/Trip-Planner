import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Gem, Globe2, Heart, Loader2, MapPin, Search } from "lucide-react";
import { useCitySearch, useOpenCity, useRegistry } from "@/lib/hooks";
import { DestinationCard, PlaceRow, SaveHeart } from "@/components/app/cards";
import { Chip, Page, SectionHeading, pillButton, inputCls } from "@/components/app/ui";
import { allCities, getCity } from "@/data/registry";
import { FutureTrips } from "@/components/app/FutureTrips";
import { useApp } from "@/lib/store";
import type { Interest } from "@/lib/types";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/explore")({
  head: () => seo("Explore", "Discover destinations, hidden gems and famous filming locations."),
  component: Explore,
});

const CATS: Interest[] = [
  "Nature",
  "Food",
  "Adventure",
  "History",
  "Art",
  "Beaches",
  "Shopping",
  "Nightlife",
];

function Explore() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Interest | null>(null);
  const query = q.trim().toLowerCase();
  const app = useApp();
  useRegistry();
  const navigate = useNavigate();
  const world = useCitySearch(q);
  const { open, busy } = useOpenCity();
  const cities = allCities();
  const places = Object.values(app.state.places);
  const filteredCities = useMemo(
    () =>
      cities.filter(
        (c) =>
          (!cat || c.tags.includes(cat)) &&
          (!query || `${c.name} ${c.country} ${c.region}`.toLowerCase().includes(query)),
      ),
    [cat, query, cities.length],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredPlaces = useMemo(
    () =>
      query
        ? places
            .filter(
              (p) =>
                p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query),
            )
            .slice(0, 8)
        : [],
    [query, places.length],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const worldResults = (world.data ?? []).filter(
    (g) =>
      !cities.some((c) => c.name.toLowerCase() === g.name.toLowerCase() && c.country === g.country),
  );
  const gems = places.filter((p) => p.tags.includes("Hidden gems"));

  return (
    <Page wide>
      <h1 className="text-4xl font-semibold tracking-tight">Explore</h1>
      <p className="font-script text-xl text-muted-foreground">Find your next favorite place.</p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search cities, countries, places…"
          aria-label="Search destinations"
          className={`${inputCls} pl-12`}
        />
      </div>
      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip selected={!cat} onClick={() => setCat(null)}>
          All
        </Chip>
        {CATS.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(cat === c ? null : c)}>
            {c}
          </Chip>
        ))}
      </div>

      {query.length >= 2 && (world.isFetching || worldResults.length > 0) && (
        <section className="mt-6">
          <SectionHeading title="Anywhere in the world" icon={<Globe2 className="h-5 w-5" />} />
          {world.isFetching && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching the globe…
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {worldResults.map((g) => (
              <button
                key={g.geoId}
                disabled={busy !== null}
                onClick={async () => {
                  const cid = await open(g);
                  void navigate({ to: "/destination/$id", params: { id: cid } });
                }}
                className="tap flex items-center gap-3 rounded-3xl bg-card p-3 text-left shadow-soft"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sea-soft text-sea-strong">
                  {busy === g.geoId ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{g.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[g.region, g.country].filter(Boolean).join(", ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {filteredPlaces.length > 0 && (
        <section className="mt-6">
          <SectionHeading title="Places" />
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredPlaces.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                badge={<span>{getCity(p.cityId)?.name}</span>}
                right={
                  <SaveHeart
                    refId={p.id}
                    kind={p.category === "Food" ? "restaurant" : "attraction"}
                    className="bg-secondary"
                  />
                }
              />
            ))}
          </div>
        </section>
      )}

      {!query && (
        <FutureTrips
          focus={cat}
          title={cat ? `${cat} getaways` : "Ideas for you"}
          subtitle={
            cat
              ? `Places that shine for ${cat.toLowerCase()}`
              : "Picked from your interests and past trips"
          }
        />
      )}

      <Link
        to="/explore/filming"
        className="tap mt-6 flex items-center gap-4 rounded-3xl bg-gradient-to-r from-foreground to-sea-strong p-5 text-background shadow-lift"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sea">
          <Clapperboard className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block font-display text-xl font-semibold">
            Movie & TV filming locations
          </span>
          <span className="block text-sm opacity-80">
            Search any movie or show, then plan a trip around it
          </span>
        </span>
      </Link>

      {filteredCities.length > 0 && (
        <section className="mt-8">
          <SectionHeading
            title={query ? "Cities you've explored" : "Recently explored"}
            action={
              <Link
                to="/bucket-list"
                className="flex items-center gap-1 text-sm font-bold text-primary-strong"
              >
                <Heart className="h-4 w-4" />
                Bucket list
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCities.map((c) => (
              <div key={c.id} className="space-y-2">
                <DestinationCard city={c} wide />
                <Link
                  to="/create-trip"
                  search={{ city: c.id }}
                  className={pillButton({ variant: "soft", size: "sm", className: "w-full" })}
                >
                  Plan a Trip Here
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {!query && gems.length > 0 && (
        <section className="mt-10">
          <SectionHeading
            title="Hidden gems"
            icon={<Gem className="h-5 w-5" />}
            subtitle="Quieter spots from cities you've explored"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {gems.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                badge={<span>{getCity(p.cityId)?.name}</span>}
                right={
                  <SaveHeart
                    refId={p.id}
                    kind={p.category === "Food" ? "restaurant" : "attraction"}
                    className="bg-secondary"
                  />
                }
              />
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
