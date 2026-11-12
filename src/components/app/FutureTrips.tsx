import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Heart, Loader2, Plane, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { allCities, getCity } from "@/data/registry";
import { useOpenCity, useRegistry } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { tripPhase } from "@/lib/trip-status";
import type { City, Interest } from "@/lib/types";
import { searchCities } from "@/services/geo";
import { aiDestinationIdeas } from "@/services/live";
import { SectionHeading, Tag, pillButton } from "./ui";

type Idea = {
  name: string;
  country: string;
  why: string;
  image: string;
  bestMonths?: string;
  city?: City;
};

/**
 * Future trip ideas based on interests, learned taste and past trips. With AI on,
 * fresh suggestions load automatically; otherwise it ranks real cities the
 * traveler has already looked up but not visited yet.
 */
export function FutureTrips({
  focus = null,
  title = "Where to next?",
  subtitle = "Future adventures picked just for you",
}: {
  focus?: Interest | null;
  title?: string;
  subtitle?: string;
}) {
  const app = useApp();
  useRegistry();
  const { open } = useOpenCity();
  const [saving, setSaving] = useState<string | null>(null);
  const past = app.state.trips.filter(
    (t) => tripPhase(t, app.today) === "past" || t.status === "planned",
  );
  const visitedIds = new Set(past.map((t) => t.cityId));
  const lovedTags = past.flatMap((t) => getCity(t.cityId)?.tags ?? []);
  const interests = new Set(app.state.prefs.activities);

  const input = {
    interests: app.state.prefs.activities,
    visited: past.map((t) => getCity(t.cityId)?.name ?? "").filter(Boolean),
    loved: app.state.trips
      .filter((t) => t.photos.length > 3)
      .map((t) => getCity(t.cityId)?.name ?? "")
      .filter(Boolean),
    bucket: app.state.bucket.map((b) => getCity(b.refId)?.name ?? "").filter(Boolean),
    budgetStyle: app.state.prefs.budget,
    ...(focus ? { focus } : {}),
  };
  const ai = useQuery({
    queryKey: ["dest-ideas", JSON.stringify(input)],
    enabled: app.ai,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const res = await aiDestinationIdeas(input);
      if (!res) throw new Error("no ideas");
      return res.map((d): Idea => ({
        name: d.name,
        country: d.country,
        why: d.why,
        image: d.image,
        bestMonths: d.bestMonths,
      }));
    },
  });

  const known: Idea[] = allCities()
    .filter((c) => !visitedIds.has(c.id) && (!focus || c.tags.includes(focus)))
    .map((c) => {
      const score =
        c.tags.filter((t) => interests.has(t)).length * 2 +
        c.tags.reduce(
          (s, t) =>
            s + (app.state.taste[t] ?? 0) * 0.6 + lovedTags.filter((x) => x === t).length * 0.8,
          0,
        );
      const shared = c.tags
        .filter((t) => interests.has(t))
        .slice(0, 2)
        .join(" & ")
        .toLowerCase();
      return { c, score, why: shared ? `Made for your love of ${shared}.` : c.blurb };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ c, why }) => ({ name: c.name, country: c.country, why, image: c.image, city: c }));

  const save = async (idea: Idea) => {
    setSaving(idea.name);
    try {
      let id = idea.city?.id;
      if (!id) {
        const hit =
          (await searchCities(idea.name)).find(
            (g) => g.country.toLowerCase() === idea.country.toLowerCase(),
          ) ?? (await searchCities(idea.name))[0];
        if (!hit) throw new Error("not found");
        id = await open(hit);
      }
      if (!app.isSaved(id)) app.toggleSave(id, "destination");
    } catch {
      toast.error(`Couldn't find ${idea.name} on the map`);
    } finally {
      setSaving(null);
    }
  };

  const ideas = ai.data ?? (app.ai && ai.isFetching ? [] : known);
  return (
    <section className="mt-10">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        icon={<Sparkles className="h-5 w-5" />}
        action={
          app.ai ? (
            <button
              onClick={() => void ai.refetch()}
              disabled={ai.isFetching}
              className={pillButton({ variant: "soft", size: "xs" })}
            >
              {ai.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              New ideas
            </button>
          ) : undefined
        }
      />
      {ai.isFetching && !ai.data && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-30 animate-pulse rounded-3xl bg-card/70" />
          ))}
        </div>
      )}
      {!ideas.length && !ai.isFetching && (
        <div className="flex items-center gap-3 rounded-3xl bg-card p-5 text-sm text-muted-foreground shadow-soft">
          <Compass className="h-6 w-6 shrink-0 text-sea" />
          <p>
            {ai.isError
              ? "Couldn't fetch ideas right now. Search any city above to start exploring."
              : "Search any city in the world to start exploring. The places you look up will show here."}
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {ideas.map((d) => (
          <article
            key={d.name + d.country}
            className="flex gap-3 rounded-3xl bg-card p-3 shadow-soft"
          >
            <img
              src={d.image}
              alt=""
              loading="lazy"
              className="h-24 w-24 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-tight">{d.name}</p>
              <p className="text-xs font-bold text-muted-foreground">
                {d.country}
                {d.bestMonths ? ` · best ${d.bestMonths}` : ""}
              </p>
              <p className="mt-1 line-clamp-2 text-xs">{d.why}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void save(d)}
                  disabled={saving === d.name}
                  className={pillButton({ variant: "outline", size: "xs" })}
                >
                  <Heart className="h-3.5 w-3.5" />
                  {saving === d.name ? "Saving…" : "Bucket list"}
                </button>
                {d.city && (
                  <Link
                    to="/destination/$id"
                    params={{ id: d.city.id }}
                    className={pillButton({ variant: "ghost", size: "xs" })}
                  >
                    <Plane className="h-3.5 w-3.5" />
                    Peek
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {ai.data && (
        <p className="mt-2 text-right">
          <Tag tone="lilac">
            <Sparkles className="h-3 w-3" />
            AI picks
          </Tag>
        </p>
      )}
    </section>
  );
}
