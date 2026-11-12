import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Logo } from "@/components/app/Logo";
import { getCity, getPlace, registerCities, registerPlaces } from "@/data/registry";
import { fetchSession, loadStateFn, saveStateFn } from "@/server/fns";
import { localISO } from "./dates";
import type {
  AppNotification,
  AppState,
  BucketItem,
  City,
  Place,
  ScrapbookTheme,
  Trip,
} from "./types";

const KEY = "ans2sans:v3";
const OLD_KEY = "ans2sans:v2";
/** Holds the user id while this device has changes the server hasn't received yet. */
const UNSYNCED_KEY = "ans2sans:unsynced";

function unsyncedFor(): string | null {
  try {
    return localStorage.getItem(UNSYNCED_KEY);
  } catch {
    return null;
  }
}
function markUnsynced(userId: string | null) {
  try {
    if (userId) localStorage.setItem(UNSYNCED_KEY, userId);
    else localStorage.removeItem(UNSYNCED_KEY);
  } catch {
    /* storage unavailable */
  }
}

type Ctx = {
  state: AppState;
  setState: (fn: (s: AppState) => AppState) => void;
  ai: boolean;
  aiModel: string | null;
  online: boolean;
};
const StoreCtx = createContext<Ctx | null>(null);

/** A brand-new traveler: no trips, no saved places, default preferences. */
export function emptyState(): AppState {
  return {
    version: 3,
    user: null,
    onboarded: false,
    prefs: {
      activities: [],
      style: [],
      budget: "moderate",
      dietary: [],
      transport: ["walk", "transit"],
      destinations: [],
      pace: "balanced",
    },
    trips: [],
    bucket: [],
    places: {},
    cities: {},
    taste: {},
    notifications: [],
    settings: {
      notifReminders: true,
      notifPlanning: true,
      notifMemories: true,
      privateProfile: true,
      shareLocation: false,
    },
  };
}

type Legacy = { demo?: boolean; link?: string; id?: string };

/**
 * Older versions created sample trips (ids "demo-…") for every new account, plus a
 * simulated "today". Strip all of it so only the traveler's own data remains.
 */
function stripSamples(s: AppState): AppState {
  const { demoToday: _drop, ...rest } = s as AppState & { demoToday?: unknown };
  const sample = (x: Legacy) => !!x.demo || !!x.id?.startsWith("demo-");
  const trips = rest.trips.filter((t) => !sample(t as Legacy));
  return {
    ...rest,
    trips: trips.map(({ demo: _d, ...t }: Trip & Legacy) => t),
    bucket: rest.bucket
      .filter((b) => !(b as Legacy).demo)
      .map(({ demo: _d, ...b }: BucketItem & Legacy) => b),
    notifications: rest.notifications.filter((n) => !n.link?.includes("/demo-")),
  };
}

/** Bring older saved data up to the current shape. */
export function migrate(raw: unknown): AppState | null {
  const s = raw as Partial<AppState> & { version?: number };
  if (!s || typeof s !== "object" || !Array.isArray(s.trips)) return null;
  if (s.version === 3) return stripSamples(s as AppState);
  if (s.version !== 2) return null;
  const theme = (t: string) =>
    t === "blush" || t === "sea" || t === "sand"
      ? t
      : t === "coral"
        ? "sea"
        : t === "beige"
          ? "sand"
          : "blush";
  return stripSamples({
    ...(s as AppState),
    version: 3,
    user: s.user ? { ...s.user, id: s.user.id ?? "local" } : null,
    places: {},
    cities: {},
    taste: {},
    trips: s.trips.map((t) => ({
      ...t,
      accommodation: t.accommodation ?? "hotel",
      unavailableMonths: t.unavailableMonths ?? [],
      scrapbook: t.scrapbook
        ? {
            ...t.scrapbook,
            theme: theme(t.scrapbook.theme) as ScrapbookTheme,
            layouts: t.scrapbook.layouts ?? {},
          }
        : null,
    })),
  });
}

