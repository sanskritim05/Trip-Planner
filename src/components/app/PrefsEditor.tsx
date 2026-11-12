import type { ReactNode } from "react";
import {
  BUDGET_STOPS,
  DESTINATION_CHOICES,
  DIET_CHOICES,
  INTEREST_CHOICES,
  PACE_STOPS,
  STYLE_CHOICES,
  TRANSPORT_CHOICES,
  toggleDiet,
  travelPersona,
} from "@/lib/prefs-options";
import type { Prefs } from "@/lib/types";
import { ChoiceCards, StepSlider } from "./pickers";

/** Live travel-personality card that updates as preferences change. */
export function PersonaCard({ prefs }: { prefs: Prefs }) {
  const persona = travelPersona(prefs);
  const Icon = persona.icon;
  return (
    <div
      key={persona.title}
      className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-primary-soft via-card to-sea-soft p-5 shadow-soft animate-in fade-in duration-300"
    >
      <span className="flex h-16 w-16 shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
        <Icon className="h-8 w-8" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-wider text-sea-strong">
          Your travel personality
        </p>
        <p className="font-display text-2xl font-semibold leading-tight">{persona.title}</p>
        <p className="text-sm text-muted-foreground">{persona.blurb}</p>
      </div>
    </div>
  );
}

export function PrefsEditor({ value, onChange }: { value: Prefs; onChange: (p: Prefs) => void }) {
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-8">
      <PersonaCard prefs={value} />
      <Section title="What makes a trip for you" sub="Pick as many as you like">
        <ChoiceCards
          options={INTEREST_CHOICES}
          size="sm"
          columns={4}
          value={value.activities}
          onChange={(v) => set("activities", v)}
        />
      </Section>
      <Section title="Your travel style" sub="Up to two">
        <ChoiceCards
          options={STYLE_CHOICES}
          size="sm"
          value={value.style}
          max={2}
          onChange={(v) => set("style", v)}
        />
      </Section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Budget">
          <StepSlider
            label="Budget"
            stops={BUDGET_STOPS}
            value={value.budget}
            onChange={(v) => set("budget", v)}
          />
        </Section>
        <Section title="Itinerary pace">
          <StepSlider
            label="Pace"
            stops={PACE_STOPS}
            value={value.pace}
            onChange={(v) => set("pace", v)}
          />
        </Section>
      </div>
      <Section title="Getting around">
        <ChoiceCards
          options={TRANSPORT_CHOICES}
          size="sm"
          value={value.transport}
          onChange={(v) => set("transport", v)}
        />
      </Section>
      <Section title="Food & dietary needs">
        <ChoiceCards
          options={DIET_CHOICES}
          size="sm"
          columns={4}
          value={value.dietary}
          onChange={(v) => set("dietary", toggleDiet(v, value.dietary))}
        />
      </Section>
      <Section title="Favorite kinds of destinations">
        <ChoiceCards
          options={DESTINATION_CHOICES}
          size="sm"
          value={value.destinations}
          onChange={(v) => set("destinations", v)}
        />
      </Section>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="text-xs font-semibold text-muted-foreground">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
