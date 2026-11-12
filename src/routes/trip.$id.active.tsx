import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Camera,
  Lightbulb,
  Lock,
  Map,
  MapPin,
  Navigation,
  Umbrella,
  Wand2,
  Check,
  Minus,
} from "lucide-react";
import { WEATHER_ICON } from "@/components/app/Weather";
import { crowdAt, crowdLabel } from "@/lib/crowds";
import { useRoute, useTripWeather } from "@/lib/hooks";
import { modeIcon } from "@/components/app/Timeline";
import {
  Card,
  EmptyState,
  EstimateNote,
  Page,
  PageHeader,
  ProgressBar,
  Tag,
  pillButton,
} from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { fmtDuration, fmtHours, fmtTime, formatShort } from "@/lib/dates";
import { tripDayIndex, tripPhase, tripProgress, isCapsuleUnlocked } from "@/lib/trip-status";
import { useApp } from "@/lib/store";
import { routeService, SERVICE_STATUS } from "@/services";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/active")({
  head: () => seo("Travel mode", "Today's plan, your next stop and photo check-ins."),
  component: Active,
});

function Active() {
  const { id } = Route.useParams();
  const { getTrip, today } = useApp();
  const trip = getTrip(id);
  const { weather: wx } = useTripWeather(trip);
  const di0 = trip ? tripDayIndex(trip, today) : 0;
  const places0 = (trip?.days[di0]?.activities ?? []).filter((a) => a.kind === "place");
  const cur0 = getPlace(places0.find((a) => a.status === "pending")?.placeId);
  const prev0 = getPlace(
    [...places0].reverse().find((a) => a.status !== "pending" && a.placeId)?.placeId,
  );
  const leg = useRoute(prev0 && cur0 ? [prev0, cur0] : [], trip?.transport ?? "walk");
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const city = getCity(trip.cityId);
  const phase = tripPhase(trip, today);

  if (phase !== "active") {
    return (
      <Page>
        <PageHeader title="Travel Mode" subtitle={trip.name} />
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title={
            phase === "upcoming"
              ? "Your trip hasn't started yet"
              : phase === "past"
                ? "This trip has ended"
                : "This trip is still a draft"
          }
          body={
            phase === "upcoming"
              ? `Travel Mode opens on ${formatShort(trip.startDate)}.`
              : "Head to Memories to revisit it."
          }
        />
      </Page>
    );
  }

  const di = tripDayIndex(trip, today);
  const day = trip.days[di];
  const prog = tripProgress(trip);
  const places = (day?.activities ?? []).filter((a) => a.kind === "place");
  const current = places.find((a) => a.status === "pending");
  const currentPlace = getPlace(current?.placeId);
  const prev = [...places].reverse().find((a) => a.status !== "pending" && a.placeId);
  const prevPlace = getPlace(prev?.placeId);
  const later = places.filter((a) => a.status === "pending" && a.id !== current?.id);
  const done = places.filter((a) => a.status !== "pending");
  const weather = wx[today];
  const WI = weather ? WEATHER_ICON[weather.icon] : null;
  const ModeIcon = modeIcon[trip.transport];
  const travel =
    prevPlace && currentPlace
      ? (leg.data?.legs[0]?.minutes ??
        routeService.estimate(prevPlace, currentPlace).find((r) => r.mode === trip.transport)
          ?.minutes)
      : null;
  const isFinal = isCapsuleUnlocked(trip, today);

  return (
    <Page>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-sea">Travel Mode</p>
          <h1 className="text-3xl font-semibold">
            {city?.name} · Day {di + 1} of {trip.days.length}
          </h1>
        </div>
        {weather && WI && (
          <div
            className="rounded-2xl bg-card px-3 py-2 text-center shadow-soft"
            title={`${weather.summary}. ${SERVICE_STATUS.weather}`}
          >
            <WI className="mx-auto h-5 w-5 text-sea" />
            <p className="text-xs font-bold">
              {weather.max}° / {weather.min}°
            </p>
            <p className="text-[9px] text-muted-foreground">
              {weather.source === "forecast" ? weather.summary : "typical"}
            </p>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs font-bold">
          <span>
            Trip progress · {prog.done}/{prog.total} stops
          </span>
          <span>{prog.pct}%</span>
        </div>
        <ProgressBar value={prog.pct} />
      </div>

      {isFinal && (
        <Link
          to="/trip/$id/capsule"
          params={{ id }}
          className="tap mt-4 block rounded-3xl bg-butter p-4 font-bold"
        >
          It's your final day, and your time capsule is unlocked! Tap to open.
        </Link>
      )}

      {weather?.rainy && (
        <Link
          to="/trip/$id/assistant"
          params={{ id }}
          search={{ pick: "rain" }}
          className="tap mt-4 flex items-center gap-3 rounded-3xl bg-sea-soft p-4 text-sm font-bold"
        >
          <Umbrella className="h-5 w-5 text-sea-strong" />
          <span className="flex-1">Rain on the way today. Want us to move things indoors?</span>
        </Link>
      )}

      {current && currentPlace ? (
        <article className="mt-5 overflow-hidden rounded-[2rem] bg-card shadow-lift">
          <div className="relative h-56">
            <img
              src={currentPlace.image}
              alt={currentPlace.name}
              className="h-full w-full object-cover"
            />
            <div className="photo-fade absolute inset-0" />
            <Tag tone="butter" className="absolute left-4 top-4">
              {prev ? "Next stop" : "First stop today"}
            </Tag>
            <div className="absolute bottom-4 left-4 right-4 text-on-photo">
              <h2 className="text-3xl font-semibold leading-tight">{currentPlace.name}</h2>
              <p className="text-sm font-semibold">
                {fmtTime(current.start)} · {fmtDuration(current.duration)} ·{" "}
                {fmtHours(currentPlace.open, currentPlace.close)}
              </p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {travel !== null && travel !== undefined && (
              <p className="flex items-center gap-2 text-sm font-bold">
                <ModeIcon className="h-5 w-5 text-sea" />~{travel} min from {prevPlace?.name}
                {leg.data?.legs[0] ? ` · ${leg.data.legs[0].km} km` : ""}
              </p>
            )}
            <p className="text-xs font-bold text-muted-foreground">
              Expect it to be{" "}
              {crowdLabel(crowdAt(currentPlace, today, current.start)).toLowerCase()} around{" "}
              {fmtTime(current.start)}
            </p>
            {currentPlace.funFact && (
              <p className="flex gap-2 rounded-2xl bg-butter/70 p-3 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />
                <span>
                  <b>While you're there:</b> {currentPlace.funFact}
                </span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={routeService.directionsUrl(currentPlace, trip.transport, prevPlace)}
                target="_blank"
                rel="noreferrer"
                className={pillButton({ variant: "outline", size: "lg" })}
              >
                <Navigation className="h-5 w-5" />
                Directions
              </a>
              <Link to="/trip/$id/checkin" params={{ id }} className={pillButton({ size: "lg" })}>
                <Camera className="h-5 w-5" />
                Photo Check-In
              </Link>
            </div>
          </div>
        </article>
      ) : (
        <Card className="mt-5 text-center">
          <p className="font-display text-xl font-semibold">All done for today!</p>
          <p className="text-sm text-muted-foreground">Rest up! Tomorrow's plan will be ready.</p>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to="/trip/$id/assistant"
          params={{ id }}
          className={pillButton({ variant: "sea", size: "lg" })}
        >
          <Wand2 className="h-5 w-5" />
          Change My Plans
        </Link>
        <Link
          to="/trip/$id/map"
          params={{ id }}
          search={{ day: di }}
          className={pillButton({ variant: "soft", size: "lg" })}
        >
          <Map className="h-5 w-5" />
          View Map
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Today's itinerary</h2>
        <ol className="space-y-2">
          {done.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 opacity-80 shadow-soft"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${a.status === "done" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {a.status === "done" ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
              </span>
              <span className="flex-1 font-bold line-through decoration-2">
                {getPlace(a.placeId)?.name}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {a.status === "done" ? "Checked in" : "Skipped"}
              </span>
            </li>
          ))}
          {current && (
            <li className="flex items-center gap-3 rounded-2xl bg-primary-soft p-3 shadow-soft ring-2 ring-primary">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sea text-xs font-extrabold text-primary-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-card" />
              </span>
              <span className="flex-1 font-bold">{currentPlace?.name}</span>
              <span className="text-xs font-bold">{fmtTime(current.start)}</span>
            </li>
          )}
          {later.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-dashed bg-card/50 p-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="flex-1 text-sm font-bold text-muted-foreground">
                Stop {done.length + 2 + i} · revealed after your check-in
              </span>
              <span className="text-xs font-bold text-muted-foreground">{fmtTime(a.start)}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="mt-4">
        <EstimateNote>
          {SERVICE_STATUS.weather}. {SERVICE_STATUS.routes}.
        </EstimateNote>
      </div>
    </Page>
  );
}
