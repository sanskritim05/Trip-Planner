import { useState } from "react";
import { Clock, Lightbulb, MapPin, Users, Wallet } from "lucide-react";
import { bestVisitTimes, crowdCurve, crowdLabel } from "@/lib/crowds";
import { fmtDuration, fmtHours, fmtTime } from "@/lib/dates";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/utils";
import { money } from "./ui";

/** Photo, description, fun fact, hours, cost and a crowd forecast for one place. */
export function PlaceDetails({
  place,
  date,
  scheduledAt,
}: {
  place: Place;
  date: string;
  scheduledAt?: number;
}) {
  const curve = crowdCurve(place, date);
  const hours = curve
    .map((v, h) => ({ v, h }))
    .filter((x) => x.h >= Math.max(6, place.open) && x.h < Math.min(24, place.close));
  const best = bestVisitTimes(place, date);
  const [hover, setHover] = useState<number | null>(
    scheduledAt != null ? Math.floor(scheduledAt / 60) : null,
  );
  const sel = hours.find((x) => x.h === hover);
  return (
    <div className="space-y-3">
      <img src={place.image} alt={place.name} className="h-44 w-full rounded-2xl object-cover" />
      <p className="text-sm">{place.description}</p>
      {place.funFact && (
        <p className="flex gap-2 rounded-2xl bg-butter/70 p-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />
          <span>
            <b>Fun fact!</b> {place.funFact}
          </span>
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2 text-xs font-bold">
        <li className="flex items-center gap-1.5 rounded-xl bg-secondary p-2">
          <Clock className="h-3.5 w-3.5 text-sea" />
          {fmtHours(place.open, place.close)}
        </li>
        <li className="flex items-center gap-1.5 rounded-xl bg-secondary p-2">
          <Wallet className="h-3.5 w-3.5 text-sea" />
          {place.cost ? `~${money(place.cost)} pp` : "Free"}
        </li>
        <li className="flex items-center gap-1.5 rounded-xl bg-secondary p-2">
          <Clock className="h-3.5 w-3.5 text-sea" />
          Stay ~{fmtDuration(place.duration)}
        </li>
        {place.address ? (
          <li className="flex items-center gap-1.5 rounded-xl bg-secondary p-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-sea" />
            <span className="truncate">{place.address}</span>
          </li>
        ) : (
          <li className="flex items-center gap-1.5 rounded-xl bg-secondary p-2">
            <MapPin className="h-3.5 w-3.5 text-sea" />
            {place.category}
          </li>
        )}
      </ul>
      {hours.length > 1 && (
        <div className="rounded-2xl bg-secondary p-3">
          <p className="flex items-center justify-between text-xs font-extrabold">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Crowd forecast
            </span>
            <span className="text-muted-foreground">
              {sel ? `${fmtTime(sel.h * 60)}: ${crowdLabel(sel.v)}` : "tap a bar to compare"}
            </span>
          </p>
          <div
            className="mt-2 flex h-16 items-end gap-0.5"
            role="img"
            aria-label="Predicted crowds by hour"
          >
            {hours.map((x) => (
              <button
                key={x.h}
                onClick={() => setHover(x.h)}
                aria-label={`${fmtTime(x.h * 60)} ${crowdLabel(x.v)}`}
                className={cn(
                  "flex-1 rounded-t-md transition-all",
                  x.h === hover
                    ? "bg-primary"
                    : x.v < 30
                      ? "bg-mint"
                      : x.v < 55
                        ? "bg-sea/50"
                        : x.v < 78
                          ? "bg-butter"
                          : "bg-peach",
                )}
                style={{ height: `${Math.max(8, x.v)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-bold text-muted-foreground">
            <span>{fmtTime(hours[0]!.h * 60)}</span>
            <span>{fmtTime(hours[hours.length - 1]!.h * 60)}</span>
          </div>
          {best.length > 0 && (
            <p className="mt-2 text-xs font-bold">
              Quietest times: {best.map((b) => fmtTime(b.hour * 60)).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
