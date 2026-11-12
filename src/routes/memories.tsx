import { createFileRoute } from "@tanstack/react-router";
import { TripLink } from "@/components/app/cards";
import { Page, PageHeader, pillButton } from "@/components/app/ui";
import { getCity } from "@/data/registry";
import { formatRange } from "@/lib/dates";
import { useApp } from "@/lib/store";
import { isCapsuleUnlocked, isScrapbookReleased, tripPhase } from "@/lib/trip-status";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/memories")({
  head: () => seo("Memories", "Time capsules and scrapbooks."),
  component: Memories,
});

function Memories() {
  const { state, today } = useApp();
  const trips = state.trips.filter(
    (t) => t.status === "planned" && tripPhase(t, today) !== "upcoming",
  );
  return (
    <Page wide>
      <PageHeader title="Memories" back={false} subtitle="Time capsules & scrapbooks" />
      {!trips.length && (
        <p className="rounded-3xl bg-card p-8 text-center text-muted-foreground">
          Memories from your trips will live here. Check in with photos as you explore!
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {trips.map((t) => {
          const c = getCity(t.cityId);
          const open = isCapsuleUnlocked(t, today);
          const book = isScrapbookReleased(t, today);
          return (
            <article key={t.id} className="overflow-hidden rounded-3xl bg-card shadow-soft">
              <img
                src={(open && t.photos[0]?.src) || c?.image}
                alt=""
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold">{t.name}</h3>
                <p className="text-xs font-bold text-muted-foreground">
                  {formatRange(t.startDate, t.endDate)} · {t.photos.length} memories ·{" "}
                  {book ? "Scrapbook ready" : open ? "Capsule unlocked" : "Capsule locked"}
                  {t.group ? " · Group" : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <TripLink trip={t} view="capsule" className={pillButton({ size: "sm" })}>
                    View Memories
                  </TripLink>
                  {book && (
                    <TripLink
                      trip={t}
                      view="scrapbook"
                      className={pillButton({ size: "sm", variant: "soft" })}
                    >
                      Scrapbook
                    </TripLink>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
