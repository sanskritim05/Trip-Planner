import { useEffect, useRef, useState } from "react";
import { Clock, Heart, Info, MapPin, RotateCcw, Sparkles, Wallet, X } from "lucide-react";
import type { Rec } from "@/lib/recommend";
import { fmtDuration, fmtHours } from "@/lib/dates";
import { Modal, Tag, money } from "./ui";
import { cn } from "@/lib/utils";

export function SwipeDeck({
  recs,
  onDecide,
  onUndo,
  canUndo,
}: {
  recs: Rec[];
  onDecide: (placeId: string, yes: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<null | "left" | "right">(null);
  const [info, setInfo] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const top = recs[0];
  const second = recs[1];

  const decide = (yes: boolean) => {
    if (!top || leaving) return;
    setLeaving(yes ? "right" : "left");
    setTimeout(() => {
      onDecide(top.place.id, yes);
      setLeaving(null);
      setDrag({ x: 0, y: 0, active: false });
    }, 260);
  };

  // Keyboard: right arrow = add, left arrow = skip, Backspace/Z = undo, I = more info.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (info || t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") decide(true);
      else if (e.key === "ArrowLeft") decide(false);
      else if ((e.key === "Backspace" || e.key.toLowerCase() === "z") && canUndo) onUndo();
      else if (e.key.toLowerCase() === "i" && top) setInfo(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.active) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  };
  const onPointerUp = () => {
    if (!drag.active) return;
    if (Math.abs(drag.x) > 110) decide(drag.x > 0);
    else setDrag({ x: 0, y: 0, active: false });
  };

  const x = leaving === "right" ? 600 : leaving === "left" ? -600 : drag.x;
  const rot = x / 18;

  return (
    <div>
      <div className="relative mx-auto h-[min(66vh,560px)] w-full max-w-sm">
        {second && (
          <div className="absolute inset-0 scale-[0.95] overflow-hidden rounded-[2rem] bg-card opacity-80 shadow-soft">
            <img src={second.place.image} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {top && (
          <article
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              transform: `translate(${x}px, ${drag.y * 0.2}px) rotate(${rot}deg)`,
              transition: drag.active ? "none" : "transform 260ms ease",
            }}
            className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden rounded-[2rem] bg-card shadow-lift active:cursor-grabbing"
            aria-label={`${top.place.name}. Swipe right to add, left to skip.`}
          >
            <img
              src={top.place.image}
              alt={top.place.name}
              draggable={false}
              className="h-full w-full object-cover"
            />
            <div className="photo-fade absolute inset-0" />
            <span
              style={{ opacity: Math.max(0, x / 120) }}
              className="absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-primary bg-card/85 px-3 py-1 font-display text-2xl font-bold text-primary-strong"
            >
              YES!
            </span>
            <span
              style={{ opacity: Math.max(0, -x / 120) }}
              className="absolute right-5 top-6 rotate-12 rounded-xl border-4 border-sea bg-card/85 px-3 py-1 font-display text-2xl font-bold text-sea-strong"
            >
              NOPE
            </span>
            <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-on-photo">
              <Tag tone="butter">{top.place.category}</Tag>
              <h2 className="text-3xl font-semibold leading-tight">{top.place.name}</h2>
              <p className="text-sm opacity-90">{top.place.description}</p>
              <div className="flex flex-wrap gap-3 text-xs font-bold">
                <span className="flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" />
                  {top.place.cost ? `~${money(top.place.cost)}` : "Free"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {fmtDuration(top.place.duration)}
                </span>
                {top.nearestKm !== null && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {top.nearestKm.toFixed(1)} km from your picks
                  </span>
                )}
              </div>
              <p className="flex items-start gap-1.5 rounded-2xl bg-on-photo/15 p-2 text-xs font-semibold backdrop-blur">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {top.reasons[0]}
              </p>
              <button
                onClick={() => setInfo(true)}
                className="flex items-center gap-1 text-xs font-bold underline"
              >
                <Info className="h-3.5 w-3.5" />
                More Information
              </button>
            </div>
          </article>
        )}
      </div>
      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          aria-label="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          className="tap flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-soft disabled:opacity-40"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          aria-label="Skip"
          disabled={!top}
          onClick={() => decide(false)}
          className="tap flex h-16 w-16 items-center justify-center rounded-full bg-card text-sea shadow-lift disabled:opacity-40"
        >
          <X className="h-7 w-7" />
        </button>
        <button
          aria-label="Add to trip"
          disabled={!top}
          onClick={() => decide(true)}
          className={cn(
            "tap flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift disabled:opacity-40",
          )}
        >
          <Heart className="h-7 w-7 fill-current" />
        </button>
      </div>
      {top && (
        <Modal open={info} onClose={() => setInfo(false)} title={top.place.name}>
          <img src={top.place.image} alt="" className="mb-3 h-44 w-full rounded-2xl object-cover" />
          <p>{top.place.description}</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <b>Hours:</b> {fmtHours(top.place.open, top.place.close)} (typical)
            </li>
            <li>
              <b>Suggested visit:</b> {fmtDuration(top.place.duration)}
            </li>
            <li>
              <b>Estimated cost:</b> {top.place.cost ? money(top.place.cost) : "Free"} per person
            </li>
            {top.place.address && (
              <li>
                <b>Address:</b> {top.place.address}
              </li>
            )}
          </ul>
          {top.place.funFact && (
            <p className="mt-3 rounded-2xl bg-butter/70 p-3 text-sm">
              <b>Fun fact:</b> {top.place.funFact}
            </p>
          )}
          <p className="mt-3 text-sm font-bold">Why we picked it</p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {top.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
