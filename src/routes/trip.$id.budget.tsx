import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, PiggyBank, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  EstimateNote,
  Field,
  Modal,
  Page,
  PageHeader,
  ProgressBar,
  inputCls,
  money,
  pillButton,
} from "@/components/app/ui";
import { addDays, formatShort } from "@/lib/dates";
import { useApp } from "@/lib/store";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/app/ui";
import { getPlace } from "@/data/registry";
import { cheaperOptions, estimateBudget, STAY, total } from "@/lib/budget";
import { layoutDay } from "@/lib/itinerary";
import type { Accommodation } from "@/lib/types";
import { seo } from "@/lib/seo";
import { palette, type PaletteColor } from "@/lib/theme";

export const Route = createFileRoute("/trip/$id/budget")({
  head: () => seo("Budget", "Track estimated and actual spending for your trip."),
  component: Budget,
});

const COLORS: Record<ExpenseCategory, string> = {
  Accommodation: "bg-chart-1",
  Food: "bg-chart-2",
  Transportation: "bg-chart-3",
  Attractions: "bg-chart-4",
  Shopping: "bg-chart-5",
  Other: "bg-chart-6",
};

function Budget() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, uid, today } = useApp();
  const trip = getTrip(id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "Food" as ExpenseCategory,
    amount: "",
    note: "",
    date: today,
  });
  const [err, setErr] = useState<string | undefined>();
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const est = estimateBudget(trip);
  const estTotal = total(est);
  const savings = estTotal > trip.budget * 0.95 ? cheaperOptions(trip) : [];
  const perDay = trip.days.map(
    (d) =>
      d.activities.reduce((s2, a) => s2 + (getPlace(a.placeId)?.cost ?? 0), 0) * trip.travelers +
      (est.Food + est.Accommodation + est.Transportation) / Math.max(1, trip.days.length),
  );
  const applySaving = (sv: (typeof savings)[number]) => {
    if (sv.kind === "swap") {
      updateTrip(id, (t) => ({
        ...t,
        places: [
          ...t.places.filter((p) => p.placeId !== sv.from.id),
          { placeId: sv.to.id, source: "swipe", priority: false },
        ],
        days: t.days.map((d, i) =>
          i === sv.dayIdx
            ? {
                ...d,
                activities: layoutDay(
                  d.activities.map((a) =>
                    a.id === sv.activityId
                      ? {
                          ...a,
                          id: `${sv.to.id}-save`,
                          placeId: sv.to.id,
                          duration: sv.to.duration,
                        }
                      : a,
                  ),
                  getPlace,
                  t.startHour * 60,
                  t.transport,
                ).activities,
              }
            : d,
        ),
      }));
      toast.success(`Swapped ${sv.from.name} for ${sv.to.name}`);
    } else if (sv.kind === "stay") {
      updateTrip(id, (t) => ({ ...t, accommodation: sv.to }));
      toast.success(`Switched to ${STAY[sv.to].label.toLowerCase()}`);
    } else {
      updateTrip(id, (t) => ({ ...t, transport: "transit" }));
      toast.success("Switched to public transit");
    }
  };
  const actual = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = trip.budget - actual;
  const byCat = EXPENSE_CATEGORIES.map((c) => ({
    c,
    actual: trip.expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
    est: (est as Record<string, number>)[c] ?? 0,
  }));
  const maxCat = Math.max(1, ...byCat.map((x) => Math.max(x.actual, x.est)));
  const days = trip.days.length
    ? trip.days.map((d) => d.date)
    : trip.startDate
      ? [trip.startDate]
      : [];
  const daily = days.map((d) => ({
    d,
    v: trip.expenses.filter((e) => e.date === d).reduce((s, e) => s + e.amount, 0),
  }));
  const maxDay = Math.max(1, ...daily.map((x) => x.v));
  const pct = trip.budget ? (actual / trip.budget) * 100 : 0;
  // conic donut from actual by category
  let acc = 0;
  const stops = byCat
    .filter((x) => x.actual > 0)
    .map((x) => {
      const from = (acc / Math.max(1, actual)) * 360;
      acc += x.actual;
      return `${palette[COLORS[x.c].replace("bg-", "") as PaletteColor]} ${from}deg ${(acc / Math.max(1, actual)) * 360}deg`;
    });

  const add = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setErr("Enter an amount greater than 0");
      return;
    }
    updateTrip(id, (t) => ({
      ...t,
      expenses: [
        ...t.expenses,
        { id: uid("e"), category: form.category, amount, note: form.note.trim(), date: form.date },
      ],
    }));
    setOpen(false);
    setForm({ ...form, amount: "", note: "" });
    setErr(undefined);
    toast.success("Expense added");
  };

  return (
    <Page>
      <PageHeader
        title="Budget"
        subtitle={trip.name}
        action={
          <button onClick={() => setOpen(true)} className={pillButton({ size: "sm" })}>
            <Plus className="h-4 w-4" />
            Expense
          </button>
        }
      />
      <Card>
        <div className="flex items-center gap-5">
          <div
            className="relative h-28 w-28 shrink-0 rounded-full"
            style={{
              background: stops.length ? `conic-gradient(${stops.join(",")})` : palette.secondary,
            }}
            aria-hidden
          >
            <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-card">
              <span className="text-[10px] font-bold text-muted-foreground">spent</span>
              <span className="font-display text-lg font-semibold">{Math.round(pct)}%</span>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-bold text-muted-foreground">Total budget</p>
              <p className="font-display text-xl font-semibold">
                {money(trip.budget, trip.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Estimated</p>
              <p className="font-display text-xl font-semibold">{money(estTotal, trip.currency)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Actual spent</p>
              <p className="font-display text-xl font-semibold">{money(actual, trip.currency)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Remaining</p>
              <p
                className={cn(
                  "font-display text-xl font-semibold",
                  remaining < 0 && "text-destructive",
                )}
              >
                {money(remaining, trip.currency)}
              </p>
            </div>
          </div>
        </div>
        <ProgressBar value={pct} tone={pct > 100 ? "sea" : "blush"} className="mt-4" />
      </Card>

      {savings.length > 0 && (
        <Card className="mt-4 bg-mint/60">
          <p className="flex items-center gap-2 font-bold">
            <PiggyBank className="h-5 w-5 text-primary-strong" />
            {estTotal > trip.budget
              ? `About ${money(estTotal - trip.budget, trip.currency)} over. Here's how to save`
              : "Close to your limit? Easy ways to save"}
          </p>
          <ul className="mt-3 space-y-2">
            {savings.map((sv, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 text-sm shadow-soft"
              >
                <span className="flex-1">
                  {sv.kind === "swap" ? (
                    <>
                      <b>{sv.from.name}</b> <ArrowRight className="inline h-3.5 w-3.5" />{" "}
                      <b>{sv.to.name}</b>{" "}
                      <span className="text-muted-foreground">(similar, nearby)</span>
                    </>
                  ) : sv.kind === "stay" ? (
                    <>
                      Stay in a <b>{STAY[sv.to].label.toLowerCase()}</b> instead
                    </>
                  ) : (
                    <>
                      Use <b>public transit</b> instead of driving
                    </>
                  )}
                </span>
                <span className="font-extrabold text-sea-strong">
                  −{money(sv.save, trip.currency)}
                </span>
                <button onClick={() => applySaving(sv)} className={pillButton({ size: "xs" })}>
                  Apply
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-2 font-bold">Where you're staying</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STAY) as Accommodation[]).map((k) => (
            <Chip
              key={k}
              selected={(trip.accommodation ?? "hotel") === k}
              onClick={() => updateTrip(id, (t) => ({ ...t, accommodation: k }))}
            >
              {STAY[k].label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Estimated stay: {money(est.Accommodation, trip.currency)} for {trip.travelers} traveler
          {trip.travelers > 1 ? "s" : ""}.
        </p>
      </Card>

      {perDay.length > 0 && (
        <Card className="mt-4">
          <p className="mb-3 font-bold">Estimated cost per day</p>
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {perDay.map((v, i) => (
              <li key={i} className="rounded-2xl bg-secondary p-2 text-center">
                <span className="block text-[11px] font-bold text-muted-foreground">
                  Day {i + 1}
                </span>
                <span className="font-display text-lg font-semibold">
                  {money(v, trip.currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-3 font-bold">By category</p>
        <div className="space-y-3">
          {byCat.map((x) => (
            <div key={x.c}>
              <div className="flex justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", COLORS[x.c])} />
                  {x.c}
                </span>
                <span>
                  {money(x.actual, trip.currency)}{" "}
                  <span className="text-muted-foreground">
                    / est. {money(x.est, trip.currency)}
                  </span>
                </span>
              </div>
              <div className="relative mt-1 h-2.5 rounded-full bg-secondary">
                <div
                  className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-border"
                  style={{ width: `${(x.est / maxCat) * 100}%` }}
                />
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full", COLORS[x.c])}
                  style={{ width: `${(x.actual / maxCat) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Solid bars = actual spending · dashed outline = estimate
        </p>
      </Card>

      {daily.length > 0 && (
        <Card className="mt-4">
          <p className="mb-3 font-bold">Daily spending</p>
          <div className="flex h-36 items-end gap-2">
            {daily.map((x, i) => (
              <div key={x.d} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold">
                  {x.v ? money(x.v, trip.currency) : ""}
                </span>
                <div
                  className="w-full rounded-t-xl bg-primary transition-all"
                  style={{ height: `${(x.v / maxDay) * 100}px`, minHeight: 4 }}
                />
                <span className="text-[10px] font-bold text-muted-foreground">D{i + 1}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">Actual expenses</h2>
        {!trip.expenses.length && (
          <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground">
            No expenses logged yet.
          </p>
        )}
        <ul className="space-y-2">
          {[...trip.expenses]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft"
              >
                <span
                  className={cn("h-9 w-9 shrink-0 rounded-full", COLORS[e.category])}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{e.note || e.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.category} · {formatShort(e.date)}
                  </p>
                </div>
                <p className="font-bold">{money(e.amount, trip.currency)}</p>
                <button
                  aria-label="Delete expense"
                  onClick={() =>
                    updateTrip(id, (t) => ({
                      ...t,
                      expenses: t.expenses.filter((x) => x.id !== e.id),
                    }))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
        </ul>
      </section>
      <div className="mt-4">
        <EstimateNote>
          Estimates use typical {trip.budgetStyle} costs for this destination, your accommodation
          choice, entry prices and travel between stops. Actual expenses are what you log.
        </EstimateNote>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add expense">
        <div className="space-y-4">
          <Field label="Amount" error={err}>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min={0}
              className={inputCls}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className={inputCls}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={inputCls}
              min={trip.startDate || undefined}
              max={trip.endDate ? addDays(trip.endDate, 0) : undefined}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Note (optional)">
            <input
              className={inputCls}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Gelato stop"
            />
          </Field>
          <button onClick={add} className={pillButton({ size: "lg", className: "w-full" })}>
            Add expense
          </button>
        </div>
      </Modal>
    </Page>
  );
}
