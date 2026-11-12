import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  Heart,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Search,
  Sparkles,
  Users,
  CalendarSearch,
  UserRound,
  Wand2,
} from "lucide-react";
import {
  Chip,
  ChipGroup,
  Field,
  Page,
  PageHeader,
  Steps,
  Toggle,
  inputCls,
  money,
  pillButton,
} from "@/components/app/ui";
import { ChoiceCards, StepSlider, Stepper } from "@/components/app/pickers";
import {
  BUDGET_STOPS,
  DIET_CHOICES,
  INTEREST_CHOICES,
  PACE_STOPS,
  STAY_CHOICES,
  START_STOPS,
  TRANSPORT_CHOICES,
  TRAVELER_CHOICES,
  WALKING_STOPS,
  toggleDiet,
} from "@/lib/prefs-options";
import { allCities, getCity } from "@/data/registry";
import { useCitySearch, useOpenCity } from "@/lib/hooks";
import { estimateBudget, total } from "@/lib/budget";
import { addDays, formatRange, tripLength } from "@/lib/dates";
import { newDraftTrip, useApp } from "@/lib/store";
import {
  INTERESTS,
  type Accommodation,
  type Interest,
  type Mode,
  type Pace,
  type Trip,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";
import { palette, type PaletteColor } from "@/lib/theme";

type Search = {
  tripId?: string;
  city?: string;
  place?: string;
  places?: string;
  name?: string;
  theme?: string;
  step?: number;
};

export const Route = createFileRoute("/create-trip")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["tripId"] === "string") out.tripId = s["tripId"];
    if (typeof s["city"] === "string") out.city = s["city"];
    if (typeof s["place"] === "string") out.place = s["place"];
    if (typeof s["places"] === "string") out.places = s["places"];
    if (typeof s["name"] === "string") out.name = s["name"].slice(0, 80);
    if (typeof s["theme"] === "string") out.theme = s["theme"];
    if (typeof s["step"] === "number") out.step = s["step"];
    return out;
  },
  head: () =>
    seo(
      "Plan a New Trip",
      "Tell us where, when and how you like to travel, and we'll help plan the rest.",
    ),
  component: CreateTrip,
});

const LABELS = ["Destination", "Dates", "Budget", "Travelers", "Interests", "Preferences"];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CAD", "AUD"];

