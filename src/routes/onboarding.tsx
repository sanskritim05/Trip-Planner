import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/app/Logo";
import { ChoiceCards, StepSlider } from "@/components/app/pickers";
import { Bubbles, Burst } from "@/components/app/whimsy";
import { pillButton } from "@/components/app/ui";
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
import { useApp } from "@/lib/store";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" && s["next"].startsWith("/") ? { next: s["next"] } : {},
  head: () =>
    seo("Your travel style", "Tell us how you like to travel so we can tailor recommendations."),
  component: Onboarding,
});

type Step = {
  title: string;
  hint: string;
  render: (p: Prefs, set: (patch: Partial<Prefs>) => void) => React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "What makes a trip for you?",
    hint: "Pick as many as you like. We'll use these to find places you'll love.",
    render: (p, set) => (
      <ChoiceCards
        options={INTEREST_CHOICES}
        value={p.activities}
        onChange={(v) => set({ activities: v })}
      />
    ),
  },
  {
    title: "Which sounds most like you?",
    hint: "Choose up to two.",
    render: (p, set) => (
      <ChoiceCards
        options={STYLE_CHOICES}
        value={p.style}
        onChange={(v) => set({ style: v })}
        max={2}
      />
    ),
  },
  {
    title: "What's your budget vibe?",
    hint: "Slide to set it. You can change it for every trip.",
    render: (p, set) => (
      <StepSlider
        label="Budget"
        stops={BUDGET_STOPS}
        value={p.budget}
        onChange={(v) => set({ budget: v })}
      />
    ),
  },
  {
    title: "How full should your days be?",
    hint: "We'll pace your itineraries to match.",
    render: (p, set) => (
      <StepSlider
        label="Pace"
        stops={PACE_STOPS}
        value={p.pace}
        onChange={(v) => set({ pace: v })}
      />
    ),
  },
  {
    title: "How do you like to get around?",
    hint: "We'll plan routes and travel times around this.",
    render: (p, set) => (
      <ChoiceCards
        options={TRANSPORT_CHOICES}
        value={p.transport}
        onChange={(v) => set({ transport: v })}
      />
    ),
  },
  {
    title: "Any food needs?",
    hint: "Restaurant picks will respect these.",
    render: (p, set) => (
      <ChoiceCards
        options={DIET_CHOICES}
        size="sm"
        columns={4}
        value={p.dietary}
        onChange={(v) => set({ dietary: toggleDiet(v, p.dietary) })}
      />
    ),
  },
  {
    title: "Where do you feel happiest?",
    hint: "Helps us suggest your next destinations.",
    render: (p, set) => (
      <ChoiceCards
        options={DESTINATION_CHOICES}
        size="sm"
        value={p.destinations}
        onChange={(v) => set({ destinations: v })}
      />
    ),
  },
];

function Onboarding() {
  const { state, setState } = useApp();
  const [prefs, setPrefs] = useState(state.prefs);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const done = step >= STEPS.length;
  const persona = travelPersona(prefs);
  const PersonaIcon = persona.icon;

  const go = (d: 1 | -1) => {
    setDir(d);
    setStep((s) => Math.max(0, Math.min(STEPS.length, s + d)));
  };
  const finish = (save: boolean) => {
    setState((s) => ({ ...s, onboarded: true, prefs: save ? prefs : s.prefs }));
    if (save) toast.success(`Saved! You're ${persona.title.replace(/^The /, "a ")}.`);
    void navigate({ to: next ?? "/", replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" &&
        (e.target as HTMLInputElement).type !== "range"
      )
        return;
      if (e.key === "Enter" && !done) go(1);
      if (e.key === "Escape" && step > 0) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 pb-10 pt-6">
      <Bubbles className="opacity-60" />
      <div className="relative flex items-center justify-between">
        <Logo withName size="sm" />
        {!done && (
          <button
            onClick={() => finish(false)}
            className="text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        )}
      </div>

      <div
        className="relative mt-6 flex gap-1.5"
        aria-label={`Question ${Math.min(step + 1, STEPS.length)} of ${STEPS.length}`}
      >
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setDir(i > step ? 1 : -1);
              setStep(i);
            }}
            aria-label={`Go to question ${i + 1}`}
            className={cn(
              "h-2 flex-1 rounded-full transition-all duration-500",
              i < step || done ? "bg-primary" : i === step ? "bg-primary/50" : "bg-secondary",
            )}
          />
        ))}
      </div>

      {!done ? (
        <section
          key={step}
          className={cn(
            "relative mt-8 flex-1 animate-in fade-in duration-300",
            dir === 1 ? "slide-in-from-right-8" : "slide-in-from-left-8",
          )}
        >
          <p className="font-script text-xl text-sea-strong">
            {step === 0 ? `Hi ${state.user?.name ?? "traveler"}! ` : ""}Question {step + 1} of{" "}
            {STEPS.length}
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            {STEPS[step]!.title}
          </h1>
          <p className="mb-6 mt-1 text-muted-foreground">{STEPS[step]!.hint}</p>
          {STEPS[step]!.render(prefs, (patch) => setPrefs((p) => ({ ...p, ...patch })))}
        </section>
      ) : (
        <section className="relative mt-8 flex flex-1 flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
          <Burst trigger={1} count={22} />
          <p className="font-script text-2xl text-sea-strong">your travel personality is…</p>
          <span className="bob mt-4 flex h-24 w-24 items-center justify-center rounded-[38%_62%_55%_45%/50%_45%_55%_50%] bg-primary text-primary-foreground shadow-lift">
            <PersonaIcon className="h-11 w-11" />
          </span>
          <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">
            <em className="squiggle text-primary-strong">{persona.title}</em>
          </h1>
          <p className="mt-3 max-w-md text-lg text-muted-foreground">{persona.blurb}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {persona.traits.map((t, i) => (
              <span
                key={t}
                className="rounded-full bg-card px-3 py-1.5 text-sm font-bold shadow-soft animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${200 + i * 90}ms`, animationFillMode: "both" }}
              >
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={() => finish(true)}
            className={pillButton({ size: "lg", className: "mt-8 w-full max-w-sm" })}
          >
            <Sparkles className="h-5 w-5" />
            Start exploring
          </button>
          <button
            onClick={() => go(-1)}
            className="mt-3 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            Change my answers
          </button>
        </section>
      )}

      {!done && (
        <div className="sticky bottom-0 mt-8 flex gap-3 bg-gradient-to-t from-background via-background to-transparent pb-2 pt-6">
          {step > 0 && (
            <button
              onClick={() => go(-1)}
              className={pillButton({ variant: "outline", size: "lg" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <button onClick={() => go(1)} className={pillButton({ size: "lg", className: "flex-1" })}>
            {step === STEPS.length - 1 ? "Reveal my travel personality" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </main>
  );
}
