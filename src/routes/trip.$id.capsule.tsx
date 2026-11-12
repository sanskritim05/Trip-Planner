import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookHeart, Camera, Lock, MapPin, Pencil, Sparkles, Unlock, Users } from "lucide-react";
import { Burst } from "@/components/app/whimsy";
import { Page, PageHeader, pillButton } from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { daysUntil, formatRange, formatShort } from "@/lib/dates";
import {
  isCapsuleUnlocked,
  isScrapbookReleased,
  scrapbookReleaseDate,
  tripProgress,
} from "@/lib/trip-status";
import { useApp } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/capsule")({
  head: () => seo("Time capsule", "Photos from your trip, unlocked on the final day."),
  component: Capsule,
});

function Capsule() {
  const { id } = Route.useParams();
  const { getTrip, today, updateTrip } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const trip = getTrip(id);
  const [opened, setOpened] = useState(false);
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const city = getCity(trip.cityId);
  const unlocked = isCapsuleUnlocked(trip, today);
  const prog = tripProgress(trip);
  const checkins = trip.days
    .flatMap((d) => d.activities)
    .filter((a) => a.status === "done" && a.kind === "place").length;
  const released = isScrapbookReleased(trip, today);

  if (!unlocked) {
    const left = daysUntil(trip.endDate, today);
    return (
      <Page>
        <PageHeader
          title="Time Capsule"
          subtitle={`${city?.name} · ${formatRange(trip.startDate, trip.endDate)}`}
        />
        <div className="relative overflow-hidden rounded-[2rem] bg-foreground p-6 text-center text-background shadow-lift">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-background/10">
            <Lock className="h-9 w-9 text-butter" />
          </div>
          <p className="mt-4 font-display text-2xl font-semibold">
            Your memories are waiting to be unlocked.
          </p>
          <p className="mt-1 text-sm opacity-80">
            Opens on the final day of your trip: {formatShort(trip.endDate)}
          </p>
          {trip.group && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 text-xs font-bold">
              <Users className="h-3.5 w-3.5" />
              Shared capsule · photos from all {trip.group.members.length} travelers
            </p>
          )}
          <p className="mt-4 font-display text-5xl font-semibold text-butter">{left}</p>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">
            day{left === 1 ? "" : "s"} to go
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-background/10 p-3">
              <Camera className="h-4 w-4 text-butter" />
              <p className="mt-1 text-2xl font-bold">{trip.photos.length}</p>
              <p className="text-xs opacity-80">photos collected</p>
            </div>
            <div className="rounded-2xl bg-background/10 p-3">
              <MapPin className="h-4 w-4 text-butter" />
              <p className="mt-1 text-2xl font-bold">
                {checkins}/{prog.total}
              </p>
              <p className="text-xs opacity-80">check-ins done</p>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {Array.from({ length: Math.max(6, trip.photos.length) }, (_, i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-2xl bg-secondary"
            >
              {i < trip.photos.length ? (
                <Lock className="h-6 w-6 text-primary-strong" />
              ) : (
                <Camera className="h-5 w-5 text-border" />
              )}
            </div>
          ))}
        </div>
      </Page>
    );
  }

  if (!opened) {
    return (
      <Page>
        <PageHeader
          title="Time Capsule"
          subtitle={`${city?.name} · ${formatRange(trip.startDate, trip.endDate)}`}
        />
        <div className="relative flex flex-col items-center rounded-[2rem] bg-gradient-to-br from-butter via-primary-soft to-sea-soft px-6 py-12 text-center shadow-lift">
          <Unlock className="unlock-pop h-16 w-16 text-sea" />
          <h2 className="mt-4 text-3xl font-semibold">Your capsule is ready!</h2>
          <p className="mt-1">
            {trip.photos.length} memories from {city?.name} are waiting.
          </p>
          <button
            onClick={() => setOpened(true)}
            className={pillButton({ variant: "dark", size: "lg", className: "mt-6" })}
          >
            <Sparkles className="h-5 w-5" />
            Open my memories
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Time Capsule"
        subtitle={`${trip.photos.length} memories · ${city?.name}`}
      />
      <div className="relative">
        <Burst trigger={1} count={18} />
      </div>
      {released ? (
        <Link
          to="/trip/$id/scrapbook"
          params={{ id }}
          className="tap mb-6 flex items-center gap-3 rounded-3xl bg-primary p-4 font-bold text-primary-foreground shadow-soft"
        >
          <BookHeart className="h-6 w-6" />
          Your digital scrapbook is ready. Open it
        </Link>
      ) : (
        <div className="mb-6 rounded-3xl bg-secondary p-4 text-sm font-bold">
          Your scrapbook will be ready on {formatShort(scrapbookReleaseDate(trip))}, one day after
          your trip ends.
        </div>
      )}
      {trip.days.map((d, di) => {
        const ps = trip.photos.filter((p) => p.day === di);
        if (!ps.length) return null;
        return (
          <section key={d.date} className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">
              Day {di + 1}{" "}
              <span className="font-script text-lg text-muted-foreground">
                · {formatShort(d.date)}
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {ps.map((p, i) => (
                <figure
                  key={p.id}
                  className="polaroid animate-in fade-in zoom-in-95"
                  style={{
                    transform: `rotate(${((i % 3) - 1) * 2}deg)`,
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <img
                    src={p.src}
                    alt={p.caption || getPlace(p.placeId)?.name || "Memory"}
                    className="aspect-square w-full rounded-sm object-cover"
                  />
                  <figcaption className="mt-2 text-center">
                    {editing === p.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setEditing(null);
                        }}
                      >
                        <input
                          autoFocus
                          defaultValue={p.caption}
                          maxLength={120}
                          aria-label="Caption"
                          placeholder="Write a little note…"
                          onBlur={() => setEditing(null)}
                          onChange={(e) =>
                            updateTrip(id, (t) => ({
                              ...t,
                              photos: t.photos.map((x) =>
                                x.id === p.id ? { ...x, caption: e.target.value } : x,
                              ),
                            }))
                          }
                          className="w-full rounded-lg border bg-card px-2 py-1 text-center font-script text-lg outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => setEditing(p.id)}
                        className="group block w-full font-script text-lg leading-tight"
                      >
                        {p.caption || <span className="text-muted-foreground">add a caption</span>}{" "}
                        <Pencil className="inline h-3 w-3 opacity-0 transition group-hover:opacity-60" />
                      </button>
                    )}
                    <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {getPlace(p.placeId)?.name}
                    </span>
                    {trip.group && p.by && (
                      <span className="block text-[10px] font-bold text-sea-strong">
                        Photo by {p.by}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
      {!trip.photos.length && (
        <p className="rounded-3xl bg-card p-6 text-center text-muted-foreground">
          No photos were checked in on this trip.
        </p>
      )}
    </Page>
  );
}