function CreateTrip() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const app = useApp();
  const created = useRef(false);
  const trip = search.tripId ? app.getTrip(search.tripId) : undefined;

  useEffect(() => {
    if (search.tripId || created.current) return;
    created.current = true;
    const id = app.uid("trip");
    const city = getCity(search.city);
    const t = newDraftTrip(id, city?.id ?? "");
    t.interests = app.state.prefs.activities.slice(0, 5);
    t.budgetStyle = app.state.prefs.budget;
    t.pace = app.state.prefs.pace;
    t.transport = app.state.prefs.transport[0] ?? "walk";
    t.dietary = app.state.prefs.dietary;
    if (city) {
      t.name = `${city.name} Getaway`;
      t.step = 2;
    }
    if (search.place) t.places = [{ placeId: search.place, source: "must", priority: true }];
    if (search.places)
      t.places = search.places
        .split(",")
        .filter(Boolean)
        .map((placeId) => ({ placeId, source: "must" as const, priority: true }));
    if (search.name) t.name = search.name;
    if (search.theme === "film" && !t.interests.includes("Filming locations"))
      t.interests = [...t.interests, "Filming locations"];
    app.createTrip(t);
    void navigate({ to: "/create-trip", search: { tripId: id }, replace: true });
  }, [search.tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trip && search.step && trip.step !== search.step)
      app.updateTrip(trip.id, (t) => ({ ...t, step: search.step! }));
  }, [search.step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip)
    return (
      <Page>
        <p className="text-muted-foreground">Setting up your trip…</p>
      </Page>
    );
  const step = Math.min(Math.max(trip.step, 1), 6);
  const set = (patch: Partial<Trip>) => app.updateTrip(trip.id, (t) => ({ ...t, ...patch }));
  const canNext =
    step === 1
      ? !!trip.cityId
      : step === 2
        ? !!trip.startDate && !!trip.endDate && trip.endDate >= trip.startDate
        : step === 3
          ? trip.budget > 0
          : true;
  const next = () => {
    if (step < 6) set({ step: step + 1 });
    else {
      set({ step: 7 });
      void navigate({ to: "/trip/$id/must-visit", params: { id: trip.id } });
    }
  };

  return (
    <Page>
      <PageHeader title="Plan a New Trip" subtitle="Saved automatically as a draft" backTo="/" />
      <Steps current={step} total={6} labels={LABELS} />
      <div key={step} className="page-enter mt-6 space-y-5">
        {step === 1 && <StepDestination trip={trip} set={set} />}
        {step === 2 && <StepDates trip={trip} set={set} />}
        {step === 3 && <StepBudget trip={trip} set={set} />}
        {step === 4 && <StepTravelers trip={trip} set={set} />}
        {step === 5 && (
          <>
            <h2 className="text-2xl font-semibold">What are you into?</h2>
            <p className="text-sm text-muted-foreground">We'll use these to recommend places.</p>
            <ChoiceCards
              options={INTEREST_CHOICES}
              value={trip.interests}
              onChange={(v) => set({ interests: v })}
            />
            <p className="text-xs font-bold text-muted-foreground">
              {trip.interests.length
                ? `${trip.interests.length} picked`
                : "Pick a few, or skip to see a bit of everything"}
            </p>
          </>
        )}
        {step === 6 && <StepPrefs trip={trip} set={set} />}
      </div>
      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t bg-card/95 p-4 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-3xl gap-3">
          {step > 1 && (
            <button
              onClick={() => set({ step: step - 1 })}
              className={pillButton({ variant: "outline", size: "lg" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <button
            disabled={!canNext}
            onClick={next}
            className={pillButton({ size: "lg", className: "flex-1" })}
          >
            {step === 6 ? "Add must-visit places" : "Continue"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-24" />
    </Page>
  );
}

type StepProps = { trip: Trip; set: (p: Partial<Trip>) => void };

function StepDestination({ trip, set }: StepProps) {
  const [q, setQ] = useState("");
  const { state } = useApp();
  const savedCities = new Set(
    state.bucket.filter((b) => b.kind === "destination").map((b) => b.refId),
  );
  const query = q.trim().toLowerCase();
  const list = allCities().filter(
    (c) => !query || `${c.name} ${c.country} ${c.region}`.toLowerCase().includes(query),
  );
  const world = useCitySearch(q);
  const { open, busy } = useOpenCity();
  const worldResults = (world.data ?? []).filter(
    (g) =>
      !list.some((c) => c.name.toLowerCase() === g.name.toLowerCase() && c.country === g.country),
  );
  const pick = async (g: Parameters<typeof open>[0]) => {
    const id = await open(g);
    const city = getCity(id);
    set({ cityId: id, name: `${city?.name ?? g.name} Getaway` });
  };
  return (
    <>
      <h2 className="text-2xl font-semibold">Where are you dreaming of?</h2>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a city, region or country"
          aria-label="Search destinations"
          className={`${inputCls} pl-12`}
        />
      </div>
      {query.length >= 2 && (
        <div className="rounded-3xl bg-card p-3 shadow-soft">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-extrabold uppercase tracking-wider text-sea-strong">
            <Globe2 className="h-3.5 w-3.5" />
            Anywhere in the world
          </p>
          {world.isFetching && (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching the map…
            </p>
          )}
          {!world.isFetching && !worldResults.length && (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              No other places found for “{q}”.
            </p>
          )}
          <ul className="space-y-1">
            {worldResults.map((g) => (
              <li key={g.geoId}>
                <button
                  onClick={() => void pick(g)}
                  disabled={busy !== null}
                  className="tap flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-secondary disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                    {busy === g.geoId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{g.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[g.region, g.country].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  {busy === g.geoId && (
                    <span className="text-xs font-bold text-muted-foreground">
                      Gathering sights…
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {list.length > 0 && (
        <p className="text-xs font-bold text-muted-foreground">
          {query ? `${list.length} recently explored matches` : "Recently explored"}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() =>
              set({
                cityId: c.id,
                name: trip.name && trip.cityId === c.id ? trip.name : `${c.name} Getaway`,
              })
            }
            className={cn(
              "tap relative h-36 overflow-hidden rounded-3xl text-left shadow-soft",
              trip.cityId === c.id && "ring-4 ring-primary",
            )}
            aria-pressed={trip.cityId === c.id}
          >
            <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="photo-fade absolute inset-0" />
            {savedCities.has(c.id) && (
              <Heart className="absolute right-3 top-3 h-5 w-5 fill-sea text-sea" />
            )}
            <span className="absolute bottom-3 left-3 text-on-photo">
              <span className="block font-display text-lg font-semibold leading-tight">
                {c.name}
              </span>
              <span className="text-xs font-semibold">
                {c.region}, {c.country}
              </span>
            </span>
          </button>
        ))}
      </div>
      {trip.cityId && (
        <Field label="Trip name">
          <input
            className={inputCls}
            value={trip.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
      )}
    </>
  );
}

function nextSaturday(iso: string) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, (6 - dow + 7) % 7 || 7);
}

function StepDates({ trip, set }: StepProps) {
  const { today } = useApp();
  const days =
    trip.startDate && trip.endDate && trip.endDate >= trip.startDate
      ? tripLength(trip.startDate, trip.endDate)
      : 0;
  const quick = [
    { label: "This weekend", start: nextSaturday(today), len: 2 },
    { label: "Next week", start: addDays(today, 7), len: 5 },
    { label: "In a month", start: addDays(today, 30), len: 5 },
    { label: "In 3 months", start: addDays(today, 90), len: 7 },
  ];
  const setLength = (n: number) =>
    trip.startDate && set({ endDate: addDays(trip.startDate, n - 1) });
  return (
    <>
      <h2 className="text-2xl font-semibold">When are you going?</h2>
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => {
          const on = trip.startDate === q.start && days === q.len;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => set({ startDate: q.start, endDate: addDays(q.start, q.len - 1) })}
              aria-pressed={on}
              className={cn(
                "tap rounded-2xl border-2 px-4 py-2.5 text-left",
                on ? "border-primary bg-primary-soft" : "border-transparent bg-card shadow-soft",
              )}
            >
              <span className="block text-sm font-extrabold">{q.label}</span>
              <span className="text-xs text-muted-foreground">
                {formatRange(q.start, addDays(q.start, q.len - 1))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date">
          <input
            type="date"
            min={today}
            className={inputCls}
            value={trip.startDate}
            onChange={(e) =>
              set({
                startDate: e.target.value,
                endDate: addDays(e.target.value, Math.max(1, days || 4) - 1),
              })
            }
          />
        </Field>
        <Field
          label="End date"
          error={
            trip.endDate && trip.startDate && trip.endDate < trip.startDate
              ? "End date must be after the start date"
              : undefined
          }
        >
          <input
            type="date"
            min={trip.startDate || today}
            className={inputCls}
            value={trip.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </Field>
      </div>
      {days > 0 && (
        <Stepper label="Trip length" value={days} min={1} max={30} onChange={setLength}>
          <p className="text-xs text-muted-foreground">
            {days} day{days > 1 ? "s" : ""} · {formatRange(trip.startDate, trip.endDate)}
          </p>
        </Stepper>
      )}
      <div className="flex items-center justify-between rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <CalendarSearch className="h-5 w-5 text-sea" />
          <div>
            <p className="font-bold">My dates are flexible</p>
            <p className="text-xs text-muted-foreground">We'll suggest the best time to go</p>
          </div>
        </div>
        <Toggle
          checked={trip.flexible}
          onChange={(v) => set({ flexible: v })}
          label="Flexible dates"
        />
      </div>
      {trip.flexible && (
        <Link
          to="/trip/$id/best-time"
          params={{ id: trip.id }}
          className={pillButton({ variant: "sea", size: "lg", className: "w-full" })}
        >
          <Sparkles className="h-4 w-4" />
          Help Me Choose Dates
        </Link>
      )}
    </>
  );
}

function StepBudget({ trip, set }: StepProps) {
  const city = getCity(trip.cityId);
  const days = trip.startDate ? tripLength(trip.startDate, trip.endDate) : 4;
  // Stay + food + local transport for these dates, plus a typical allowance for sights.
  const suggested = city
    ? Math.round(
        (total(estimateBudget({ ...trip, endDate: trip.endDate || trip.startDate })) +
          25 * days * trip.travelers) /
          50,
      ) * 50
    : 0;
  const max = Math.max(5000, Math.ceil((suggested * 2.5) / 1000) * 1000);
  const perDay = trip.budget / Math.max(1, days) / Math.max(1, trip.travelers);
  return (
    <>
      <h2 className="text-2xl font-semibold">What's your budget?</h2>
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Total trip budget
            </p>
            <p
              key={trip.budget}
              className="font-display text-4xl font-semibold animate-in fade-in duration-150"
            >
              {money(trip.budget, trip.currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              about {money(perDay, trip.currency)} per person per day
            </p>
          </div>
          <select
            aria-label="Currency"
            className="h-10 rounded-full border bg-card px-3 text-sm font-bold"
            value={trip.currency}
            onChange={(e) => set({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <input
          type="range"
          min={100}
          max={max}
          step={50}
          value={Math.min(trip.budget, max)}
          aria-label="Total trip budget"
          onChange={(e) => set({ budget: Number(e.target.value) })}
          className="mt-4 w-full accent-primary"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Exact budget"
            className="h-10 w-32 rounded-full border bg-card px-4 text-sm font-bold"
            value={trip.budget || ""}
            onChange={(e) => set({ budget: Number(e.target.value) })}
          />
          {city && suggested > 0 && (
            <button
              type="button"
              onClick={() => set({ budget: suggested })}
              className={pillButton({ variant: "soft", size: "sm" })}
            >
              <Wand2 className="h-4 w-4" />
              Use typical: {money(suggested, trip.currency)}
            </button>
          )}
        </div>
      </div>
      <StepSlider
        label="Budget style"
        stops={BUDGET_STOPS}
        value={trip.budgetStyle}
        onChange={(v) => set({ budgetStyle: v })}
      />
      <div>
        <p className="mb-2 text-sm font-bold">Where will you stay?</p>
        <ChoiceCards
          options={STAY_CHOICES}
          multi={false}
          columns={4}
          value={[trip.accommodation ?? "hotel"]}
          onChange={(v) => set({ accommodation: v[0] ?? "hotel" })}
        />
      </div>
      <details className="rounded-3xl bg-card p-4 shadow-soft">
        <summary className="cursor-pointer font-bold">Split by category (optional)</summary>
        <div className="mt-4 space-y-4">
          {(Object.keys(trip.budgetSplit) as (keyof Trip["budgetSplit"])[]).map((k) => (
            <label key={k} className="block">
              <span className="flex justify-between text-sm font-bold">
                <span>{k}</span>
                <span>
                  {trip.budgetSplit[k]}% ·{" "}
                  {money((trip.budget * trip.budgetSplit[k]) / 100, trip.currency)}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={80}
                value={trip.budgetSplit[k]}
                onChange={(e) =>
                  set({ budgetSplit: { ...trip.budgetSplit, [k]: Number(e.target.value) } })
                }
                className="w-full accent-primary"
              />
            </label>
          ))}
        </div>
      </details>
    </>
  );
}

function StepTravelers({ trip, set }: StepProps) {
  const shown = Math.min(trip.travelers, 8);
  return (
    <>
      <h2 className="text-2xl font-semibold">Who's coming along?</h2>
      <Stepper
        label="Travelers"
        value={trip.travelers}
        min={1}
        max={20}
        onChange={(n) =>
          set({
            travelers: n,
            // Keep the traveler type sensible as the headcount changes (families stay families).
            travelerType:
              n === 1
                ? "solo"
                : n === 2 && trip.travelerType === "solo"
                  ? "couple"
                  : n >= 3 && (trip.travelerType === "solo" || trip.travelerType === "couple")
                    ? "friends"
                    : trip.travelerType,
          })
        }
      >
        <div className="mt-1 flex -space-x-2" aria-hidden>
          {Array.from({ length: shown }, (_, i) => (
            <span
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-primary-foreground animate-in zoom-in-50 duration-200"
              style={{ background: palette[`chart-${(i % 5) + 1}` as PaletteColor] }}
            >
              <UserRound className="h-3.5 w-3.5" />
            </span>
          ))}
          {trip.travelers > shown && (
            <span className="flex h-7 items-center rounded-full bg-secondary px-2 text-xs font-bold">
              +{trip.travelers - shown}
            </span>
          )}
        </div>
      </Stepper>
      <ChoiceCards
        options={TRAVELER_CHOICES}
        multi={false}
        columns={4}
        value={[trip.travelerType]}
        onChange={(v) => set({ travelerType: v[0] ?? "solo" })}
      />
      <div className="flex items-center justify-between rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-sea" />
          <div>
            <p className="font-bold">Make it a group trip</p>
            <p className="text-xs text-muted-foreground">
              Invite friends to suggest & vote on places
            </p>
          </div>
        </div>
        <Toggle
          checked={!!trip.group}
          label="Group trip"
          onChange={(v) =>
            set({
              group: v
                ? {
                    inviteCode: "",
                    finalized: false,
                    members: [{ id: "me", name: "You", role: "organizer", color: "chart-1" }],
                    suggestions: [],
                  }
                : null,
            })
          }
        />
      </div>
    </>
  );
}

function StepPrefs({ trip, set }: StepProps) {
  return (
    <>
      <h2 className="text-2xl font-semibold">How do you like your days?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Group title="Itinerary pace">
          <StepSlider
            label="Itinerary pace"
            stops={PACE_STOPS}
            value={trip.pace}
            onChange={(v) => set({ pace: v })}
          />
        </Group>
        <Group title="Walking">
          <StepSlider
            label="Walking tolerance"
            stops={WALKING_STOPS}
            value={trip.walking}
            onChange={(v) => set({ walking: v })}
          />
        </Group>
      </div>
      <Group title="Getting around">
        <ChoiceCards
          options={TRANSPORT_CHOICES}
          multi={false}
          value={[trip.transport]}
          onChange={(v) => set({ transport: v[0] ?? "walk" })}
        />
      </Group>
      <Group title="Food needs">
        <ChoiceCards
          options={DIET_CHOICES}
          size="sm"
          columns={4}
          value={trip.dietary}
          onChange={(v) => set({ dietary: toggleDiet(v, trip.dietary) })}
        />
      </Group>
      <Group title="Start my days at">
        <StepSlider
          label="Day start time"
          stops={START_STOPS}
          value={String(trip.startHour)}
          onChange={(v) => set({ startHour: Number(v) })}
        />
      </Group>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-bold">{title}</h3>
      {children}
    </section>
  );
}
