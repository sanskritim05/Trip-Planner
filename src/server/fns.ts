/**
 * Server functions (RPC). Node-only modules are imported lazily inside handlers so
 * they never end up in the browser bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import type { GroupDoc, SharedTrip } from "@/lib/group";
import type { AppState } from "@/lib/types";
import type { PublicUser } from "./auth";

type AuthResult = { ok: true; user: PublicUser } | { ok: false; error: string };

async function authCall(fn: () => Promise<PublicUser>): Promise<AuthResult> {
  const { AuthError } = await import("./auth");
  try {
    return { ok: true, user: await fn() };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again" };
  }
}

/* --------------------------------- auth --------------------------------- */

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  const [{ currentUser }, { aiEnabled, AI_MODEL }] = await Promise.all([
    import("./auth"),
    import("./ai"),
  ]);
  return { user: await currentUser(), ai: aiEnabled(), aiModel: aiEnabled() ? AI_MODEL : null };
});

export const signUpFn = createServerFn({ method: "POST" })
  .validator((d: { name: string; email: string; password: string }) => d)
  .handler(async ({ data }) => authCall(async () => (await import("./auth")).signUp(data)));

export const logInFn = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => authCall(async () => (await import("./auth")).logIn(data)));

export const logOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await (await import("./auth")).logOut();
  return { ok: true };
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((d: { name?: string; avatar?: string | null }) => d)
  .handler(async ({ data }) => authCall(async () => (await import("./auth")).updateProfile(data)));

/* --------------------------- per-user app state -------------------------- */

type StateDoc = { state: AppState; updatedAt: string };

export const loadStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const [{ currentUser }, db] = await Promise.all([import("./auth"), import("./db")]);
  const user = await currentUser();
  if (!user) return null;
  return db.get<StateDoc>("state", user.id);
});

export const saveStateFn = createServerFn({ method: "POST" })
  .validator((d: StateDoc) => d)
  .handler(async ({ data }) => {
    const [{ requireUser }, db] = await Promise.all([import("./auth"), import("./db")]);
    const user = await requireUser();
    await db.update<StateDoc>("state", user.id, (cur) =>
      cur && cur.updatedAt > data.updatedAt
        ? cur
        : { state: { ...data.state, user }, updatedAt: data.updatedAt },
    );
    return { ok: true };
  });

/* ------------------------------ group trips ------------------------------ */

function randomCode(city: string) {
  return `${
    (city || "TRIP")
      .replace(/[^a-z]/gi, "")
      .slice(0, 5)
      .toUpperCase() || "TRIP"
  }-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const groupShareFn = createServerFn({ method: "POST" })
  .validator((d: { trip: SharedTrip; cityName: string }) => d)
  .handler(async ({ data }): Promise<GroupDoc> => {
    const [{ requireUser }, db, { memberColor }] = await Promise.all([
      import("./auth"),
      import("./db"),
      import("@/lib/group"),
    ]);
    const user = await requireUser();
    let code = data.trip.group?.inviteCode || randomCode(data.cityName);
    const taken = await db.get<GroupDoc>("groups", code);
    if (taken && taken.ownerId !== user.id) code = randomCode(data.cityName);
    const group = data.trip.group ?? {
      members: [],
      suggestions: [],
      finalized: false,
      inviteCode: code,
    };
    // The organizer's local "me" becomes their real account id.
    const members = group.members.map((m) =>
      m.id === "me" ? { ...m, id: user.id, name: user.name } : m,
    );
    if (!members.some((m) => m.id === user.id))
      members.unshift({ id: user.id, name: user.name, role: "organizer", color: memberColor(0) });
    const swapMe = (votes: Record<string, "yes" | "no">) =>
      Object.fromEntries(Object.entries(votes).map(([k, v]) => [k === "me" ? user.id : k, v]));
    const trip: SharedTrip = {
      ...data.trip,
      group: {
        ...group,
        inviteCode: code,
        members,
        shared: true,
        suggestions: group.suggestions.map((s) => ({
          ...s,
          by: s.by === "me" ? user.id : s.by,
          votes: swapMe(s.votes),
        })),
      },
      photos: data.trip.photos.map((p) => (p.by ? p : { ...p, by: user.name })),
    };
    return db.update<GroupDoc>("groups", code, (cur) => ({
      code,
      ownerId: user.id,
      version: (cur?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      trip,
    }));
  });

export const groupGetFn = createServerFn({ method: "GET" })
  .validator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const [{ requireUser }, db] = await Promise.all([import("./auth"), import("./db")]);
    await requireUser();
    return db.get<GroupDoc>("groups", data.code.toUpperCase());
  });

export const groupJoinFn = createServerFn({ method: "POST" })
  .validator((d: { code: string }) => d)
  .handler(async ({ data }): Promise<GroupDoc | null> => {
    const [{ requireUser }, db, { memberColor }] = await Promise.all([
      import("./auth"),
      import("./db"),
      import("@/lib/group"),
    ]);
    const user = await requireUser();
    const code = data.code.toUpperCase();
    if (!(await db.get<GroupDoc>("groups", code))) return null;
    return db.update<GroupDoc>("groups", code, (cur) => {
      const doc = cur!;
      const g = doc.trip.group!;
      if (g.members.some((m) => m.id === user.id)) return doc;
      const members = [
        ...g.members,
        {
          id: user.id,
          name: user.name,
          role: "member" as const,
          color: memberColor(g.members.length),
        },
      ];
      return {
        ...doc,
        version: doc.version + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        trip: {
          ...doc.trip,
          travelers: Math.max(doc.trip.travelers, members.length),
          group: { ...g, members },
        },
      };
    });
  });

export const groupPushFn = createServerFn({ method: "POST" })
  .validator((d: { code: string; trip: SharedTrip }) => d)
  .handler(async ({ data }): Promise<GroupDoc | null> => {
    const [{ requireUser }, db, { mergeShared }] = await Promise.all([
      import("./auth"),
      import("./db"),
      import("@/lib/group"),
    ]);
    const user = await requireUser();
    const code = data.code.toUpperCase();
    const existing = await db.get<GroupDoc>("groups", code);
    if (!existing || !existing.trip.group?.members.some((m) => m.id === user.id)) return null;
    return db.update<GroupDoc>("groups", code, (cur) => {
      const doc = cur ?? existing;
      return {
        ...doc,
        version: doc.version + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
        trip: mergeShared(doc.trip, data.trip),
      };
    });
  });

/* ----------------------------------- AI ---------------------------------- */

async function aiCall<T>(fn: (ai: typeof import("./ai")) => Promise<T | null>): Promise<T | null> {
  const ai = await import("./ai");
  if (!ai.aiEnabled()) return null;
  try {
    return await fn(ai);
  } catch (e) {
    console.error("AI request failed", e);
    return null;
  }
}

export const aiEnrichFn = createServerFn({ method: "POST" })
  .validator((d: Parameters<typeof import("./ai").enrichPlaces>[0]) => d)
  .handler(async ({ data }) => aiCall((ai) => ai.enrichPlaces(data)));

export const aiFilmingFn = createServerFn({ method: "POST" })
  .validator((d: { title: string }) => d)
  .handler(async ({ data }) => aiCall((ai) => ai.filmingLocations(data.title.slice(0, 120))));

export const aiDestinationsFn = createServerFn({ method: "POST" })
  .validator((d: Parameters<typeof import("./ai").suggestDestinations>[0]) => d)
  .handler(async ({ data }) => aiCall((ai) => ai.suggestDestinations(data)));
