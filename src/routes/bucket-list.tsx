import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Heart, NotebookPen, Plane, Search, Trash2 } from "lucide-react";
import { Chip, EmptyState, Page, PageHeader, inputCls, pillButton } from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { useApp } from "@/lib/store";
import type { BucketItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/bucket-list")({
  head: () => seo("Bucket List", "All the places you dream of visiting, grouped by destination."),
  component: Bucket,
});

const KINDS: { k: BucketItem["kind"] | "all"; label: string }[] = [
  { k: "all", label: "All" },
  { k: "destination", label: "Destinations" },
  { k: "attraction", label: "Attractions" },
  { k: "restaurant", label: "Restaurants" },
];

function Bucket() {
  const { state, updateBucket, removeBucket } = useApp();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<BucketItem["kind"] | "all">("all");
  const [hideVisited, setHideVisited] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const rows = state.bucket
    .map((b) => {
      const place = getPlace(b.refId);
      const city = place ? getCity(place.cityId) : getCity(b.refId);
      return { b, place, city, name: place?.name ?? city?.name ?? "Saved place" };
    })
    .filter(
      (r) =>
        (kind === "all" || r.b.kind === kind) &&
        (!hideVisited || !r.b.visited) &&
        (!q ||
          `${r.name} ${r.city?.name} ${r.city?.country}`.toLowerCase().includes(q.toLowerCase())),
    );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.city ? `${r.city.name}, ${r.city.country}` : "Other";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <Page>
      <PageHeader
        title="Your Bucket List"
        subtitle={`${state.bucket.length} saved · ${state.bucket.filter((b) => b.visited).length} visited`}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search saved places"
          aria-label="Search saved places"
          className={`${inputCls} pl-12`}
        />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {KINDS.map((k) => (
          <Chip key={k.k} selected={kind === k.k} onClick={() => setKind(k.k)}>
            {k.label}
          </Chip>
        ))}
        <Chip selected={hideVisited} onClick={() => setHideVisited(!hideVisited)}>
          Hide visited
        </Chip>
      </div>

      {!state.bucket.length && (
        <div className="mt-6">
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Nothing saved yet"
            body="Tap the heart on any destination or place to save it here."
          >
            <Link to="/explore" className={pillButton()}>
              Start exploring
            </Link>
          </EmptyState>
        </div>
      )}

      {[...groups.entries()].map(([g, list]) => {
        const cityId = list[0]?.city?.id;
        return (
          <section key={g} className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{g}</h2>
              {cityId && (
                <Link
                  to="/create-trip"
                  search={{ city: cityId }}
                  className={pillButton({ variant: "soft", size: "xs" })}
                >
                  <Plane className="h-3.5 w-3.5" />
                  Plan a Trip
                </Link>
              )}
            </div>
            <ul className="space-y-3">
              {list.map(({ b, place, city, name }) => (
                <li
                  key={b.id}
                  className={cn(
                    "rounded-3xl bg-card p-3 shadow-soft transition",
                    b.visited && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={place?.image ?? city?.image}
                      alt=""
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-bold", b.visited && "line-through")}>
                        {name}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">{b.kind}</p>
                      {b.note && editing !== b.id && (
                        <p className="mt-1 font-script text-lg leading-tight text-sea">
                          “{b.note}”
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        aria-label={b.visited ? "Mark not visited" : "Mark visited"}
                        onClick={() => updateBucket(b.id, { visited: !b.visited })}
                        className={cn(
                          "tap flex h-9 w-9 items-center justify-center rounded-full",
                          b.visited ? "bg-primary text-primary-foreground" : "bg-secondary",
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Edit note"
                        onClick={() => setEditing(editing === b.id ? null : b.id)}
                        className="tap flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
                      >
                        <NotebookPen className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Remove"
                        onClick={() => removeBucket(b.id)}
                        className="tap flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {editing === b.id && (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setEditing(null);
                      }}
                    >
                      <input
                        autoFocus
                        defaultValue={b.note}
                        onChange={(e) => updateBucket(b.id, { note: e.target.value })}
                        placeholder="Add a note…"
                        className={`${inputCls} h-10`}
                        aria-label="Note"
                      />
                      <button className={pillButton({ size: "sm" })}>Done</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Page>
  );
}
