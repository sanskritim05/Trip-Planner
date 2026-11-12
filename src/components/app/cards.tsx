import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarHeart,
  Clapperboard,
  Clock,
  Heart,
  MapPin,
  Star,
  Wallet,
} from "lucide-react";
import type { City, Place, Trip } from "@/lib/types";
import { getCity } from "@/data/registry";
import { daysUntil, fmtDuration, formatRange, formatShort, tripLength } from "@/lib/dates";
import { tripPhase, tripProgress } from "@/lib/trip-status";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ProgressBar, TONE_CYCLE, Tag, money, pillButton } from "./ui";

export function SaveHeart({
  refId,
  kind,
  className,
}: {
  refId: string;
  kind: "destination" | "attraction" | "restaurant";
  className?: string;
}) {
  const { isSaved, toggleSave } = useApp();
  const saved = isSaved(refId);
  return (
    <button
      aria-label={saved ? "Remove from bucket list" : "Save to bucket list"}
      aria-pressed={saved}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleSave(refId, kind);
      }}
      className={cn(
        "tap flex h-10 w-10 items-center justify-center rounded-full bg-on-photo/90 backdrop-blur",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-all",
          saved ? "scale-110 fill-sea text-sea" : "text-foreground",
        )}
      />
    </button>
  );
}

export function DestinationCard({ city, wide }: { city: City; wide?: boolean }) {
  const navigate = useNavigate();
  const go = () => navigate({ to: "/destination/$id", params: { id: city.id } });
  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Explore ${city.name}, ${city.country}`}
      onClick={go}
      onKeyDown={(e) => e.key === "Enter" && go()}
      className={cn(
        "tap group shrink-0 cursor-pointer snap-start overflow-hidden rounded-3xl bg-card shadow-soft hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        wide ? "w-full" : "w-60",
      )}
    >
      <div className="relative h-60 overflow-hidden">
        <img
          src={city.image}
          alt={`${city.name}, ${city.country}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <SaveHeart refId={city.id} kind="destination" className="absolute right-3 top-3" />
        <div className="photo-fade pointer-events-none absolute inset-0" />
        <div className="absolute bottom-3 left-4 text-on-photo">
          <h3 className="text-xl font-semibold leading-tight">{city.name}</h3>
          <p className="flex items-center gap-1 text-xs font-semibold">
            <MapPin className="h-3 w-3" />
            {city.country}
          </p>
        </div>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{city.blurb}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {city.tags.slice(0, 2).map((t, i) => (
              <Tag key={t} tone={TONE_CYCLE[(i + city.id.length) % TONE_CYCLE.length] ?? "blush"}>
                {t}
              </Tag>
            ))}
          </div>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong transition-transform group-hover:translate-x-0.5"
            aria-hidden
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

export function PlaceRow({
  place,
  right,
  badge,
  onClick,
}: {
  place: Place;
  right?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-3xl bg-card p-2.5 pr-3 shadow-soft",
        onClick && "tap cursor-pointer",
      )}
      onClick={onClick}
    >
      <img
        src={place.image}
        alt={place.name}
        loading="lazy"
        className="h-16 w-16 shrink-0 rounded-2xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{place.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{place.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {fmtDuration(place.duration)}
          </span>
          <span className="flex items-center gap-0.5">
            <Wallet className="h-3 w-3" />
            {place.cost ? `~${money(place.cost)}` : "Free"}
          </span>
          {badge}
        </div>
      </div>
      {right}
    </div>
  );
}

