import { useEffect, useRef } from "react";
import { getCity, getPlace } from "@/data/registry";
import { groupGetFn, groupJoinFn, groupPushFn, groupShareFn } from "@/server/fns";
import { applyShared, sharedHash, toShared, type GroupDoc } from "./group";
import { useApp } from "./store";
import type { AppState, Trip } from "./types";

const POLL_MS = 5000;
// Shared between the background sync and explicit share/join actions.
const syncedHash: Record<string, string> = {};

function applyDoc(app: ReturnType<typeof useApp>, doc: GroupDoc) {
  app.savePlaces(doc.trip.placeData ?? []);
  if (doc.trip.cityData) app.saveCity(doc.trip.cityData);
  app.setState((s: AppState) => {
    const local = s.trips.find((t) => t.id === doc.trip.id);
    const next = applyShared(local, doc.trip, doc.version);
    syncedHash[next.id] = sharedHash(next);
    return {
      ...s,
      trips: local ? s.trips.map((t) => (t.id === next.id ? next : t)) : [next, ...s.trips],
    };
  });
}

export function useGroupActions() {
  const app = useApp();
  return {
    async share(trip: Trip) {
      const doc = await groupShareFn({
        data: {
          trip: toShared(trip, getPlace, getCity(trip.cityId)),
          cityName: getCity(trip.cityId)?.name ?? "",
        },
      });
      applyDoc(app, doc);
      return doc;
    },
    async join(code: string) {
      const doc = await groupJoinFn({ data: { code } });
      if (doc) applyDoc(app, doc);
      return doc;
    },
    async refresh(code: string) {
      const doc = await groupGetFn({ data: { code } });
      if (doc) applyDoc(app, doc);
      return doc;
    },
  };
}

/** Background sync for shared group trips: push local edits, pull everyone else's. */
export function GroupSync() {
  const app = useApp();
  const stateRef = useRef(app.state);
  stateRef.current = app.state;
  const busy = useRef(new Set<string>());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const loggedIn = !!app.state.user && app.state.user.id !== "local" && app.online;

  const push = async (tripId: string) => {
    const t = stateRef.current.trips.find((x) => x.id === tripId);
    if (!t?.group?.shared || busy.current.has(tripId)) return;
    busy.current.add(tripId);
    const sentHash = sharedHash(t);
    try {
      const doc = await groupPushFn({
        data: { code: t.group.inviteCode, trip: toShared(t, getPlace, getCity(t.cityId)) },
      });
      const now = stateRef.current.trips.find((x) => x.id === tripId);
      // Only overlay the merged result if nothing changed locally while we were sending.
      if (doc && now && sharedHash(now) === sentHash) applyDoc(app, doc);
    } catch {
      /* offline; retried on the next change or poll */
    } finally {
      busy.current.delete(tripId);
    }
  };

  // Push local edits (debounced).
  useEffect(() => {
    if (!loggedIn) return;
    for (const t of app.state.trips) {
      if (!t.group?.shared) continue;
      const h = sharedHash(t);
      if (syncedHash[t.id] === undefined) {
        syncedHash[t.id] = h;
        continue;
      }
      if (h === syncedHash[t.id]) continue;
      clearTimeout(timers.current[t.id]);
      timers.current[t.id] = setTimeout(() => void push(t.id), 700);
    }
  }, [app.state.trips, loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull other members' changes.
  useEffect(() => {
    if (!loggedIn) return;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      for (const t of stateRef.current.trips) {
        if (!t.group?.shared || busy.current.has(t.id)) continue;
        try {
          const doc = await groupGetFn({ data: { code: t.group.inviteCode } });
          if (!doc || doc.version <= (t.group.version ?? 0)) continue;
          const latest = stateRef.current.trips.find((x) => x.id === t.id);
          if (latest && sharedHash(latest) !== syncedHash[t.id]) await push(t.id);
          else applyDoc(app, doc);
        } catch {
          /* ignore transient errors */
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(id);
  }, [loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
