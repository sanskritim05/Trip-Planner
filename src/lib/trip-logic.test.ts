import { describe, expect, it } from "vitest";
import { getPlace } from "@/data/registry";
import "./test-fixtures";
import { generateItinerary, replanDay, PACE_CAPACITY } from "./itinerary";
import {
  isCapsuleUnlocked,
  isScrapbookReleased,
  scrapbookReleaseDate,
  tripPhase,
} from "./trip-status";
import { daysUntil, formatRange, tripLength } from "./dates";

const trip = { status: "planned" as const, startDate: "2027-06-12", endDate: "2027-06-17" };

describe("time capsule & scrapbook timing", () => {
  it("capsule stays locked the day before the final day", () => {
    expect(isCapsuleUnlocked(trip, "2027-06-16")).toBe(false);
  });
  it("capsule unlocks ON the final day (June 17)", () => {
    expect(isCapsuleUnlocked(trip, "2027-06-17")).toBe(true);
  });
  it("scrapbook is not available on the final day", () => {
    expect(isScrapbookReleased(trip, "2027-06-17")).toBe(false);
  });
  it("scrapbook is released exactly one day after the trip ends (June 18)", () => {
    expect(scrapbookReleaseDate(trip)).toBe("2027-06-18");
    expect(isScrapbookReleased(trip, "2027-06-18")).toBe(true);
  });
  it("trip phases follow dates", () => {
    expect(tripPhase(trip, "2027-06-01")).toBe("upcoming");
    expect(tripPhase(trip, "2027-06-14")).toBe("active");
    expect(tripPhase(trip, "2027-06-18")).toBe("past");
    expect(tripPhase({ ...trip, status: "draft" }, "2027-06-14")).toBe("draft");
  });
});

describe("dates", () => {
  it("June 12–17 is a 6-day trip with countdown", () => {
    expect(tripLength("2027-06-12", "2027-06-17")).toBe(6);
    expect(formatRange("2027-06-12", "2027-06-17")).toBe("June 12–17, 2027");
    expect(daysUntil("2027-06-12", "2027-06-02")).toBe(10);
  });
});

describe("itinerary generator", () => {
  const ids = [
    "eiffel",
    "louvre",
    "montmartre",
    "notre-dame",
    "orsay",
    "marais",
    "luxembourg",
    "seine-cruise",
    "shakespeare",
  ];
  const selected = ids.map((placeId) => ({
    placeId,
    source: "swipe" as const,
    priority: placeId === "orsay",
  }));
  const res = generateItinerary({
    startDate: "2027-06-12",
    endDate: "2027-06-13",
    selected,
    lookup: getPlace,
    pace: "relaxed",
    mode: "walk",
    startHour: 9,
  });

  it("never exceeds the daily pace capacity", () => {
    for (const d of res.days) {
      const used = d.activities
        .filter((a) => a.kind === "place")
        .reduce((s, a) => s + a.duration + a.travelMin, 0);
      expect(used).toBeLessThanOrEqual(PACE_CAPACITY.relaxed);
    }
  });
  it("schedules every stop within opening hours", () => {
    for (const a of res.days.flatMap((d) => d.activities)) {
      const p = getPlace(a.placeId);
      if (!p) continue;
      expect(a.start).toBeGreaterThanOrEqual(p.open * 60);
      expect(a.start + a.duration).toBeLessThanOrEqual(p.close * 60);
    }
  });
  it("puts the must-visit place on day 1 and explains what didn't fit", () => {
    expect(res.days[0]?.activities.some((a) => a.placeId === "orsay")).toBe(true);
    const scheduled = res.days.flatMap((d) => d.activities).filter((a) => a.placeId).length;
    expect(scheduled + res.unscheduled.length).toBe(ids.length);
  });
  it("replanning preserves completed stops", () => {
    const day = res.days[0]!;
    const first = day.activities[0]!;
    const withDone = {
      ...day,
      activities: day.activities.map((a) =>
        a.id === first.id ? { ...a, status: "done" as const } : a,
      ),
    };
    const out = replanDay(
      withDone,
      { type: "late", minutes: 30 },
      { lookup: getPlace, mode: "walk", nowMin: 11 * 60, startHour: 9, priorityIds: new Set() },
    );
    const kept = out.day.activities.find((a) => a.id === first.id)!;
    expect(kept.status).toBe("done");
    expect(kept.start).toBe(first.start);
    const pending = out.day.activities.filter((a) => a.status === "pending");
    for (const a of pending) expect(a.start).toBeGreaterThanOrEqual(11 * 60 + 30);
  });
});
