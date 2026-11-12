import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  Clapperboard,
  Clock,
  CloudSun,
  Gem,
  Loader2,
  MapPin,
  Plane,
  Wallet,
} from "lucide-react";
import { MapView } from "@/components/app/MapView";
import { Wave } from "@/components/app/whimsy";
import { useCityPlaces, useRegistry } from "@/lib/hooks";
import { PlaceRow, SaveHeart } from "@/components/app/cards";
import {
  Card,
  EstimateNote,
  SectionHeading,
  Tag,
  TONE_CYCLE,
  money,
  pillButton,
} from "@/components/app/ui";
import { getCity } from "@/data/registry";
import { useApp } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/destination/$id")({
  // Curated cities resolve on the server; live (searched) cities resolve on the client.
  head: ({ params }) => {
    const city = getCity(params.id);
    return city
      ? seo(`${city.name}, ${city.country}`, city.blurb)
      : seo("Destination", "Explore a destination.");
  },
  component: Destination,
});

function Destination() {
  const { id } = Route.useParams();
  useRegistry();
  const city = getCity(id);
  const { places: ps, loading } = useCityPlaces(city?.id);
  const { isSaved, toggleSave } = useApp();
  if (!city) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="font-display text-2xl font-semibold">We couldn't find that destination</p>
        <Link to="/explore" className={pillButton({ className: "mt-6" })}>
          Back to Explore
        </Link>
      </main>
    );
  }
  const films = ps.filter((p) => p.film);
  const gems = ps.filter((p) => p.tags.includes("Hidden gems")).slice(0, 6);
  const popular = ps.filter((p) => !p.tags.includes("Hidden gems")).slice(0, 12);
  const saved = isSaved(id);

  return (
    <main className="page-enter pb-32 lg:pb-12">
      <div className="relative h-[46vh] min-h-72">
        <img
          src={city.image}
          alt={`${city.name}, ${city.country}`}
          className="h-full w-full object-cover"
        />
        <div className="photo-fade absolute inset-0" />
        <Link
          to="/explore"
          aria-label="Back"
          className="tap absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-card/90 shadow-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <SaveHeart refId={id} kind="destination" className="absolute right-5 top-5 h-11 w-11" />
        <Wave className="absolute -bottom-px left-0" />
        <div className="absolute bottom-8 left-5 right-5 mx-auto max-w-3xl text-on-photo">
          <p className="flex items-center gap-1 text-sm font-bold">
            <MapPin className="h-4 w-4" />
            {city.region}, {city.country}
          </p>
          <h1 className="text-5xl font-semibold tracking-tight">{city.name}</h1>
        </div>
      </div>
      <div className="relative mx-auto -mt-5 max-w-3xl space-y-8 rounded-t-[2rem] bg-background px-5 pt-6">
        <div className="flex flex-wrap gap-2">
          {city.tags.map((t, i) => (
            <Tag key={t} tone={TONE_CYCLE[i % TONE_CYCLE.length] ?? "blush"}>
              {t}
            </Tag>
          ))}
        </div>
        <p className="text-lg leading-relaxed">{city.overview}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Info icon={<Clock className="h-4 w-4" />} label="Ideal trip" value={city.idealDays} />
          <Info
            icon={<Wallet className="h-4 w-4" />}
            label="Per day (est.)"
            value={`${money(city.dailyCost.budget)}–${money(city.dailyCost.luxury)}`}
          />
          <Info
            icon={<CloudSun className="h-4 w-4" />}
            label="Best season"
            value={
              city.seasons
                .filter((s) => s.recommended)
                .map((s) => s.label)
                .join(" & ") || "Year-round"
            }
          />
          <Info
            icon={<CalendarDays className="h-4 w-4" />}
            label="Timezone"
            value={city.timezone.split("/")[1]?.replace("_", " ") ?? city.timezone}
          />
        </div>

        <section>
          <SectionHeading title="When to go" />
          <div className="grid gap-3 sm:grid-cols-2">
            {city.seasons.map((s) => (
              <Card key={s.label} className={s.recommended ? "ring-2 ring-primary" : ""}>
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    {s.label} <span className="text-xs text-muted-foreground">· {s.months}</span>
                  </p>
                  {s.recommended && <Tag>Recommended</Tag>}
                </div>
                <p className="mt-1 text-sm">
                  {s.weather}, {s.temp}
                </p>
                <p className="text-xs text-muted-foreground">{s.highlight}</p>
              </Card>
            ))}
          </div>
          <div className="mt-3">
            <EstimateNote>
              Weather and costs are typical seasonal estimates, not live forecasts or prices.
            </EstimateNote>
          </div>
        </section>

        <section>
          <SectionHeading title="Estimated daily costs" />
          <div className="grid grid-cols-3 gap-3">
            {(["budget", "moderate", "luxury"] as const).map((k) => (
              <Card key={k} className="text-center">
                <p className="text-xs font-bold capitalize text-muted-foreground">{k}</p>
                <p className="font-display text-2xl font-semibold">{money(city.dailyCost[k])}</p>
                <p className="text-[10px] text-muted-foreground">per person / day</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title="Popular attractions"
            subtitle={loading ? "gathering the best bits…" : undefined}
          />
          {loading && !ps.length && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Finding sights, food & hidden gems…
            </p>
          )}
          {ps.length > 0 && <MapView className="mb-4 h-64" stops={[]} extra={ps.slice(0, 30)} />}
          <div className="space-y-3">
            {popular.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                badge={<span>{p.category}</span>}
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

        {gems.length > 0 && (
          <section>
            <SectionHeading
              title="Hidden gems"
              icon={<Gem className="h-5 w-5" />}
              subtitle="Quieter spots locals love"
            />
            <div className="space-y-3">
              {gems.map((p) => (
                <PlaceRow
                  key={p.id}
                  place={p}
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

        {films.length > 0 && (
          <section>
            <SectionHeading
              title="Famous filming locations"
              icon={<Clapperboard className="h-5 w-5" />}
            />
            <div className="space-y-3">
              {films.map((p) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  badge={<span className="text-sea">{p.film!.title}</span>}
                />
              ))}
            </div>
          </section>
        )}

        <div className="sticky bottom-20 flex gap-3 lg:bottom-4">
          <button
            onClick={() => toggleSave(id, "destination")}
            className={pillButton({
              variant: saved ? "soft" : "outline",
              size: "lg",
              className: "flex-1",
            })}
          >
            {saved ? "Saved" : "Save to Bucket List"}
          </button>
          <Link
            to="/create-trip"
            search={{ city: id }}
            className={pillButton({ size: "lg", className: "flex-1" })}
          >
            <Plane className="h-4 w-4" />
            Plan a Trip
          </Link>
        </div>
      </div>
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft">
      <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}
