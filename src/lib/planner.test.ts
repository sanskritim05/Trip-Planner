import { describe, expect, it } from "vitest";
import { getPlace } from "@/data/registry";
import "./test-fixtures";
import { seasonsFromClimate } from "@/services/geo";
import { comfortScore, describeCode, type MonthClimate } from "@/services/weather";
import { cheaperOptions, estimateBudget, total } from "./budget";
import { bestVisitTimes, crowdCurve } from "./crowds";
import { applyShared, mergeShared, myMemberId, sharedHash, toShared } from "./group";
import {
  findAlternatives,
  generateItinerary,
  isIndoor,
  replanDay,
  suggestDayFor,
} from "./itinerary";
import { recommend } from "./recommend";
import { emptyState, migrate, newDraftTrip } from "./store";
import type { Trip } from "./types";

/** A planned 5-day group trip used as a fixture across tests. */
const paris: Trip = (() => {
  const places = [
    ...["eiffel", "louvre"].map((placeId) => ({
      placeId,
      source: "must" as const,
      priority: true,
    })),
    ...["montmartre", "marais", "seine-cruise", "luxembourg", "orsay"].map((placeId) => ({
      placeId,
      source: "swipe" as const,
      priority: false,
    })),
  ];
  const plan = generateItinerary({
    startDate: "2026-12-19",
    endDate: "2026-12-23",
    selected: places,
    lookup: getPlace,
    pace: "balanced",
    mode: "walk",
    startHour: 9,
  });
  return {
    ...newDraftTrip("trip-paris", "paris"),
    name: "Paris with friends",
    startDate: "2026-12-19",
    endDate: "2026-12-23",
    budget: 4500,
    travelers: 3,
    travelerType: "friends",
    interests: ["Art", "Food", "Shopping"],
    status: "planned",
    confirmed: true,
    places,
    days: plan.days,
    unscheduled: plan.unscheduled,
    group: {
      inviteCode: "PARIS-TEST",
      finalized: false,
      members: [
        { id: "me", name: "You", role: "organizer", color: "chart-1" },
        { id: "maya", name: "Maya", role: "member", color: "chart-2" },
      ],
      suggestions: [{ placeId: "notre-dame", by: "maya", votes: { maya: "yes" } }],
    },
  };
})();

describe("weather-aware itinerary", () => {
  const selected = ["louvre", "orsay", "luxembourg", "montmartre", "eiffel", "marais"].map(
    (placeId) => ({ placeId, source: "swipe" as const, priority: false }),
  );
  const base = {
    startDate: "2027-05-01",
    endDate: "2027-05-02",
    selected,
    lookup: getPlace,
    pace: "balanced" as const,
    mode: "walk" as const,
    startHour: 9,
  };

  it("puts indoor places on the rainy day", () => {
    const res = generateItinerary({
      ...base,
      weather: { "2027-05-01": { rainy: true }, "2027-05-02": { rainy: false } },
    });
    const indoorShare = (d: number) => {
      const ps = res.days[d]!.activities.filter((a) => a.kind === "place").map((a) =>
        getPlace(a.placeId)!,
      );
      return ps.filter(isIndoor).length / Math.max(1, ps.length);
    };
    expect(indoorShare(0)).toBeGreaterThan(indoorShare(1));
  });

  it("rain action swaps outdoor stops for indoor alternatives", () => {
    const day = {
      date: "2027-05-01",
      activities: [
        {
          id: "a",
          kind: "place" as const,
          placeId: "luxembourg",
          start: 600,
          duration: 75,
          travelMin: 0,
          status: "pending" as const,
        },
      ],
    };
    const res = replanDay(
      day,
      { type: "rain", candidates: ["orsay", "eiffel"] },
      { lookup: getPlace, mode: "walk", nowMin: 540, startHour: 9, priorityIds: new Set() },
    );
    expect(res.day.activities[0]!.placeId).toBe("orsay");
  });

  it("finds cheaper nearby alternatives", () => {
    const louvre = getPlace("louvre")!;
    const alts = findAlternatives(
      louvre,
      ["orsay", "luxembourg", "eiffel"].map((id) => getPlace(id)!),
      { cheaper: true },
    );
    expect(alts.every((a) => a.cost < louvre.cost)).toBe(true);
  });

  it("suggests a later day with room for a missed stop", () => {
    const res = generateItinerary({ ...base, endDate: "2027-05-03" });
    const idx = suggestDayFor(getPlace("notre-dame")!, res.days, 1, "balanced", getPlace);
    expect(idx).not.toBeNull();
    expect(idx!).toBeGreaterThanOrEqual(1);
  });
});