export function FilmCard({
  place,
  onAdd,
  cityLabel,
}: {
  place: Place;
  onAdd?: () => void;
  cityLabel?: string | undefined;
}) {
  const city = getCity(place.cityId);
  const where = cityLabel ?? (city ? `${city.name}, ${city.country}` : "");
  if (!place.film) return null;
  return (
    <article className="overflow-hidden rounded-3xl bg-card shadow-soft">
      <div className="relative h-44">
        <img
          src={place.image}
          alt={place.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <SaveHeart refId={place.id} kind="attraction" className="absolute right-3 top-3" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/85 px-3 py-1 text-xs font-bold text-background">
          <Clapperboard className="h-3.5 w-3.5" />
          {place.film.title}
        </span>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold">{place.name}</h3>
        <p className="text-xs font-bold text-muted-foreground">
          {place.film.kind}
          {where ? ` · ${where}` : ""}
        </p>
        <p className="mt-2 text-sm">{place.film.scene}</p>
        {place.address && (
          <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {place.address}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
            target="_blank"
            rel="noreferrer"
            className={pillButton({ variant: "outline", size: "xs" })}
          >
            View on Map
          </a>
          {onAdd && (
            <button onClick={onAdd} className={pillButton({ size: "xs" })}>
              Add to Trip
            </button>
          )}
        </div>
        {place.funFact && (
          <p className="mt-2 rounded-xl bg-butter/60 p-2 text-xs">
            <b>Fun fact:</b> {place.funFact}
          </p>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Photo shows the real-world location today, not a scene still.
        </p>
      </div>
    </article>
  );
}

const statusTone = { active: "sea", upcoming: "blush", draft: "butter", past: "sand" } as const;
const statusLabel = {
  active: "In progress",
  upcoming: "Upcoming",
  draft: "Draft",
  past: "Completed",
} as const;

export function TripCard({ trip, actions }: { trip: Trip; actions?: React.ReactNode }) {
  const { today } = useApp();
  const city = getCity(trip.cityId);
  const phase = tripPhase(trip, today);
  const prog = tripProgress(trip);
  const view: TripView =
    phase === "draft"
      ? resumeView(trip)
      : phase === "active"
        ? "active"
        : phase === "past"
          ? "capsule"
          : "itinerary";
  return (
    <article className="overflow-hidden rounded-3xl bg-card shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative h-36">
        <img
          src={city?.image}
          alt={city?.name ?? "Trip"}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="photo-fade absolute inset-0" />
        <Tag tone={statusTone[phase]} className="absolute left-3 top-3">
          {statusLabel[phase]}
        </Tag>
        {trip.group && (
          <Tag tone="lilac" className="absolute right-3 top-3">
            Group
          </Tag>
        )}
        <div className="absolute bottom-3 left-4 right-4 text-on-photo">
          <h3 className="truncate text-xl font-semibold">
            {trip.name || city?.name || "New trip"}
          </h3>
          <p className="flex items-center gap-1 text-xs font-semibold">
            <MapPin className="h-3 w-3" />
            {city ? `${city.name}, ${city.country}` : "Destination not set"}
          </p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted-foreground">
          {trip.startDate ? (
            <span className="flex items-center gap-1">
              <CalendarHeart className="h-3.5 w-3.5" />
              {formatRange(trip.startDate, trip.endDate)}
            </span>
          ) : (
            <span>Dates not set</span>
          )}
          {trip.startDate && <span>{tripLength(trip.startDate, trip.endDate)} days</span>}
          {phase === "upcoming" && (
            <span className="text-sea">{daysUntil(trip.startDate, today)} days to go</span>
          )}
          {phase === "draft" && <span>Edited {formatShort(trip.updatedAt.slice(0, 10))}</span>}
        </div>
        {phase === "active" && <ProgressBar value={prog.pct} />}
        {phase === "draft" && <ProgressBar value={(Math.min(trip.step, 9) / 9) * 100} tone="sea" />}
        <div className="flex items-center justify-between gap-2">
          <TripLink
            trip={trip}
            view={view}
            className={pillButton({ size: "sm", variant: phase === "draft" ? "soft" : "primary" })}
          >
            {phase === "draft"
              ? "Continue Planning"
              : phase === "active"
                ? "Continue Exploring"
                : phase === "past"
                  ? "View Memories"
                  : "View Trip"}
          </TripLink>
          {actions}
        </div>
      </div>
    </article>
  );
}

export type TripView =
  | "wizard"
  | "must-visit"
  | "swipe"
  | "review"
  | "itinerary"
  | "active"
  | "capsule"
  | "scrapbook"
  | "map"
  | "budget"
  | "group";

export function resumeView(trip: Trip): TripView {
  if (trip.step <= 6) return "wizard";
  if (trip.step === 7) return "must-visit";
  if (trip.step === 8) return "swipe";
  if (trip.step === 9) return "review";
  return "itinerary";
}

export function TripLink({
  trip,
  view,
  className,
  children,
}: {
  trip: Pick<Trip, "id">;
  view: TripView;
  className?: string;
  children: React.ReactNode;
}) {
  const params = { id: trip.id };
  switch (view) {
    case "wizard":
      return (
        <Link to="/create-trip" search={{ tripId: trip.id }} className={className}>
          {children}
        </Link>
      );
    case "must-visit":
      return (
        <Link to="/trip/$id/must-visit" params={params} className={className}>
          {children}
        </Link>
      );
    case "swipe":
      return (
        <Link to="/trip/$id/swipe" params={params} className={className}>
          {children}
        </Link>
      );
    case "review":
      return (
        <Link to="/trip/$id/review" params={params} className={className}>
          {children}
        </Link>
      );
    case "itinerary":
      return (
        <Link to="/trip/$id/itinerary" params={params} className={className}>
          {children}
        </Link>
      );
    case "active":
      return (
        <Link to="/trip/$id/active" params={params} className={className}>
          {children}
        </Link>
      );
    case "capsule":
      return (
        <Link to="/trip/$id/capsule" params={params} className={className}>
          {children}
        </Link>
      );
    case "scrapbook":
      return (
        <Link to="/trip/$id/scrapbook" params={params} className={className}>
          {children}
        </Link>
      );
    case "map":
      return (
        <Link to="/trip/$id/map" params={params} className={className}>
          {children}
        </Link>
      );
    case "budget":
      return (
        <Link to="/trip/$id/budget" params={params} className={className}>
          {children}
        </Link>
      );
    case "group":
      return (
        <Link to="/trip/$id/group" params={params} className={className}>
          {children}
        </Link>
      );
  }
}

export function PriorityStar({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Unmark high priority" : "Mark high priority"}
      className={cn(
        "tap flex h-9 w-9 items-center justify-center rounded-full",
        on ? "bg-butter" : "bg-secondary",
      )}
    >
      <Star className={cn("h-4 w-4", on ? "fill-sea text-sea" : "text-muted-foreground")} />
    </button>
  );
}
