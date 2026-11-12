import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/app/Nav";
import {
  Card,
  EmptyState,
  Modal,
  Page,
  PageHeader,
  Tag,
  inputCls,
  pillButton,
} from "@/components/app/ui";
import { Bubbles } from "@/components/app/whimsy";
import { getCity, getPlace } from "@/data/registry";
import { memberColor, myMemberId } from "@/lib/group";
import { useGroupActions } from "@/lib/group-sync";
import { useCityPlaces } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Group as GroupT, Place } from "@/lib/types";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";
import { palette } from "@/lib/theme";

export const Route = createFileRoute("/trip/$id/group")({
  head: () => seo("Group trip", "Plan together: suggest places, vote and share memories."),
  component: Group,
});

function Group() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, state, online } = useApp();
  const actions = useGroupActions();
  const navigate = useNavigate();
  const trip = getTrip(id);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [q, setQ] = useState("");
  const { places } = useCityPlaces(trip?.cityId, trip);
  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const city = getCity(trip.cityId);
  const g = trip.group;
  const userId = state.user?.id;
  const canShare = !!userId && userId !== "local" && online;

  if (!g) {
    return (
      <Page>
        <PageHeader title="Plan together" subtitle={trip.name} />
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Make it a group trip"
          body="Invite friends to suggest places, vote on plans and fill a shared time capsule together."
        >
          <button
            onClick={() =>
              updateTrip(id, (t) => ({
                ...t,
                travelerType: t.travelerType === "solo" ? "friends" : t.travelerType,
                group: {
                  inviteCode: "",
                  finalized: false,
                  members: [
                    {
                      id: userId ?? "me",
                      name: state.user?.name ?? "You",
                      role: "organizer",
                      color: memberColor(0),
                    },
                  ],
                  suggestions: [],
                },
              }))
            }
            className={pillButton()}
          >
            <Users className="h-4 w-4" />
            Start a group trip
          </button>
        </EmptyState>
      </Page>
    );
  }

  const me = myMemberId(trip, userId);
  const isOrganizer = g.members.find((m) => m.id === me)?.role === "organizer";
  const memberName = (mid: string) =>
    mid === me ? "You" : (g.members.find((m) => m.id === mid)?.name ?? "Someone");
  const link =
    typeof window !== "undefined" && g.inviteCode
      ? `${window.location.origin}/join/${g.inviteCode}`
      : "";
  const setGroup = (fn: (g: GroupT) => GroupT) =>
    updateTrip(id, (t) => ({ ...t, group: t.group && fn(t.group) }));
  const vote = (pid: string, v: "yes" | "no") =>
    setGroup((gr) => ({
      ...gr,
      suggestions: gr.suggestions.map((s) =>
        s.placeId === pid ? { ...s, votes: { ...s.votes, [me]: v } } : s,
      ),
    }));
  const suggest = (p: Place) => {
    setGroup((gr) =>
      gr.suggestions.some((s) => s.placeId === p.id)
        ? gr
        : {
            ...gr,
            suggestions: [
              ...gr.suggestions,
              {
                placeId: p.id,
                by: me,
                votes: { [me]: "yes" },
                place: p,
              },
            ],
          },
    );
    toast.success(`Suggested ${p.name} to the group`);
    setSuggesting(false);
  };
  const tally = (votes: Record<string, "yes" | "no">) => ({
    yes: Object.values(votes).filter((v) => v === "yes").length,
    no: Object.values(votes).filter((v) => v === "no").length,
  });
  const finalize = () => {
    const ok = g.suggestions
      .filter((s) => tally(s.votes).yes > tally(s.votes).no)
      .map((s) => s.placeId);
    updateTrip(id, (t) => ({
      ...t,
      group: t.group && { ...t.group, finalized: true },
      places: [
        ...t.places,
        ...ok
          .filter((p) => !t.places.some((x) => x.placeId === p))
          .map((placeId) => ({ placeId, source: "group" as const, priority: false })),
      ],
    }));
    toast.success(`${ok.length} group favorite${ok.length === 1 ? "" : "s"} added to the trip`);
  };
  const share = async () => {
    setBusy(true);
    try {
      const doc = await actions.share(trip);
      toast.success("Your trip is live! Send the invite link to your crew.");
      if (doc.trip.id !== id)
        void navigate({ to: "/trip/$id/group", params: { id: doc.trip.id }, replace: true });
    } catch {
      toast.error("Couldn't start sharing. Check your connection.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      if (navigator.share)
        await navigator.share({
          title: `Join ${trip.name} on Ans2Sans`,
          text: `Help plan our trip to ${city?.name}!`,
          url: link,
        });
      else {
        await navigator.clipboard.writeText(link);
        toast.success("Invite link copied");
      }
    } catch {
      /* cancelled */
    }
  };
  const inTrip = new Set([
    ...trip.places.map((p) => p.placeId),
    ...g.suggestions.map((s) => s.placeId),
  ]);
  const lower = q.trim().toLowerCase();
  const options = places
    .filter(
      (p) =>
        !inTrip.has(p.id) && (!lower || `${p.name} ${p.category}`.toLowerCase().includes(lower)),
    )
    .slice(0, 30);

  return (
    <Page>
      <PageHeader
        title="Group trip"
        subtitle={`${trip.name} · ${g.members.length} traveler${g.members.length > 1 ? "s" : ""}`}
      />

      <Card className="relative overflow-hidden bg-gradient-to-br from-primary-soft to-sea-soft">
        <Bubbles className="opacity-60" />
        {g.shared ? (
          <div className="relative">
            <p className="flex items-center gap-2 text-sm font-extrabold text-sea-strong">
              <Wifi className="h-4 w-4" />
              Live: changes sync to everyone
            </p>
            <p className="mt-2 font-display text-2xl font-semibold">Invite code: {g.inviteCode}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void copy()} className={pillButton({ size: "sm" })}>
                {typeof navigator !== "undefined" && "share" in navigator ? (
                  <Share2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Invite friends
              </button>
              <button
                onClick={() => void actions.refresh(g.inviteCode).then(() => toast("Up to date"))}
                className={pillButton({ variant: "outline", size: "sm" })}
              >
                <RefreshCw className="h-4 w-4" />
                Sync now
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="font-display text-xl font-semibold">Invite your travel crew</p>
            <p className="mt-1 text-sm">
              Share a link so friends can join, suggest places, vote, and add photos to the shared
              time capsule. Everyone sees the same itinerary.
            </p>
            {canShare ? (
              <button
                disabled={busy}
                onClick={() => void share()}
                className={pillButton({ className: "mt-3" })}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Create invite link
              </button>
            ) : (
              <p className="mt-3 rounded-2xl bg-card/80 p-3 text-sm font-bold">
                Log in with an account (and be online) to share this trip.
              </p>
            )}
          </div>
        )}
      </Card>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">Who's coming</h2>
        <ul className="flex flex-wrap gap-3">
          {g.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-full bg-card py-1.5 pl-1.5 pr-4 shadow-soft"
            >
              <span className="rounded-full p-0.5" style={{ background: palette[m.color] }}>
                <Avatar name={m.name} src={null} size="sm" />
              </span>
              <span className="text-sm font-bold">{m.id === me ? "You" : m.name}</span>
              {m.role === "organizer" && (
                <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Organizer" />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Suggestions & votes</h2>
          <button onClick={() => setSuggesting(true)} className={pillButton({ size: "sm" })}>
            <Plus className="h-4 w-4" />
            Suggest a place
          </button>
        </div>
        {!g.suggestions.length && (
          <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground">
            No suggestions yet. Be the first! Places with more yes than no votes join the trip when
            the organizer finalizes.
          </p>
        )}
        <ul className="space-y-3">
          {g.suggestions.map((s) => {
            const p = getPlace(s.placeId) ?? s.place;
            const t = tally(s.votes);
            const mine = s.votes[me];
            const pct = t.yes + t.no ? (t.yes / (t.yes + t.no)) * 100 : 0;
            const added = trip.places.some((x) => x.placeId === s.placeId);
            return (
              <li key={s.placeId} className="rounded-3xl bg-card p-3 shadow-soft">
                <div className="flex items-center gap-3">
                  <img src={p?.image} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p?.name ?? "A place"}</p>
                    <p className="text-xs text-muted-foreground">
                      Suggested by {memberName(s.by)}
                      {added ? " · in the trip" : ""}
                    </p>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-pressed={mine === "yes"}
                      aria-label="Vote yes"
                      onClick={() => vote(s.placeId, "yes")}
                      className={cn(
                        "tap flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-sm font-bold",
                        mine === "yes" ? "bg-primary text-primary-foreground" : "bg-secondary",
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {t.yes}
                    </button>
                    <button
                      aria-pressed={mine === "no"}
                      aria-label="Vote no"
                      onClick={() => vote(s.placeId, "no")}
                      className={cn(
                        "tap flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-sm font-bold",
                        mine === "no" ? "bg-sea text-primary-foreground" : "bg-secondary",
                      )}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      {t.no}
                    </button>
                  </div>
                </div>
                {Object.keys(s.votes).length > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-muted-foreground">
                    {Object.entries(s.votes)
                      .map(([mid, v]) => `${memberName(mid)}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {isOrganizer ? (
          <button
            onClick={finalize}
            disabled={!g.suggestions.length}
            className={pillButton({ size: "lg", className: "mt-6 w-full" })}
          >
            <Check className="h-4 w-4" />
            {g.finalized ? "Add newly approved places" : "Finalize: add the group's favorites"}
          </button>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            The organizer adds approved places to the plan.
          </p>
        )}
        {trip.days.length > 0 && (
          <Link
            to="/trip/$id/review"
            params={{ id }}
            className={pillButton({ variant: "outline", className: "mt-3 w-full" })}
          >
            Re-plan the itinerary with group picks
          </Link>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/trip/$id/itinerary"
          params={{ id }}
          className={pillButton({ variant: "soft", size: "sm" })}
        >
          Shared itinerary
        </Link>
        <Link
          to="/trip/$id/capsule"
          params={{ id }}
          className={pillButton({ variant: "soft", size: "sm" })}
        >
          Shared time capsule
        </Link>
        {g.shared && (
          <Tag tone="mint">
            Synced{" "}
            {trip.updatedAt
              ? new Date(trip.updatedAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : ""}
          </Tag>
        )}
      </div>

      <Modal open={suggesting} onClose={() => setSuggesting(false)} title="Suggest a place">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${city?.name ?? ""}…`}
            aria-label="Search places"
            className={`${inputCls} pl-12`}
          />
        </div>
        <ul className="space-y-2">
          {options.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => suggest(p)}
                className="tap flex w-full items-center gap-3 rounded-2xl bg-secondary p-2 text-left"
              >
                <img src={p.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </span>
                <Plus className="h-5 w-5 text-primary" />
              </button>
            </li>
          ))}
          {!options.length && (
            <p className="p-4 text-center text-sm text-muted-foreground">No more places match.</p>
          )}
        </ul>
      </Modal>
    </Page>
  );
}
