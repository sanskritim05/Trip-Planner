import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, Loader2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/app/Logo";
import { Bubbles } from "@/components/app/whimsy";
import { Page, pillButton } from "@/components/app/ui";
import { getCity, registerCities } from "@/data/registry";
import { formatRange } from "@/lib/dates";
import { useGroupActions } from "@/lib/group-sync";
import { useApp } from "@/lib/store";
import { groupGetFn } from "@/server/fns";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/join/$code")({
  head: () => seo("Join a group trip", "You've been invited to plan a trip together."),
  component: Join,
});

function Join() {
  const { code } = Route.useParams();
  const { state, getTrip } = useApp();
  const { join } = useGroupActions();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const doc = useQuery({
    queryKey: ["group-preview", code],
    queryFn: async () => {
      const d = await groupGetFn({ data: { code } });
      if (d?.trip.cityData) registerCities([d.trip.cityData]);
      return d;
    },
  });
  const trip = doc.data?.trip;
  const city = getCity(trip?.cityId) ?? trip?.cityData ?? undefined;
  const already = !!trip?.group?.members.some((m) => m.id === state.user?.id);

  const accept = async () => {
    setJoining(true);
    try {
      const res = await join(code);
      if (!res) throw new Error("missing");
      toast.success(`You're in! Welcome to ${res.trip.name}`);
      void navigate({ to: "/trip/$id/group", params: { id: res.trip.id } });
    } catch {
      toast.error("Couldn't join this trip. Ask for a fresh invite link.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Page>
      <div className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] bg-card shadow-lift">
        {doc.isLoading ? (
          <div className="flex flex-col items-center gap-3 p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            Opening your invite…
          </div>
        ) : !trip ? (
          <div className="p-8 text-center">
            <Logo size="lg" />
            <p className="mt-4 font-display text-2xl font-semibold">
              This invite has drifted out to sea
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The code “{code}” doesn't match a trip. Ask your friend to send the link again.
            </p>
            <Link to="/" className={pillButton({ className: "mt-6" })}>
              Go home
            </Link>
          </div>
        ) : (
          <>
            <div className="relative h-48">
              <img src={city?.image} alt={city?.name} className="h-full w-full object-cover" />
              <div className="photo-fade absolute inset-0" />
              <Bubbles />
              <p className="absolute left-5 top-4 rounded-full bg-on-photo/90 px-3 py-1 text-xs font-extrabold text-primary-strong">
                You're invited
              </p>
              <div className="absolute bottom-4 left-5 right-5 text-on-photo">
                <h1 className="text-3xl font-semibold leading-tight">{trip.name}</h1>
                <p className="flex items-center gap-1 text-sm font-semibold">
                  <MapPin className="h-4 w-4" />
                  {city ? `${city.name}, ${city.country}` : "Somewhere lovely"}
                </p>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {trip.startDate && (
                <p className="flex items-center gap-2 text-sm font-bold">
                  <CalendarHeart className="h-4 w-4 text-primary" />
                  {formatRange(trip.startDate, trip.endDate)}
                </p>
              )}
              <p className="flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4 text-sea" />
                {trip.group?.members.map((m) => m.name).join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                Join to suggest places, vote, follow the shared itinerary and add photos to the
                group time capsule.
              </p>
              {already ? (
                <Link
                  to="/trip/$id/group"
                  params={{ id: trip.id }}
                  className={pillButton({ size: "lg", className: "w-full" })}
                >
                  Open the trip
                </Link>
              ) : (
                <button
                  onClick={() => void accept()}
                  disabled={joining}
                  className={pillButton({ size: "lg", className: "w-full" })}
                >
                  {joining && <Loader2 className="h-5 w-5 animate-spin" />} Join the trip
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