describe("crowd model", () => {
  it("is zero while closed and steers visits away from the midday peak", () => {
    const eiffel = getPlace("eiffel")!;
    const c = crowdCurve(eiffel, "2027-07-10");
    expect(c[3]).toBe(0);
    expect(c[9]!).toBeLessThan(c[13]!);
    const best = bestVisitTimes(eiffel, "2027-07-10")[0]!.hour;
    expect(best < 11 || best > 20).toBe(true);
  });
});

describe("budget", () => {
  it("hostels cost less than resorts", () => {
    expect(estimateBudget({ ...paris, accommodation: "hostel" }).Accommodation).toBeLessThan(
      estimateBudget({ ...paris, accommodation: "resort" }).Accommodation,
    );
  });
  it("offers savings that actually reduce the estimate", () => {
    const rich: Trip = { ...paris, accommodation: "resort", budget: 100 };
    const opts = cheaperOptions(rich);
    expect(opts.length).toBeGreaterThan(0);
    const stay = opts.find((o) => o.kind === "stay");
    if (stay?.kind === "stay")
      expect(total(estimateBudget({ ...rich, accommodation: stay.to }))).toBeLessThan(
        total(estimateBudget(rich)),
      );
  });
});

describe("recommendations learn", () => {
  it("ranks places with liked tags higher after positive feedback", () => {
    const t = { ...paris, places: [], passed: [], interests: [] };
    const before = recommend(t, new Set(), {}).findIndex((r) => r.place.category === "Museum");
    const after = recommend(t, new Set(), { Museum: 6, Art: 6 }).findIndex(
      (r) => r.place.category === "Museum",
    );
    expect(after).toBeLessThanOrEqual(before);
    expect(after).toBe(0);
  });
});

describe("group trips", () => {
  const shared = toShared(paris, getPlace, undefined);

  it("merges votes and members instead of overwriting them", () => {
    const a = {
      ...shared,
      group: {
        ...shared.group!,
        suggestions: [{ placeId: "x", by: "u1", votes: { u1: "yes" as const } }],
      },
    };
    const b = {
      ...shared,
      group: {
        ...shared.group!,
        members: [
          ...shared.group!.members,
          { id: "u2", name: "Bo", role: "member" as const, color: "chart-4" as const },
        ],
        suggestions: [{ placeId: "x", by: "u1", votes: { u2: "no" as const } }],
      },
    };
    const m = mergeShared(a, b);
    expect(m.group!.suggestions[0]!.votes).toEqual({ u1: "yes", u2: "no" });
    expect(m.group!.members.some((x) => x.id === "u2")).toBe(true);
  });

  it("keeps check-ins and photos from every member", () => {
    const done = {
      ...shared,
      days: shared.days.map((d, i) =>
        i === 0
          ? {
              ...d,
              activities: d.activities.map((x, j) =>
                j === 0 ? { ...x, status: "done" as const } : x,
              ),
            }
          : d,
      ),
      photos: [
        {
          id: "p1",
          activityId: "a",
          placeId: "eiffel",
          day: 0,
          src: "data:",
          caption: "",
          createdAt: "",
        },
      ],
    };
    const other = {
      ...shared,
      photos: [
        {
          id: "p2",
          activityId: "b",
          placeId: "louvre",
          day: 0,
          src: "data:",
          caption: "",
          createdAt: "",
        },
      ],
    };
    const m = mergeShared(done, other);
    expect(m.days[0]!.activities[0]!.status).toBe("done");
    expect(m.photos.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("applying a shared doc keeps personal expenses and marks the trip live", () => {
    const local = {
      ...paris,
      expenses: [{ id: "e", category: "Food" as const, amount: 5, date: "2027-01-01", note: "" }],
    };
    const next = applyShared(local, { ...shared, name: "Renamed" }, 7);
    expect(next.name).toBe("Renamed");
    expect(next.expenses).toHaveLength(1);
    expect(next.group?.shared).toBe(true);
    expect(next.group?.version).toBe(7);
    expect(sharedHash(next)).toBe(sharedHash({ ...next, group: { ...next.group!, version: 99 } }));
  });

  it("maps the signed-in user to their member id", () => {
    expect(myMemberId(paris, "u_123")).toBe("me");
    expect(
      myMemberId(
        {
          group: {
            ...paris.group!,
            members: [{ id: "u_123", name: "S", role: "organizer", color: "chart-1" }],
          },
        },
        "u_123",
      ),
    ).toBe("u_123");
  });
});

describe("climate & seasons", () => {
  const climate: MonthClimate[] = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    max: 8 + 18 * Math.sin((Math.PI * (m - 1)) / 11),
    min: 2 + 12 * Math.sin((Math.PI * (m - 1)) / 11),
    rainyDays: 8,
    precip: 50,
    sunHours: 6,
  }));
  it("scores mild months above freezing ones", () => {
    expect(comfortScore(climate[5]!)).toBeGreaterThan(comfortScore(climate[0]!));
  });
  it("builds four seasons with one recommended", () => {
    const s = seasonsFromClimate(climate, 48);
    expect(s).toHaveLength(4);
    expect(s.some((x) => x.recommended)).toBe(true);
    expect(s.find((x) => x.label === "Summer")!.crowd).toBeGreaterThanOrEqual(2);
  });
  it("maps weather codes", () => {
    expect(describeCode(63).icon).toBe("rain");
    expect(describeCode(0).icon).toBe("sun");
  });
});

