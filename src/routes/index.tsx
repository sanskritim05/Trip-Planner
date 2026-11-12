import { createFileRoute, Link } from "@tanstack/react-router";
import heroImage from "@/assets/hero.jpg";
import {
  ArrowRight,
  CalendarHeart,
  Compass,
  Heart,
  MapPin,
  Navigation,
  Plane,
  Sparkles,
  X,
} from "lucide-react";
import { FutureTrips } from "@/components/app/FutureTrips";
import { Logo } from "@/components/app/Logo";
import { Bubbles, Wave } from "@/components/app/whimsy";
import { NotificationBell } from "@/components/app/NotificationBell";
import { Avatar } from "@/components/app/Nav";
import { TripCard, TripLink } from "@/components/app/cards";
import { EmptyState, Page, ProgressBar, SectionHeading, pillButton } from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { daysUntil, formatRange, fmtTime, tripLength } from "@/lib/dates";
import { tripDayIndex, tripPhase, tripProgress } from "@/lib/trip-status";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ans2Sans · Where to next?" },
      {
        name: "description",
        content: "Plan trips, follow your itinerary and collect memories in a digital scrapbook.",
      },
      { property: "og:title", content: "Ans2Sans · Where to next?" },
      { property: "og:description", content: "Your cozy AI trip planner & travel journal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { state, today, removeBucket } = useApp();
  const trips = state.trips;
  const active = trips.find((t) => tripPhase(t, today) === "active");
  const upcoming = trips
    .filter((t) => tripPhase(t, today) === "upcoming")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const drafts = trips.filter((t) => t.status === "draft");
  const first = state.user?.name.split(" ")[0] ?? "traveler";

  return (
    <Page wide>
      <header className="flex items-center justify-between">
        <Link to="/" className="lg:invisible" aria-label="Ans2Sans home">
          <Logo withName size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Link to="/profile" aria-label="Profile">
            <Avatar name={state.user?.name ?? "T"} src={state.user?.avatar ?? null} />
          </Link>
        </div>
      </header>

      <section className="mt-7">
        <p className="font-script text-2xl text-sea-strong">Hey, {first}!</p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Where to <em className="squiggle text-primary-strong">next?</em>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sunshine, sea breeze & a plan that feels like you.
        </p>
      </section>

      <section className="relative mt-6">
        <span
          className="washi absolute -top-2 left-8 z-10 h-5 w-20 -rotate-6 rounded-sm"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-3xl shadow-lift">
          <img
            src={heroImage}
            alt="Hot air balloons over a valley at sunrise"
            className="h-72 w-full object-cover sm:h-80"
          />
          <div className="photo-fade absolute inset-0" />
          <Bubbles />
          <div className="absolute inset-x-0 bottom-0 p-6 text-on-photo">
            <h2 className="text-3xl font-semibold leading-tight">Ready for your next adventure?</h2>
            <p className="mb-4 mt-1 text-sm font-semibold opacity-90">
              Let's turn your travel dreams into a plan.
            </p>
            <Link to="/create-trip" className={pillButton({ size: "lg" })}>
              Plan a New Trip <Plane className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {active && <ActiveCard tripId={active.id} />}

      <section className="mt-10">
        <SectionHeading title="Your Next Adventure" icon={<Plane className="h-5 w-5" />} />
        {upcoming ? (
          (() => {
            const city = getCity(upcoming.cityId);
            return (
              <article className="overflow-hidden rounded-3xl bg-card shadow-soft">
                <div className="relative h-52 sm:h-64">
                  <img
                    src={city?.image}
                    alt={city?.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="photo-fade absolute inset-0" />
                  <span className="absolute left-4 top-4 rounded-full bg-on-photo/90 px-3 py-1 text-xs font-bold text-primary-strong">
                    Upcoming
                  </span>
                  <div className="absolute bottom-4 left-4 text-on-photo">
                    <h3 className="text-3xl font-semibold">
                      {city?.name}, {city?.country}
                    </h3>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <CalendarHeart className="h-4 w-4" />
                      {formatRange(upcoming.startDate, upcoming.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex flex-1 gap-3">
                    <Stat
                      n={daysUntil(upcoming.startDate, today)}
                      label="days to go"
                      tone="bg-sea-soft"
                    />
                    <Stat
                      n={tripLength(upcoming.startDate, upcoming.endDate)}
                      label="day trip"
                      tone="bg-primary-soft"
                    />
                  </div>
                  <TripLink trip={upcoming} view="itinerary" className={pillButton()}>
                    View Itinerary <ArrowRight className="h-4 w-4" />
                  </TripLink>
                </div>
              </article>
            );
          })()
        ) : (
          <EmptyState
            icon={<Plane className="h-6 w-6" />}
            title="No trips yet!"
            body="Let's plan your very first adventure together."
          >
            <Link to="/create-trip" className={pillButton()}>
              Plan my first trip
            </Link>
          </EmptyState>
        )}
      </section>

      {drafts.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="Pick Up Where You Left Off" />
          <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4">
            {drafts.map((t) => (
              <div key={t.id} className="w-72 shrink-0 snap-start">
                <TripCard trip={t} />
              </div>
            ))}
          </div>
        </section>
      )}

      <FutureTrips />

      <section className="mt-8">
        <SectionHeading
          title="Your Bucket List"
          icon={<Heart className="h-5 w-5 fill-sea" />}
          action={
            <Link
              to="/bucket-list"
              className="text-sm font-bold text-primary-strong hover:underline"
            >
              See All
            </Link>
          }
        />
        {state.bucket.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.bucket.slice(0, 4).map((b) => {
              const place = getPlace(b.refId);
              const city = place ? getCity(place.cityId) : getCity(b.refId);
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-3xl bg-card p-2.5 pr-3 shadow-soft"
                >
                  <img
                    src={place?.image ?? city?.image}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-bold">
                      <Heart className="h-3.5 w-3.5 shrink-0 fill-sea text-sea" />
                      {place?.name ?? city?.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {city ? `${city.name}, ${city.country}` : ""}
                    </p>
                    {city && (
                      <Link
                        to="/create-trip"
                        search={{ city: city.id }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary-strong hover:underline"
                      >
                        <Plane className="h-3 w-3" /> Plan a Trip
                      </Link>
                    )}
                  </div>
                  <button
                    aria-label="Remove from bucket list"
                    onClick={() => removeBucket(b.id)}
                    className="tap flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-sea"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Your list is empty"
            body="Tap the heart on places you love to save them here."
          >
            <Link to="/explore" className={pillButton({ variant: "soft" })}>
              <Compass className="h-4 w-4" />
              Explore places
            </Link>
          </EmptyState>
        )}
      </section>
    </Page>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`rounded-2xl px-4 py-2 text-center ${tone}`}>
      <p className="font-display text-2xl font-semibold">{n}</p>
      <p className="whitespace-nowrap text-[11px] font-bold">{label}</p>
    </div>
  );
}

function ActiveCard({ tripId }: { tripId: string }) {
  const { getTrip, today } = useApp();
  const trip = getTrip(tripId);
  if (!trip) return null;
  const city = getCity(trip.cityId);
  const di = tripDayIndex(trip, today);
  const prog = tripProgress(trip);
  const next = trip.days[di]?.activities.find((a) => a.status === "pending" && a.kind === "place");
  return (
    <section className="mt-6">
      <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-foreground to-sea-strong p-5 text-background shadow-lift">
        <img
          src={city?.image}
          alt=""
          aria-hidden
          className="absolute -right-10 -top-10 h-48 w-48 rotate-6 rounded-3xl object-cover opacity-30"
        />
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-butter">
          <Sparkles className="h-3.5 w-3.5" />
          Live now
        </p>
        <h3 className="mt-1 text-2xl font-semibold">Your Adventure Is in Progress!</h3>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
          <MapPin className="h-4 w-4" />
          {city?.name}, {city?.country} · Day {di + 1} of {trip.days.length}
        </p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-bold">
            <span>
              {prog.done} of {prog.total} places visited
            </span>
            <span>{prog.pct}%</span>
          </div>
          <ProgressBar value={prog.pct} tone="light" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm">
            <Navigation className="h-4 w-4" />
            Next:{" "}
            <b>
              {next
                ? `${getPlace(next.placeId)?.name} · ${fmtTime(next.start)}`
                : "All done for today!"}
            </b>
          </p>
          <TripLink
            trip={trip}
            view="active"
            className={pillButton({ variant: "glass", size: "sm" })}
          >
            Continue Exploring <ArrowRight className="h-4 w-4" />
          </TripLink>
        </div>
      </article>
    </section>
  );
}
