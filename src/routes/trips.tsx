import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane } from "lucide-react";
import { TripCard } from "@/components/app/cards";
import { EmptyState, Page, PageHeader, pillButton } from "@/components/app/ui";
import { useApp } from "@/lib/store";
import { tripPhase } from "@/lib/trip-status";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trips")({
  head: () => seo("My Trips", "All your trips."),
  component: Trips,
});

function Trips() {
  const { state, today, deleteTrip, duplicateTrip } = useApp();
  const groups = (["active", "upcoming", "draft", "past"] as const).map((p) => ({
    p,
    list: state.trips.filter((t) => tripPhase(t, today) === p),
  }));
  const label = {
    active: "Active Trips",
    upcoming: "Upcoming Trips",
    draft: "Draft Trips",
    past: "Past Trips",
  };
  return (
    <Page wide>
      <PageHeader
        title="My Trips"
        back={false}
        action={
          <Link to="/create-trip" className={pillButton({ size: "sm" })}>
            New trip
          </Link>
        }
      />
      {!state.trips.length && (
        <EmptyState
          icon={<Plane className="h-6 w-6" />}
          title="No trips yet!"
          body="Pick a destination and we'll help you plan every day of it."
        >
          <Link to="/create-trip" className={pillButton()}>
            Plan my first trip
          </Link>
        </EmptyState>
      )}
      {groups.map(
        ({ p, list }) =>
          list.length > 0 && (
            <section key={p} className="mb-8">
              <h2 className="mb-3 text-xl font-semibold">{label[p]}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {list.map((t) => (
                  <TripCard
                    key={t.id}
                    trip={t}
                    actions={
                      <div className="flex gap-1">
                        <button
                          className={pillButton({ variant: "ghost", size: "xs" })}
                          onClick={() => duplicateTrip(t.id)}
                        >
                          Duplicate
                        </button>
                        <button
                          className={pillButton({ variant: "ghost", size: "xs" })}
                          onClick={() => window.confirm(`Delete ${t.name}?`) && deleteTrip(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          ),
      )}
    </Page>
  );
}