describe("migration", () => {
  it("upgrades v2 data", () => {
    const withBook: Trip = {
      ...paris,
      scrapbook: {
        theme: "coral" as never,
        coverPhotoId: null,
        order: [],
        removed: [],
        captions: {},
        notes: {},
        title: "Paris",
      } as never,
    };
    const v2 = {
      ...emptyState(),
      version: 2,
      places: undefined,
      cities: undefined,
      taste: undefined,
      user: { name: "A", email: "a@b.c", avatar: null },
      trips: [{ ...withBook, accommodation: undefined }],
    };
    const m = migrate(v2)!;
    expect(m.version).toBe(3);
    expect(m.taste).toEqual({});
    expect(m.trips.every((t) => t.accommodation === "hotel")).toBe(true);
    expect(m.trips.find((t) => t.scrapbook)!.scrapbook!.theme).toBe("sea");
  });
  it("removes sample trips and the simulated date from older accounts", () => {
    const old = {
      ...emptyState(),
      demoToday: "2026-01-01",
      trips: [paris, { ...paris, id: "demo-kyoto", demo: true }],
      bucket: [
        {
          id: "b1",
          kind: "attraction",
          refId: "eiffel",
          savedAt: "",
          visited: false,
          note: "",
          demo: true,
        },
        { id: "b2", kind: "attraction", refId: "louvre", savedAt: "", visited: false, note: "" },
      ],
      notifications: [
        {
          id: "n1",
          title: "",
          body: "",
          createdAt: "",
          read: false,
          kind: "reminder",
          link: "/trip/demo-kyoto/active",
        },
      ],
    };
    const m = migrate(old)!;
    expect(m.trips.map((t) => t.id)).toEqual(["trip-paris"]);
    expect(m.bucket.map((b) => b.id)).toEqual(["b2"]);
    expect(m.notifications).toHaveLength(0);
    expect("demoToday" in m).toBe(false);
  });
  it("rejects garbage", () => {
    expect(migrate({ nope: true })).toBeNull();
  });
});

describe("AI answer salvage", async () => {
  const { salvage } = await import("@/server/ai");
  const { z } = await import("zod/v4");
  const schema = z.object({
    title: z.string(),
    items: z.array(z.object({ name: z.string(), cost: z.number() })),
  });

  it("keeps valid items and drops malformed ones", () => {
    const raw = {
      title: "Porto",
      items: [{ name: "A", cost: 1 }, { name: "B" }, { name: "C", cost: 3, extra: "ignored" }],
    };
    expect(salvage(schema, raw)).toEqual({
      title: "Porto",
      items: [
        { name: "A", cost: 1 },
        { name: "C", cost: 3 },
      ],
    });
  });
  it("gives up when a required non-list field is broken", () => {
    expect(salvage(schema, { items: [] })).toBeNull();
  });
});

describe("text style", async () => {
  const { tidy } = await import("./text");
  it("removes em dashes from outside text", () => {
    expect(tidy("A bridge \u2014 the oldest in town.")).toBe("A bridge, the oldest in town.");
    expect(tidy("Built in 1886 \u2014.")).toBe("Built in 1886.");
    expect(tidy("No dashes here")).toBe("No dashes here");
  });
});
