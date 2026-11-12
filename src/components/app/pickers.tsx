import { useId, type ReactNode } from "react";
import { Check, Minus, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Choice<T extends string> = { value: T; label: string; desc?: string; icon: LucideIcon };

/**
 * Big tappable cards with an icon, label and optional description.
 * Selected cards lift, tint and show a check that pops in.
 */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  multi = true,
  columns = 3,
  size = "md",
  max,
}: {
  options: Choice<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
  columns?: 2 | 3 | 4;
  size?: "sm" | "md";
  max?: number;
}) {
  const toggle = (v: T) => {
    if (!multi) return onChange([v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (max && value.length >= max) return onChange([...value.slice(1), v]);
    onChange([...value, v]);
  };
  const grid =
    columns === 2
      ? "grid-cols-2"
      : columns === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";
  return (
    <div className={cn("grid gap-3", grid)} role={multi ? "group" : "radiogroup"}>
      {options.map((o) => {
        const on = value.includes(o.value);
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? undefined : "radio"}
            aria-checked={multi ? undefined : on}
            aria-pressed={multi ? on : undefined}
            onClick={() => toggle(o.value)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-3xl border-2 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 active:scale-95",
              size === "sm" ? "p-3" : "p-4",
              on
                ? "-translate-y-0.5 border-primary bg-gradient-to-br from-primary-soft to-card shadow-soft"
                : "border-transparent bg-card shadow-soft hover:-translate-y-0.5 hover:border-primary/30",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-2xl transition-all duration-300",
                size === "sm" ? "h-9 w-9" : "h-11 w-11",
                on
                  ? "rotate-[-6deg] scale-110 bg-primary text-primary-foreground"
                  : "bg-sea-soft text-sea-strong group-hover:rotate-[-6deg]",
              )}
            >
              <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
            </span>
            <span
              className={cn(
                "font-extrabold leading-tight",
                size === "sm" ? "text-sm" : "text-base",
              )}
            >
              {o.label}
            </span>
            {o.desc && size === "md" && (
              <span className="text-xs font-semibold text-muted-foreground">{o.desc}</span>
            )}
            <span
              className={cn(
                "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300",
                on ? "scale-100 opacity-100" : "scale-0 opacity-0",
              )}
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type Stop<T extends string> = { value: T; label: string; desc: string; icon: LucideIcon };

/**
 * A draggable slider over a few named stops. The big card above the track
 * swaps its icon and description as you move.
 */
export function StepSlider<T extends string>({
  stops,
  value,
  onChange,
  label,
}: {
  stops: Stop<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  const idx = Math.max(
    0,
    stops.findIndex((s) => s.value === value),
  );
  const cur = stops[idx]!;
  const Icon = cur.icon;
  const pct = stops.length > 1 ? (idx / (stops.length - 1)) * 100 : 0;
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <div
        key={cur.value}
        className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300"
      >
        <span className="flex h-14 w-14 shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <Icon className="h-7 w-7" />
        </span>
        <div>
          <p className="font-display text-2xl font-semibold leading-tight">{cur.label}</p>
          <p className="text-sm text-muted-foreground">{cur.desc}</p>
        </div>
      </div>
      <div className="relative mt-6">
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-secondary" />
        <div
          className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-sea to-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={idx}
          aria-label={label}
          aria-valuetext={cur.label}
          onChange={(e) => onChange(stops[Number(e.target.value)]!.value)}
          className="ans-range relative z-10 w-full"
        />
      </div>
      <div className="mt-2 flex justify-between">
        {stops.map((s, i) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={cn(
              "text-xs font-extrabold transition-colors",
              i === idx ? "text-primary-strong" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Plus/minus counter with a bouncing number. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
  children,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl bg-card p-4 shadow-soft">
      <div className="min-w-0">
        <p className="font-bold">{label}</p>
        {children}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-secondary disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          key={value}
          className="w-8 text-center font-display text-3xl font-semibold animate-in zoom-in-50 duration-200"
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
