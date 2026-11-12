import { createFileRoute, Link } from "@tanstack/react-router";
import welcomeImage from "@/assets/welcome.jpg";
import { Camera, Map, Sparkles } from "lucide-react";
import { Logo } from "@/components/app/Logo";
import { Bubbles, Wave } from "@/components/app/whimsy";
import { pillButton } from "@/components/app/ui";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/welcome")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" && s["next"].startsWith("/") ? { next: s["next"] } : {},
  head: () =>
    seo(
      "Welcome",
      "Go places. Make memories. Plan trips, follow your itinerary and get a digital scrapbook.",
    ),
  component: Welcome,
});

function Welcome() {
  const { next } = Route.useSearch();
  return (
    <main className="relative flex min-h-screen flex-col lg:flex-row">
      <div className="relative h-[56vh] lg:h-auto lg:flex-1">
        <img
          src={welcomeImage}
          alt="Traveler overlooking a green valley at sunrise"
          className="h-full w-full object-cover"
        />
        <div className="photo-fade absolute inset-0 lg:hidden" />
        <Bubbles />
        <Link to="/welcome" className="absolute left-5 top-6" aria-label="Ans2Sans">
          <Logo withName light />
        </Link>
        <Wave className="absolute -bottom-px left-0 lg:hidden" />
      </div>
      <section className="page-enter relative flex flex-1 flex-col justify-center bg-background px-6 pb-10 pt-6 lg:max-w-xl lg:px-14">
        <span
          className="washi absolute -top-3 left-10 h-5 w-24 -rotate-6 rounded-sm lg:hidden"
          aria-hidden
        />
        <h1 className="mt-1 text-5xl font-semibold leading-[1.05] tracking-tight">
          Go places.
          <br />
          <em className="squiggle text-primary-strong">Make memories.</em>
        </h1>
        <ul className="mt-7 space-y-3 text-sm font-semibold text-muted-foreground">
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Sparkles className="h-4 w-4" />
            </span>
            Swipe your way to a trip built around you
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sea-soft text-sea-strong">
              <Map className="h-4 w-4" />
            </span>
            Day-by-day plans with maps, weather & budget
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-butter text-foreground">
              <Camera className="h-4 w-4" />
            </span>
            Photo check-ins that become a scrapbook
          </li>
        </ul>
        <div className="mt-8 grid gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup", ...(next ? { next } : {}) }}
            className={pillButton({ size: "lg" })}
          >
            Get Started! It's free
          </Link>
          <Link
            to="/auth"
            search={{ mode: "login", ...(next ? { next } : {}) }}
            className={pillButton({ size: "lg", variant: "outline" })}
          >
            Log In
          </Link>
        </div>
        {next?.startsWith("/join/") && (
          <p className="mt-4 rounded-2xl bg-sea-soft px-4 py-3 text-sm font-bold">
            You've been invited to a group trip! Sign in to join.
          </p>
        )}
      </section>
    </main>
  );
}
