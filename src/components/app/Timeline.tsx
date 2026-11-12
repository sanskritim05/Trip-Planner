import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bike,
  Bus,
  Car,
  Check,
  Clock,
  Footprints,
  Pencil,
  Trash2,
  Utensils,
  Wallet,
  AlertTriangle,
  SkipForward,
  Users,
  CloudRain,
} from "lucide-react";
import { getPlace } from "@/data/registry";
import { crowdAt, crowdLabel } from "@/lib/crowds";
import { isIndoor } from "@/lib/itinerary";
import { fmtDuration, fmtHours, fmtTime } from "@/lib/dates";
import type { Activity, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tag, money } from "./ui";

export const modeIcon = { walk: Footprints, transit: Bus, drive: Car, bike: Bike } as const;
export const modeLabel: Record<Mode, string> = { walk: "walk", transit: "transit", drive: "drive" };

export function Timeline({
  activities,
  mode,
  priorityIds,
  editable,
  onEdit,
  onRemove,
  onMove,
  onReorder,
  date,
  rainy,
}: {
  activities: Activity[];
  mode: Mode;
  priorityIds: Set<string>;
  editable?: boolean;
  date?: string;
  rainy?: boolean;
  onEdit?: (a: Activity) => void;
  onRemove?: (a: Activity) => void;
  onMove?: (a: Activity, dir: -1 | 1) => void;
  /** Drag-and-drop: move the dragged activity to the position of `targetId`. */
  onReorder?: (draggedId: string, targetId: string) => void;
}) {
  const ModeIcon = modeIcon[mode];
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-0.5 before:bg-border">
      {activities.map((a, i) => {
        const place = getPlace(a.placeId);
        const next = activities[i + 1];
        return (
          <li
            key={a.id}
            className={cn(
              "relative rounded-3xl transition-all duration-200",
              dragId === a.id && "scale-[0.98] opacity-50",
              overId === a.id &&
                dragId !== a.id &&
                "ring-2 ring-primary ring-offset-4 ring-offset-background",
            )}
            draggable={!!onReorder && editable && a.status === "pending"}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", a.id);
              setDragId(a.id);
            }}
            onDragOver={(e) => {
              if (!dragId || a.status !== "pending") return;
              e.preventDefault();
              setOverId(a.id);
            }}
            onDragLeave={() => setOverId((o) => (o === a.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== a.id) onReorder?.(dragId, a.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <div className="flex gap-3">
              <div
                className={cn(
                  "relative z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-[11px] font-extrabold leading-tight shadow-soft",
                  a.status === "done"
                    ? "bg-primary text-primary-foreground"
                    : a.status === "skipped"
                      ? "bg-muted text-muted-foreground"
                      : "bg-card",
                )}
              >
                {a.status === "done" ? (
                  <Check className="h-5 w-5" />
                ) : a.status === "skipped" ? (
                  <SkipForward className="h-4 w-4" />
                ) : (
                  fmtTime(a.start)
                    .replace(" ", "\n")
                    .split("\n")
                    .map((s) => <span key={s}>{s}</span>)
                )}
              </div>
              {a.kind === "meal" ? (
                <div className="flex flex-1 items-center gap-3 rounded-3xl bg-secondary p-3">
                  <Utensils className="h-5 w-5 text-sea" />
                  <div className="flex-1">
                    <p className="font-bold">{a.label ?? "Meal break"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtTime(a.start)} · {fmtDuration(a.duration)} · find something nearby
                    </p>
                  </div>
                  {editable && (
                    <Controls a={a} onEdit={onEdit} onRemove={onRemove} onMove={onMove} />
                  )}
                </div>
              ) : place ? (
                <article
                  className={cn(
                    "flex-1 overflow-hidden rounded-3xl bg-card shadow-soft",
                    a.status === "skipped" && "opacity-60",
                  )}
                >
                  <div className="flex gap-3 p-3">
                    <img
                      src={place.image}
                      alt={place.name}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {priorityIds.has(place.id) ? (
                          <Tag tone="sea" className="py-0.5 text-[10px]">
                            Must-Visit
                          </Tag>
                        ) : (
                          <Tag className="py-0.5 text-[10px]">Recommended</Tag>
                        )}
                        {a.status === "done" && (
                          <Tag tone="mint" className="py-0.5 text-[10px]">
                            Checked in
                          </Tag>
                        )}
                        {a.status === "skipped" && (
                          <Tag tone="sand" className="py-0.5 text-[10px]">
                            Skipped
                          </Tag>
                        )}
                      </div>
                      <p className="mt-1 font-bold leading-tight">{place.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {place.description}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] font-bold text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {fmtTime(a.start)} · {fmtDuration(a.duration)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Wallet className="h-3 w-3" />
                          {place.cost ? `~${money(place.cost)}` : "Free"}
                        </span>
                        <span>{fmtHours(place.open, place.close)}</span>
                      </div>
                      {date &&
                        a.status === "pending" &&
                        (() => {
                          const c = crowdAt(place, date, a.start);
                          return (
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-extrabold">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5",
                                  c < 30
                                    ? "bg-mint"
                                    : c < 55
                                      ? "bg-sea-soft"
                                      : c < 78
                                        ? "bg-butter"
                                        : "bg-peach",
                                )}
                              >
                                <Users className="mr-1 inline h-3 w-3" />
                                {crowdLabel(c)} then
                              </span>
                              {rainy && !isIndoor(place) && (
                                <span className="rounded-full bg-sea-soft px-2 py-0.5">
                                  <CloudRain className="mr-1 inline h-3 w-3" />
                                  outdoors
                                </span>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                  {a.conflict && (
                    <p className="flex items-center gap-1.5 bg-sea-soft px-3 py-1.5 text-xs font-bold">
                      <AlertTriangle className="h-3.5 w-3.5 text-sea" />
                      {a.conflict}
                    </p>
                  )}
                  {editable && a.status === "pending" && (
                    <div className="flex justify-end border-t px-2 py-1.5">
                      <Controls a={a} onEdit={onEdit} onRemove={onRemove} onMove={onMove} />
                    </div>
                  )}
                </article>
              ) : null}
            </div>
            {next && next.travelMin > 0 && (
              <p className="ml-[68px] mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <ModeIcon className="h-3.5 w-3.5" />~{next.travelMin} min {modeLabel[mode]} to next
                stop
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Controls({
  a,
  onEdit,
  onRemove,
  onMove,
}: {
  a: Activity;
  onEdit?: ((a: Activity) => void) | undefined;
  onRemove?: ((a: Activity) => void) | undefined;
  onMove?: ((a: Activity, d: -1 | 1) => void) | undefined;
}) {
  const btn = "tap flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary";
  return (
    <div className="flex gap-0.5">
      {onMove && (
        <button className={btn} aria-label="Move earlier" onClick={() => onMove(a, -1)}>
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
      {onMove && (
        <button className={btn} aria-label="Move later" onClick={() => onMove(a, 1)}>
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
      {onEdit && (
        <button className={btn} aria-label="Edit activity" onClick={() => onEdit(a)}>
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onRemove && (
        <button
          className={cn(btn, "text-sea")}
          aria-label="Remove activity"
          onClick={() => onRemove(a)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
