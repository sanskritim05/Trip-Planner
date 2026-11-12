import { useEffect, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronLeft, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const pillButton = cva(
  "tap inline-flex select-none items-center justify-center gap-2 rounded-full font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-soft hover:shadow-lift hover:brightness-105",
        dark: "bg-foreground text-background shadow-soft hover:shadow-lift",
        sea: "bg-sea text-primary-foreground shadow-soft hover:shadow-lift",
        soft: "bg-primary-soft text-foreground hover:bg-accent",
        outline: "border border-border bg-card text-foreground hover:bg-secondary",
        glass: "bg-on-photo/90 text-foreground backdrop-blur hover:bg-on-photo",
        ghost: "text-primary-strong hover:bg-primary-soft",
        danger: "bg-destructive text-destructive-foreground",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
export type PillVariants = VariantProps<typeof pillButton>;

export function SectionHeading({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {title} {icon && <span className="text-sea">{icon}</span>}
        </h2>
        {subtitle && <p className="mt-0.5 font-script text-xl text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  blush: "bg-primary-soft",
  sea: "bg-sea-soft",
  peach: "bg-peach",
  lilac: "bg-lilac",
  mint: "bg-mint",
  butter: "bg-butter",
  sand: "bg-secondary",
} as const;
export type Tone = keyof typeof tones;
export const TONE_CYCLE: Tone[] = ["blush", "sea", "butter", "mint", "lilac", "peach"];

export function Tag({
  children,
  tone = "blush",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-foreground",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "tap shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-card text-foreground hover:border-primary",
      )}
    >
      {children}
    </button>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multi = true,
  labels,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o}
          selected={value.includes(o)}
          onClick={() =>
            onChange(
              multi ? (value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : [o],
            )
          }
        >
          {labels?.[o] ?? o}
        </Chip>
      ))}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "blush",
}: {
  value: number;
  className?: string;
  tone?: "blush" | "sea" | "light";
}) {
  const fill = tone === "sea" ? "bg-sea" : tone === "light" ? "bg-on-photo" : "bg-primary";
  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full",
        tone === "light" ? "bg-on-photo/25" : "bg-secondary",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700", fill)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Steps({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels?: string[];
}) {
  return (
    <div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < current ? "bg-primary" : "bg-secondary",
            )}
          />
        ))}
      </div>
      {labels && (
        <p className="mt-2 text-xs font-bold text-muted-foreground">
          Step {current} of {total} · {labels[current - 1]}
        </p>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-primary/30 bg-card/70 p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        {icon}
      </div>
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mx-auto mb-4 mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back = true,
  action,
  backTo,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  backTo?: string;
}) {
  const router = useRouter();
  return (
    <header className="mb-5 flex items-start gap-3">
      {back &&
        (backTo ? (
          <Link
            to={backTo}
            aria-label="Go back"
            className="tap mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <button
            onClick={() => router.history.back()}
            aria-label="Go back"
            className="tap mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ))}
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Page({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        "page-enter mx-auto w-full px-5 pb-32 pt-5 lg:pb-12 lg:pt-8",
        wide ? "max-w-5xl" : "max-w-3xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl bg-card p-5 shadow-soft", className)}>{children}</div>;
}

export function EstimateNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-2xl bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{children}</span>
    </p>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close"
        className="absolute inset-0 bg-overlay/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-lift animate-in slide-in-from-bottom-6 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-bold text-destructive">{error}</span>}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-all",
          checked ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

export function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}
