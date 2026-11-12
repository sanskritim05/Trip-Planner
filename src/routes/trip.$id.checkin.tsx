import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Lock,
  Navigation,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { inputCls, pillButton } from "@/components/app/ui";
import { Burst } from "@/components/app/whimsy";
import { getPlace } from "@/data/registry";
import { fmtTime } from "@/lib/dates";
import { tripDayIndex, tripProgress, isCapsuleUnlocked } from "@/lib/trip-status";
import { useApp } from "@/lib/store";
import { compressImage, routeService } from "@/services";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trip/$id/checkin")({
  head: () => seo("Photo check-in", "Snap a photo to complete this stop and reveal the next one."),
  component: CheckIn,
});

type Done = { kind: "photo" | "skip"; src?: string; placeName: string };

function CheckIn() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, today, uid, state, nudgeTaste, tasteKeys } = useApp();
  const trip = getTrip(id);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const upRef = useRef<HTMLInputElement>(null);
  if (!trip) return null;
  const di = tripDayIndex(trip, today);
  const day = trip.days[di];
  const current = day?.activities.find((a) => a.kind === "place" && a.status === "pending");
  const place = getPlace(current?.placeId);
  const next = done
    ? day?.activities.find((a) => a.kind === "place" && a.status === "pending")
    : undefined;
  const nextPlace = getPlace(next?.placeId);
  const lastPlace = done
    ? getPlace(
        [...(day?.activities ?? [])].reverse().find((a) => a.status !== "pending" && a.placeId)
          ?.placeId,
      )
    : undefined;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    setBusy(true);
    try {
      setPreview(await compressImage(f));
    } catch {
      toast.error("Couldn't read that photo");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!current || !place || !preview) return;
    updateTrip(id, (t) => ({
      ...t,
      photos: [
        ...t.photos,
        {
          id: uid("ph"),
          activityId: current.id,
          placeId: place.id,
          day: di,
          src: preview,
          caption: caption.trim(),
          createdAt: new Date().toISOString(),
          ...(state.user ? { by: state.user.name } : {}),
        },
      ],
      days: t.days.map((d, i) =>
        i === di
          ? {
              ...d,
              activities: d.activities.map((a) =>
                a.id === current.id ? { ...a, status: "done" as const } : a,
              ),
            }
          : d,
      ),
    }));
    nudgeTaste(tasteKeys(place), 0.5);
    setDone({ kind: "photo", src: preview, placeName: place.name });
    setPreview(null);
    setCaption("");
  };

  const skip = () => {
    if (!current || !place) return;
    updateTrip(id, (t) => ({
      ...t,
      days: t.days.map((d, i) =>
        i === di
          ? {
              ...d,
              activities: d.activities.map((a) =>
                a.id === current.id ? { ...a, status: "skipped" as const } : a,
              ),
            }
          : d,
      ),
    }));
    nudgeTaste(tasteKeys(place), -0.4);
    setDone({ kind: "skip", placeName: place.name });
  };

  const prog = tripProgress(getTrip(id) ?? trip);

  return (
    <main className="page-enter mx-auto min-h-screen max-w-lg px-5 pb-10 pt-5">
      <Link
        to="/trip/$id/active"
        params={{ id }}
        aria-label="Back to trip"
        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>

      {done ? (
        <div className="relative mt-6 text-center">
          {done.kind === "photo" && <Burst trigger={1} count={16} />}
          <div className="unlock-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-3 text-3xl font-semibold">
            {done.kind === "photo" ? "Checked in!" : "Stop skipped"}
          </h1>
          <p className="text-muted-foreground">
            {done.placeName} · trip {prog.pct}% complete
          </p>
          {done.src && (
            <figure className="polaroid mx-auto mt-5 w-64 -rotate-2">
              <img
                src={done.src}
                alt="Your check-in"
                className="aspect-square w-full rounded-sm object-cover"
              />
              <figcaption className="mt-2 flex items-center justify-center gap-1 font-script text-lg text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                {isCapsuleUnlocked(trip, today)
                  ? "Added to your time capsule"
                  : "Sealed in your time capsule"}
              </figcaption>
            </figure>
          )}
          {nextPlace && next ? (
            <div className="mt-6 overflow-hidden rounded-3xl bg-card text-left shadow-lift animate-in fade-in slide-in-from-bottom-4">
              <img src={nextPlace.image} alt="" className="h-36 w-full object-cover" />
              <div className="p-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-sea">
                  Next destination unlocked
                </p>
                <p className="font-display text-2xl font-semibold">{nextPlace.name}</p>
                <p className="text-sm text-muted-foreground">
                  Around {fmtTime(next.start)}
                  {lastPlace
                    ? ` · ~${routeService.estimate(lastPlace, nextPlace).find((r) => r.mode === trip.transport)?.minutes} min ${trip.transport === "walk" ? "walk" : trip.transport}`
                    : ""}
                </p>
                <a
                  href={routeService.directionsUrl(nextPlace, trip.transport)}
                  target="_blank"
                  rel="noreferrer"
                  className={pillButton({ size: "lg", className: "mt-3 w-full" })}
                >
                  <Navigation className="h-5 w-5" />
                  Directions to next stop
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-3xl bg-card p-5 font-bold shadow-soft">
              That's everything for today
            </p>
          )}
          <Link
            to="/trip/$id/active"
            params={{ id }}
            className={pillButton({ variant: "outline", size: "lg", className: "mt-4 w-full" })}
          >
            Back to Travel Mode
          </Link>
        </div>
      ) : !current || !place ? (
        <div className="mt-10 text-center">
          <p className="font-display text-2xl font-semibold">No stop to check in right now</p>
          <p className="text-muted-foreground">You've completed today's plan.</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-wider text-sea">
            Photo check-in
          </p>
          <h1 className="text-3xl font-semibold leading-tight">{place.name}</h1>
          <p className="text-sm text-muted-foreground">Snap a moment here to complete this stop.</p>
          <div className="mt-5 overflow-hidden rounded-[2rem] bg-secondary">
            {preview ? (
              <img
                src={preview}
                alt="Your photo preview"
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="h-12 w-12" />
                <p className="font-bold">{busy ? "Processing…" : "No photo yet"}</p>
              </div>
            )}
          </div>
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={upRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-label="Upload photo"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => camRef.current?.click()}
              className={pillButton({ variant: "dark", size: "lg" })}
            >
              <Camera className="h-5 w-5" />
              Camera
            </button>
            <button
              onClick={() => upRef.current?.click()}
              className={pillButton({ variant: "outline", size: "lg" })}
            >
              <ImagePlus className="h-5 w-5" />
              Upload Photo
            </button>
          </div>
          {preview && (
            <>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={120}
                placeholder="Add a caption (optional)"
                aria-label="Caption"
                className={`${inputCls} mt-4`}
              />
              <button
                onClick={save}
                className={pillButton({ size: "lg", className: "mt-3 w-full" })}
              >
                <CheckCircle2 className="h-5 w-5" />
                Save Check-In
              </button>
            </>
          )}
          <button
            onClick={skip}
            className={pillButton({ variant: "ghost", className: "mt-4 w-full" })}
          >
            <SkipForward className="h-4 w-4" />
            Skip this stop (no photo)
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Your photo is sealed in the trip's time capsule until the final day. Photos are stored
            on this device for now.
          </p>
        </>
      )}
    </main>
  );
}