function readLocal(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Keep the place/city registry in sync with places/cities stored in state. */
function registerFromState(s: AppState) {
  registerCities(Object.values(s.cities ?? {}));
  registerPlaces(Object.values(s.places ?? {}));
  for (const t of s.trips)
    for (const sug of t.group?.suggestions ?? []) if (sug.place) registerPlaces([sug.place]);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setRaw] = useState<AppState | null>(null);
  const [ai, setAi] = useState(false);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const warned = useRef(false);
  const lastSaved = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = readLocal();
    (async () => {
      let next: AppState | null = null;
      let needsPush = false;
      try {
        const session = await fetchSession();
        setAi(session.ai);
        setAiModel(session.aiModel);
        if (session.user) {
          const remote = await loadStateFn();
          const fromServer = remote ? migrate(remote.state) : null;
          const sameUser = local?.user?.id === session.user.id;
          if (local && sameUser && unsyncedFor() === session.user.id) {
            // This device has edits that never reached the server (e.g. a reload right
            // after a change). They're newer, so keep them and push them up.
            next = { ...local, user: session.user };
            needsPush = true;
          } else if (fromServer) next = { ...fromServer, user: session.user };
          else if (local && local.user?.id === session.user.id)
            next = { ...local, user: session.user };
          else next = { ...emptyState(), user: session.user, onboarded: true };
        } else {
          next = local ? { ...local, user: null } : emptyState();
        }
      } catch {
        // Server unreachable: keep working from this device's copy.
        setOnline(false);
        next = local ?? emptyState();
      }
      if (cancelled || !next) return;
      registerFromState(next);
      // An empty "last saved" snapshot makes the save effect push this state.
      lastSaved.current = needsPush ? "" : JSON.stringify(next);
      setRaw(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    registerFromState(state);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      if (!warned.current)
        toast.error(
          "This device's storage is full, but your trips are still saved to your account.",
        );
      warned.current = true;
    }
    if (!state.user || state.user.id === "local" || !online) return;
    const snapshot = JSON.stringify(state);
    if (snapshot === lastSaved.current) return;
    const userId = state.user.id;
    markUnsynced(userId);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const save = () => {
      saveTimer.current = null;
      flush.current = null;
      saveStateFn({ data: { state, updatedAt: new Date().toISOString() } })
        .then(() => {
          lastSaved.current = snapshot;
          // Only clear the marker if nothing newer is waiting to be saved.
          if (!saveTimer.current) markUnsynced(null);
        })
        .catch(() =>
          toast.error("Couldn't sync to your account. We'll retry on your next change."),
        );
    };
    flush.current = save;
    saveTimer.current = setTimeout(save, 1200);
  }, [state, online]);

  // Leaving the page with a save still queued: send it right away.
  useEffect(() => {
    const onHide = () => {
      if (!saveTimer.current || !flush.current) return;
      clearTimeout(saveTimer.current);
      flush.current();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const value = useMemo<Ctx | null>(
    () =>
      state
        ? { state, setState: (fn) => setRaw((s) => (s ? fn(s) : s)), ai, aiModel, online }
        : null,
    [state, ai, aiModel, online],
  );

  if (!value) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Logo size="lg" />
        <p className="font-display text-xl italic">packing your bags…</p>
      </div>
    );
  }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function useApp() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useApp must be used within StoreProvider");
  const { state, setState, ai, aiModel, online } = ctx;
  const today = localISO(new Date());

  const updateTrip = (id: string, fn: (t: Trip) => Trip) =>
    setState((s) => ({
      ...s,
      trips: s.trips.map((t) =>
        t.id === id ? { ...fn(t), updatedAt: new Date().toISOString() } : t,
      ),
    }));

  const notify = (n: Omit<AppNotification, "id" | "createdAt" | "read">) =>
    setState((s) => ({
      ...s,
      notifications: [
        { ...n, id: uid("n"), createdAt: new Date().toISOString(), read: false },
        ...s.notifications,
      ].slice(0, 60),
    }));

  const findBucket = (refId: string) => state.bucket.find((b) => b.refId === refId);

  /** Learn from behaviour: positive for likes/saves/visits, negative for skips. */
  const nudgeTaste = (keys: string[], delta: number) =>
    setState((s) => {
      const taste = { ...s.taste };
      for (const k of keys) taste[k] = Math.max(-4, Math.min(8, (taste[k] ?? 0) + delta));
      return { ...s, taste };
    });

  const tasteKeys = (p: Place | undefined) => (p ? [...p.tags, p.category] : []);

  const actions = {
    setState,
    updateTrip,
    notify,
    uid,
    nudgeTaste,
    tasteKeys,
    getTrip: (id: string) => state.trips.find((t) => t.id === id),
    createTrip: (t: Trip) => setState((s) => ({ ...s, trips: [t, ...s.trips] })),
    deleteTrip: (id: string) =>
      setState((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== id) })),
    duplicateTrip: (id: string) => {
      const src = state.trips.find((t) => t.id === id);
      if (!src) return null;
      const copy: Trip = {
        ...src,
        id: uid("trip"),
        name: `${src.name} (copy)`,
        status: "draft",
        step: 7,
        confirmed: false,
        photos: [],
        expenses: [],
        scrapbook: null,
        group: null,
        days: src.days.map((d) => ({
          ...d,
          activities: d.activities.map((a) => ({ ...a, status: "pending" as const })),
        })),
        updatedAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, trips: [copy, ...s.trips] }));
      return copy.id;
    },
    /** Persist places/cities discovered at runtime so they survive reloads and sync to the account. */
    savePlaces: (list: Place[]) => {
      if (!list.length) return;
      registerPlaces(list);
      setState((s) => {
        const places = { ...s.places };
        for (const p of list) places[p.id] = p;
        return { ...s, places };
      });
    },
    saveCity: (c: City) => {
      registerCities([c]);
      setState((s) => ({ ...s, cities: { ...s.cities, [c.id]: c } }));
    },
    isSaved: (refId: string) => !!findBucket(refId),
    toggleSave: (refId: string, kind: BucketItem["kind"]) => {
      const existing = findBucket(refId);
      const place = getPlace(refId);
      const name = kind === "destination" ? getCity(refId)?.name : place?.name;
      if (existing) {
        setState((s) => ({ ...s, bucket: s.bucket.filter((b) => b.refId !== refId) }));
        toast(`Removed ${name ?? "place"} from your bucket list`);
      } else {
        setState((s) => ({
          ...s,
          bucket: [
            {
              id: uid("b"),
              kind,
              refId,
              savedAt: new Date().toISOString(),
              visited: false,
              note: "",
            },
            ...s.bucket,
          ],
        }));
        if (place) nudgeTaste(tasteKeys(place), 0.8);
        toast.success(`Saved ${name ?? "place"} to your bucket list`);
      }
    },
    updateBucket: (id: string, patch: Partial<BucketItem>) =>
      setState((s) => ({
        ...s,
        bucket: s.bucket.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),
    removeBucket: (id: string) =>
      setState((s) => ({ ...s, bucket: s.bucket.filter((b) => b.id !== id) })),
    markAllRead: () =>
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      })),
  };

  return { state, today, ai, aiModel, online, ...actions };
}

/** Blank draft trip for the wizard. */
export function newDraftTrip(id: string, cityId = ""): Trip {
  return {
    id,
    cityId,
    name: "",
    startDate: "",
    endDate: "",
    flexible: false,
    budget: 2000,
    currency: "USD",
    budgetStyle: "moderate",
    budgetSplit: { Accommodation: 40, Food: 25, Transportation: 15, Attractions: 20 },
    accommodation: "hotel",
    unavailableMonths: [],
    travelers: 1,
    travelerType: "solo",
    interests: [],
    pace: "balanced",
    walking: "medium",
    transport: "walk",
    dietary: [],
    startHour: 9,
    status: "draft",
    step: 1,
    places: [],
    passed: [],
    days: [],
    unscheduled: [],
    photos: [],
    expenses: [],
    scrapbook: null,
    group: null,
    confirmed: false,
    updatedAt: new Date().toISOString(),
  };
}
