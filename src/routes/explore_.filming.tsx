import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Loader2, Plane, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FilmCard } from "@/components/app/cards";
import { Chip, Modal, Page, PageHeader, inputCls, pillButton } from "@/components/app/ui";
import { allFilmingPlaces, getCity } from "@/data/registry";
import { useOpenCity } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { tripPhase } from "@/lib/trip-status";
import type { Place } from "@/lib/types";
import { searchCities } from "@/services/geo";
import { findFilmingLocations } from "@/services/live";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/explore_/filming")({
  head: () => seo("Filming locations", "Visit real places from your favorite movies and TV shows."),
  component: Filming,
});

type AiResult = NonNullable<Awaited<ReturnType<typeof findFilmingLocations>>>;
const pendingCity = (p: Place) =>
  p.cityId.startsWith("pending:") ? p.cityId.slice(8).split("|") : null;

function Filming() {
  const [q, setQ] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [adding, setAdding] = useState<Place | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const app = useApp();
  const { open } = useOpenCity();
  const navigate = useNavigate();
  const local = allFilmingPlaces();
  const titles = [...new Set(local.map((p) => p.film!.title))];
  const query = q.trim().toLowerCase();
  const list = local.filter(
    (p) =>
      (!title || p.film!.title === title) &&
      (!query ||
        `${p.film!.title} ${p.name} ${getCity(p.cityId)?.name}`.toLowerCase().includes(query)),
  );

  const searchAi = async () => {
    if (q.trim().length < 2) return;
    setSearching(true);
    const res = await findFilmingLocations(q.trim());
    setSearching(false);
    if (!res) {
      toast.error("Couldn't search filming locations right now.");
      return;
    }
    if (!res.places.length) toast(`We couldn't find documented filming spots for “${res.title}”.`);
    setAi(res);
  };

  /** AI results name a city; turn it into a real destination before saving the place. */
  const resolve = async (p: Place): Promise<Place | null> => {
    const pend = pendingCity(p);
    if (!pend) return p;
    const [name, country] = pend;
    const hits = await searchCities(name!);
    const hit = hits.find((h) => h.country.toLowerCase() === country!.toLowerCase()) ?? hits[0];
    if (!hit) return null;
    const cityId = await open(hit);
    const fixed = { ...p, cityId };
    app.savePlaces([fixed]);
    return fixed;
  };

  const startAdd = async (p: Place) => {
    setResolving(true);
    const fixed = await resolve(p).catch(() => null);
    setResolving(false);
    if (!fixed) return toastFail(p);
    setAdding(fixed);
  };
  const toastFail = (p: Place) => {
    toast.error(`Couldn't place ${p.name} on the map`);
  };

  const planThemed = async (city: AiResult["cities"][number]) => {
    if (!ai) return;
    setResolving(true);
    try {
      const inCity = ai.places.filter((p) => pendingCity(p)?.[0] === city.name);
      const fixed = (await Promise.all(inCity.map((p) => resolve(p).catch(() => null)))).filter(
        (x): x is Place => !!x,
      );
      if (!fixed.length) throw new Error("none");
      void navigate({
        to: "/create-trip",
        search: {
          city: fixed[0]!.cityId,
          places: fixed.map((p) => p.id).join(","),
          name: `${ai.title} in ${city.name}`,
          theme: "film",
        },
      });
    } catch {
      toast.error(`Couldn't set up a trip to ${city.name}`);
    } finally {
      setResolving(false);
    }
  };

  const eligible = adding
    ? app.state.trips.filter(
        (t) => t.cityId === adding.cityId && tripPhase(t, app.today) !== "past",
      )
    : [];
  const localByTitle = title ? list : [];
  const localCity = localByTitle[0] ? getCity(localByTitle[0].cityId) : undefined;

  return (
    <Page wide>
      <PageHeader
        title="On-screen spots"
        subtitle="Real-world places from movies & TV"
        backTo="/explore"
      />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (app.ai) void searchAi();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any movie or show…"
            aria-label="Search movies and shows"
            className={`${inputCls} pl-12`}
          />
        </div>
        {app.ai && (
          <button
            disabled={searching || q.trim().length < 2}
            className={pillButton({ size: "lg" })}
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Find
          </button>
        )}
      </form>
      {!app.ai && (
        <p className="mt-3 rounded-2xl bg-butter/70 p-3 text-sm font-semibold">
          Searching filming locations needs the AI connection (set GROQ_API_KEY on the server).
        </p>
      )}

      {ai && (
        <section className="mt-6 rounded-[2rem] bg-gradient-to-br from-lilac/70 to-sea-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Clapperboard className="h-6 w-6 text-primary" />
              {ai.title}{" "}
              <span className="text-sm font-bold text-muted-foreground">· {ai.kind}</span>
            </p>
            <button
              onClick={() => setAi(null)}
              className="text-sm font-bold text-primary-strong underline"
            >
              Clear
            </button>
          </div>
          {ai.cities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ai.cities.map((c) => (
                <button
                  key={c.name + c.country}
                  disabled={resolving}
                  onClick={() => void planThemed(c)}
                  className={pillButton({ size: "sm" })}
                >
                  {resolving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plane className="h-4 w-4" />
                  )}
                  Plan a {ai.title} trip in {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ai.places.map((p) => (
              <FilmCard
                key={p.id}
                place={p}
                cityLabel={pendingCity(p)?.join(", ")}
                onAdd={() => void startAdd(p)}
              />
            ))}
          </div>
        </section>
      )}

      {titles.length > 0 && <h2 className="mt-8 text-xl font-semibold">Your saved spots</h2>}
      {titles.length > 1 && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          <Chip selected={!title} onClick={() => setTitle(null)}>
            All titles
          </Chip>
          {titles.map((t) => (
            <Chip key={t} selected={title === t} onClick={() => setTitle(title === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}
      {title && localCity && (
        <button
          onClick={() =>
            void navigate({
              to: "/create-trip",
              search: {
                city: localCity.id,
                places: localByTitle
                  .filter((p) => p.cityId === localCity.id)
                  .map((p) => p.id)
                  .join(","),
                name: `${title} in ${localCity.name}`,
                theme: "film",
              },
            })
          }
          className={pillButton({ variant: "sea", size: "sm", className: "mt-3" })}
        >
          <Plane className="h-4 w-4" />
          Plan a {title} trip in {localCity.name}
        </button>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <FilmCard key={p.id} place={p} onAdd={() => setAdding(p)} />
        ))}
      </div>
      {!list.length && !ai && (
        <p className="mt-6 rounded-3xl bg-card p-6 text-center text-muted-foreground">
          {local.length
            ? `None of your saved spots match “${q}”.${app.ai ? " Tap Find to search everywhere." : ""}`
            : "Search a movie or show to see where it was filmed. Spots you add to a trip show up here."}
        </p>
      )}

      <Modal open={!!adding} onClose={() => setAdding(null)} title={`Add ${adding?.name ?? ""}`}>
        {eligible.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (adding) app.savePlaces([adding]);
              app.updateTrip(t.id, (tr) =>
                tr.places.some((x) => x.placeId === adding!.id)
                  ? tr
                  : {
                      ...tr,
                      places: [
                        ...tr.places,
                        { placeId: adding!.id, source: "must", priority: false },
                      ],
                    },
              );
              toast.success(`Added to ${t.name}`);
              setAdding(null);
            }}
            className="tap mb-2 flex w-full items-center justify-between rounded-2xl bg-secondary p-4 text-left font-bold"
          >
            {t.name}{" "}
            <span className="text-xs text-muted-foreground">
              {t.status === "draft" ? "Draft" : "Planned"}
            </span>
          </button>
        ))}
        {!eligible.length && (
          <p className="mb-3 text-sm text-muted-foreground">
            You don't have a trip to {getCity(adding?.cityId)?.name} yet.
          </p>
        )}
        <div className="grid gap-2">
          <button
            onClick={() => adding && app.toggleSave(adding.id, "attraction")}
            className={pillButton({ variant: "outline", className: "w-full" })}
          >
            {adding && app.isSaved(adding.id) ? "Saved to bucket list" : "Save to bucket list"}
          </button>
          <button
            onClick={() =>
              adding &&
              navigate({
                to: "/create-trip",
                search: { city: adding.cityId, place: adding.id, theme: "film" },
              })
            }
            className={pillButton({ className: "w-full" })}
          >
            Start a themed trip to {getCity(adding?.cityId)?.name}
          </button>
        </div>
      </Modal>
    </Page>
  );
}
