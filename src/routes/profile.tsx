import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookHeart, Cloud, CloudOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TripLink } from "@/components/app/cards";
import { getCity } from "@/data/registry";
import { formatRange } from "@/lib/dates";
import { isScrapbookReleased } from "@/lib/trip-status";
import { logOutFn, updateProfileFn } from "@/server/fns";
import { Avatar } from "@/components/app/Nav";
import { PrefsEditor } from "@/components/app/PrefsEditor";
import { Card, Field, Page, PageHeader, Toggle, inputCls, pillButton } from "@/components/app/ui";
import { useApp } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/profile")({
  head: () => seo("Profile", "Your info, preferences and settings."),
  component: Profile,
});

function Profile() {
  const { state, setState, today, ai, aiModel, online } = useApp();
  const books = state.trips.filter(
    (t) => t.status === "planned" && t.startDate && isScrapbookReleased(t, today),
  );
  const navigate = useNavigate();
  const u = state.user;
  const s = state.settings;
  const setS = (k: keyof typeof s, v: boolean) =>
    setState((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  return (
    <Page>
      <PageHeader title="Profile" back={false} />
      <Card className="flex items-center gap-4">
        <Avatar name={u?.name ?? "T"} src={u?.avatar ?? null} size="lg" />
        <div className="flex-1 space-y-2">
          <Field label="Name">
            <input
              className={inputCls}
              value={u?.name ?? ""}
              onChange={(e) =>
                setState((x) => ({ ...x, user: x.user && { ...x.user, name: e.target.value } }))
              }
              onBlur={(e) =>
                void updateProfileFn({ data: { name: e.target.value } }).catch(() => undefined)
              }
            />
          </Field>
          <p className="text-sm text-muted-foreground">{u?.email}</p>
          <p className="flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              {online ? (
                <Cloud className="h-3.5 w-3.5 text-sea" />
              ) : (
                <CloudOff className="h-3.5 w-3.5" />
              )}
              {online ? "Synced to your account" : "Offline, saved on this device"}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {ai ? `AI planning on · ${aiModel ?? "Groq"}` : "Open-data planning (AI off)"}
            </span>
          </p>
        </div>
      </Card>
      <Card className="mt-4 space-y-3">
        <p className="font-bold">Notifications & privacy</p>
        {(
          [
            ["notifReminders", "Trip reminders"],
            ["notifPlanning", "Planning updates"],
            ["notifMemories", "Scrapbook & memories"],
            ["privateProfile", "Private profile"],
            ["shareLocation", "Allow location"],
          ] as const
        ).map(([k, l]) => (
          <div key={k} className="flex items-center justify-between">
            <span>{l}</span>
            <Toggle checked={s[k]} onChange={(v) => setS(k, v)} label={l} />
          </div>
        ))}
      </Card>
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-2xl font-semibold">
          <BookHeart className="h-5 w-5 text-primary" />
          My scrapbooks
        </h2>
        {books.length ? (
          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-3">
            {books.map((t) => (
              <TripLink key={t.id} trip={t} view="scrapbook" className="tap block w-44 shrink-0">
                <div className="polaroid -rotate-2">
                  <img
                    src={t.photos[0]?.src ?? getCity(t.cityId)?.image}
                    alt=""
                    className="aspect-square w-full rounded-sm object-cover"
                  />
                  <p className="mt-2 truncate text-center font-script text-lg">
                    {t.scrapbook?.title ?? t.name}
                  </p>
                  <p className="text-center text-[10px] font-bold text-muted-foreground">
                    {formatRange(t.startDate, t.endDate)}
                  </p>
                </div>
              </TripLink>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl bg-card p-5 text-sm text-muted-foreground">
            Your scrapbooks appear here the day after each trip ends.
          </p>
        )}
      </section>

      <h2 className="mb-3 mt-8 text-2xl font-semibold">Travel preferences</h2>
      <PrefsEditor value={state.prefs} onChange={(p) => setState((x) => ({ ...x, prefs: p }))} />
      <button
        className={pillButton({ variant: "danger", size: "lg", className: "mt-8 w-full" })}
        onClick={async () => {
          await logOutFn().catch(() => undefined);
          try {
            localStorage.removeItem("ans2sans:v3");
          } catch {
            /* ignore */
          }
          setState((x) => ({ ...x, user: null }));
          toast("Logged out. See you soon!");
          void navigate({ to: "/welcome" });
        }}
      >
        Log out
      </button>
    </Page>
  );
}
