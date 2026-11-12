import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookLock,
  ChevronLeft,
  ChevronRight,
  Download,
  Palette,
  Share2,
  Trash2,
  Plane,
  Shell,
  MapPin,
  Sun,
  Flower2,
  Mail,
  Waves,
  Camera,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/app/MapView";
import { Chip, EstimateNote, Page, PageHeader, inputCls, pillButton } from "@/components/app/ui";
import { getCity, getPlace } from "@/data/registry";
import { formatRange, formatShort } from "@/lib/dates";
import { isScrapbookReleased, scrapbookReleaseDate } from "@/lib/trip-status";
import { useApp } from "@/lib/store";
import type { PageLayout, Photo, Scrapbook, ScrapbookTheme, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";
import { palette } from "@/lib/theme";

export const Route = createFileRoute("/trip/$id/scrapbook")({
  head: () => seo("Digital scrapbook", "Your trip, beautifully assembled into a travel journal."),
  component: ScrapbookPage,
});

const THEMES: Record<ScrapbookTheme, { bg: string; label: string; accent: string }> = {
  blush: { bg: "bg-primary-soft", label: "Sage garden", accent: "text-primary-strong" },
  sea: { bg: "bg-sea-soft", label: "Coral sunset", accent: "text-sea" },
  sand: { bg: "bg-secondary", label: "Linen", accent: "text-foreground" },
};
const STICKERS = [Plane, Shell, MapPin, Sun, Flower2, Mail, Waves, Camera];
const LAYOUTS: { k: PageLayout; label: string }[] = [
  { k: "grid", label: "▦ Grid" },
  { k: "collage", label: "Collage" },
  { k: "hero", label: "Hero" },
  { k: "strip", label: "Film strip" },
];
const DEFAULT_LAYOUTS: PageLayout[] = ["grid", "collage", "hero", "strip"];

export function assembleScrapbook(trip: Trip): Scrapbook {
  return {
    theme: "blush",
    coverPhotoId: trip.photos[0]?.id ?? null,
    order: [...trip.photos].sort((a, b) => a.day - b.day).map((p) => p.id),
    removed: [],
    captions: {},
    notes: {},
    layouts: {},
    title: trip.name,
  };
}

type PageDef = {
  key: string;
  kind: "cover" | "day" | "map" | "closing";
  day?: number;
  photos?: Photo[];
};

function ScrapbookPage() {
  const { id } = Route.useParams();
  const { getTrip, updateTrip, today } = useApp();
  const trip = getTrip(id);
  const [pageIdx, setPageIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const released = trip ? isScrapbookReleased(trip, today) : false;

  useEffect(() => {
    if (trip && released && !trip.scrapbook)
      updateTrip(id, (t) => ({ ...t, scrapbook: assembleScrapbook(t) }));
  }, [released, trip?.scrapbook]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip)
    return (
      <Page>
        <PageHeader title="Trip not found" />
      </Page>
    );
  const city = getCity(trip.cityId);
  if (!released) {
    return (
      <Page>
        <PageHeader title="Digital Scrapbook" subtitle={trip.name} />
        <div className="paper rounded-[2rem] p-8 text-center shadow-lift">
          <BookLock className="mx-auto h-14 w-14 text-sea" />
          <p className="mt-4 font-display text-2xl font-semibold">
            Your scrapbook is being stitched together
          </p>
          <p className="mt-1 text-muted-foreground">
            It'll be ready on <b>{formatShort(scrapbookReleaseDate(trip))}</b>, exactly one day
            after your trip ends.
          </p>
        </div>
      </Page>
    );
  }
  const sb = trip.scrapbook ?? assembleScrapbook(trip);
  const theme = THEMES[sb.theme];
  const set = (patch: Partial<Scrapbook>) =>
    updateTrip(id, (t) => ({
      ...t,
      scrapbook: { ...(t.scrapbook ?? assembleScrapbook(t)), ...patch },
    }));
  const byId = Object.fromEntries(trip.photos.map((p) => [p.id, p]));
  const ordered = [
    ...sb.order.map((pid) => byId[pid]).filter((p): p is Photo => !!p),
    ...trip.photos.filter((p) => !sb.order.includes(p.id)),
  ].filter((p) => !sb.removed.includes(p.id));
  const cover = byId[sb.coverPhotoId ?? ""] ?? ordered[0];
  const pages: PageDef[] = [{ key: "cover", kind: "cover" }];
  trip.days.forEach((_, di) => {
    const ps = ordered.filter((p) => p.day === di);
    for (let i = 0; i < ps.length; i += 4)
      pages.push({ key: `day${di}-${i}`, kind: "day", day: di, photos: ps.slice(i, i + 4) });
  });
  pages.push({ key: "map", kind: "map" }, { key: "closing", kind: "closing" });
  const page = pages[Math.min(pageIdx, pages.length - 1)]!;
  const visited = trip.days
    .flatMap((d) => d.activities)
    .filter((a) => a.status === "done" && a.placeId)
    .map((a, i) => ({ place: getPlace(a.placeId)!, n: i + 1, status: "done" as const }))
    .filter((s) => s.place);

  const layoutOf = (pg: PageDef) =>
    sb.layouts?.[pg.key] ?? DEFAULT_LAYOUTS[pages.indexOf(pg) % DEFAULT_LAYOUTS.length]!;
  const movePhoto = (pid: string, dir: -1 | 1) => {
    const arr = ordered.map((p) => p.id);
    const i = arr.indexOf(pid);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    set({ order: arr });
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share)
        await navigator.share({ title: sb.title, text: `My ${city?.name} scrapbook`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
    } catch {
      /* user cancelled */
    }
  };

  const renderPage = (pg: PageDef) => (
    <div
      key={pg.key}
      className={cn(
        "print-page paper relative aspect-[3/4] w-full overflow-hidden rounded-[1.5rem] p-6 shadow-lift sm:aspect-[4/3]",
        theme.bg,
      )}
    >
      <span className="washi absolute -top-1 left-8 h-5 w-24 -rotate-3 rounded-sm" aria-hidden />
      {pg.kind === "cover" && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          {cover && (
            <figure className="polaroid w-1/2 max-w-56 -rotate-3">
              <img
                src={cover.src}
                alt="Cover"
                className="aspect-square w-full rounded-sm object-cover"
              />
            </figure>
          )}
          <p className={cn("mt-6 font-script text-2xl", theme.accent)}>a travel journal</p>
          <h2 className="text-4xl font-semibold leading-tight">{sb.title}</h2>
          <p className="mt-1 text-sm font-bold">
            {city?.name}, {city?.country} · {formatRange(trip.startDate, trip.endDate)}
          </p>
          <span className="absolute bottom-6 right-6 rotate-12 rounded-md border-2 border-dashed border-sea px-2 py-1 font-display text-xs font-bold text-sea">
            POSTCARD · {city?.country.toUpperCase()}
          </span>
        </div>
      )}
      {pg.kind === "day" && (
        <div className="flex h-full flex-col">
          <h3 className="text-2xl font-semibold">
            Day {(pg.day ?? 0) + 1}{" "}
            <span className={cn("font-script text-xl", theme.accent)}>
              {formatShort(trip.days[pg.day ?? 0]?.date ?? trip.startDate)}
            </span>
          </h3>
          <DayPhotos
            photos={pg.photos ?? []}
            layout={layoutOf(pg)}
            caption={(p) => sb.captions[p.id] ?? p.caption}
            by={trip.group ? (p) => p.by : undefined}
          />
          {sb.notes[pg.key] && <p className="mt-2 font-script text-xl">{sb.notes[pg.key]}</p>}
          {(() => {
            const Sticker = STICKERS[(pg.day ?? 0) % STICKERS.length]!;
            return (
              <span
                className="absolute bottom-4 right-5 flex h-10 w-10 rotate-12 items-center justify-center rounded-full bg-card/80 text-primary shadow-soft"
                aria-hidden
              >
                <Sticker className="h-5 w-5" />
              </span>
            );
          })()}
        </div>
      )}
      {pg.kind === "map" && (
        <div className="flex h-full flex-col">
          <h3 className="text-2xl font-semibold">Where we wandered</h3>
          <MapView className="mt-3 min-h-48 flex-1" stops={visited} interactive={false} />
          {sb.notes["map"] && <p className="mt-2 font-script text-xl">{sb.notes["map"]}</p>}
        </div>
      )}
      {pg.kind === "closing" && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className={cn("font-script text-3xl", theme.accent)}>until next time…</p>
          <h3 className="mt-2 text-3xl font-semibold">Trip highlights</h3>
          <ul className="mt-4 space-y-1 text-sm font-bold">
            <li className="flex items-center justify-center gap-1.5">
              <Camera className="h-4 w-4 text-primary" />
              {ordered.length} memories captured
            </li>
            <li className="flex items-center justify-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {visited.length} places visited
            </li>
            <li className="flex items-center justify-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              {trip.days.length} days in {city?.name}
            </li>
          </ul>
          <p className="mt-6 max-w-sm font-script text-2xl">
            {sb.notes["closing"] ?? "What an adventure."}
          </p>
          <div className="mt-6 flex gap-3 text-primary" aria-hidden>
            {STICKERS.slice(0, 4).map((Icon, i) => (
              <Icon
                key={i}
                className="h-7 w-7"
                style={{ transform: `rotate(${[-8, 6, -4, 10][i]}deg)` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Page wide>
      <div className="no-print">
        <PageHeader
          title="Digital Scrapbook"
          subtitle={`${city?.name} · ${ordered.length} photos`}
          action={
            <button
              onClick={() => setEditing(!editing)}
              className={pillButton({ variant: editing ? "dark" : "outline", size: "sm" })}
            >
              <Palette className="h-4 w-4" />
              {editing ? "Done" : "Customize"}
            </button>
          }
        />
      </div>
      <div className="no-print">{renderPage(page)}</div>
      <div className="hidden print:block">{pages.map(renderPage)}</div>
      <div className="no-print mt-4 flex items-center justify-between">
        <button
          aria-label="Previous page"
          disabled={pageIdx === 0}
          onClick={() => setPageIdx((i) => i - 1)}
          className={pillButton({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {pages.map((p, i) => (
            <button
              key={p.key}
              aria-label={`Page ${i + 1}`}
              onClick={() => setPageIdx(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === pageIdx ? "w-6 bg-primary" : "w-2 bg-border",
              )}
            />
          ))}
        </div>
        <button
          aria-label="Next page"
          disabled={pageIdx >= pages.length - 1}
          onClick={() => setPageIdx((i) => i + 1)}
          className={pillButton({ variant: "outline", size: "icon" })}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="no-print mt-4 flex gap-3">
        <button
          onClick={() => window.print()}
          className={pillButton({ variant: "outline", size: "lg", className: "flex-1" })}
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        <button
          onClick={() => void share()}
          className={pillButton({ size: "lg", className: "flex-1" })}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {editing && (
        <section className="no-print mt-6 space-y-5 rounded-3xl bg-card p-5 shadow-soft animate-in fade-in slide-in-from-bottom-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Scrapbook title</span>
            <input
              className={inputCls}
              value={sb.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <div>
            <p className="mb-2 text-sm font-bold">Theme</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(THEMES) as ScrapbookTheme[]).map((t) => (
                <Chip key={t} selected={sb.theme === t} onClick={() => set({ theme: t })}>
                  {THEMES[t].label}
                </Chip>
              ))}
            </div>
          </div>
          {page.kind === "day" && (
            <div>
              <p className="mb-2 text-sm font-bold">Layout for this page</p>
              <div className="flex flex-wrap gap-2">
                {LAYOUTS.map((l) => (
                  <Chip
                    key={l.k}
                    selected={layoutOf(page) === l.k}
                    onClick={() => set({ layouts: { ...(sb.layouts ?? {}), [page.key]: l.k } })}
                  >
                    {l.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Note on this page</span>
            <input
              className={inputCls}
              placeholder="Write something sweet…"
              value={sb.notes[page.key] ?? ""}
              onChange={(e) => set({ notes: { ...sb.notes, [page.key]: e.target.value } })}
            />
          </label>
          <div>
            <p className="mb-2 text-sm font-bold">Photos</p>
            <ul className="space-y-2">
              {ordered.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-secondary p-2">
                  <img src={p.src} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <input
                    aria-label="Caption"
                    className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm"
                    value={sb.captions[p.id] ?? p.caption}
                    onChange={(e) => set({ captions: { ...sb.captions, [p.id]: e.target.value } })}
                  />
                  <button
                    aria-label="Use as cover"
                    onClick={() => set({ coverPhotoId: p.id })}
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-extrabold",
                      sb.coverPhotoId === p.id ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    Cover
                  </button>
                  <button
                    aria-label="Move earlier"
                    onClick={() => movePhoto(p.id, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-card"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Move later"
                    onClick={() => movePhoto(p.id, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-card"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Remove from scrapbook"
                    onClick={() => set({ removed: [...sb.removed, p.id] })}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-sea"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            {sb.removed.length > 0 && (
              <button
                onClick={() => set({ removed: [] })}
                className="mt-2 text-xs font-bold text-primary-strong underline"
              >
                Restore {sb.removed.length} removed photo(s)
              </button>
            )}
          </div>
          <button
            onClick={() => {
              set({});
              toast.success("Scrapbook saved");
              setEditing(false);
            }}
            className={pillButton({ className: "w-full" })}
          >
            Save changes
          </button>
        </section>
      )}
      <div className="no-print mt-4">
        <EstimateNote>
          Download opens your browser's print dialog. Choose "Save as PDF" to keep a copy of every
          page.
        </EstimateNote>
      </div>
    </Page>
  );
}

const TILT = [-3, 2, 3, -2, 1.5, -1.5];

function Polaroid({
  p,
  caption,
  by,
  className,
  style,
}: {
  p: Photo;
  caption: string;
  by?: string | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <figure className={cn("polaroid", className)} style={style}>
      <img
        src={p.src}
        alt={getPlace(p.placeId)?.name ?? ""}
        className="aspect-square w-full rounded-sm object-cover"
      />
      <figcaption className="mt-1 text-center">
        <span className="block font-script text-base leading-tight sm:text-lg">{caption}</span>
        <span className="text-[9px] font-bold text-muted-foreground">
          {getPlace(p.placeId)?.name}
          {by ? ` · photo by ${by}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}

/** One page of photos in the chosen layout. */
function DayPhotos({
  photos,
  layout,
  caption,
  by,
}: {
  photos: Photo[];
  layout: PageLayout;
  caption: (p: Photo) => string;
  by?: ((p: Photo) => string | undefined) | undefined;
}) {
  if (layout === "collage") {
    const spots = [
      { l: "2%", t: "4%" },
      { l: "50%", t: "0%" },
      { l: "8%", t: "48%" },
      { l: "52%", t: "44%" },
    ];
    return (
      <div className="relative mt-3 flex-1">
        {photos.map((p, i) => (
          <Polaroid
            key={p.id}
            p={p}
            caption={caption(p)}
            by={by?.(p)}
            className="absolute w-[46%]"
            style={{
              left: spots[i]!.l,
              top: spots[i]!.t,
              transform: `rotate(${TILT[i]! * 2}deg)`,
              zIndex: i,
            }}
          />
        ))}
      </div>
    );
  }
  if (layout === "hero") {
    const [first, ...rest] = photos;
    return (
      <div className="mt-3 grid flex-1 grid-cols-3 gap-3">
        {first && (
          <Polaroid
            p={first}
            caption={caption(first)}
            by={by?.(first)}
            className="col-span-2 row-span-2 self-center"
            style={{ transform: "rotate(-2deg)" }}
          />
        )}
        {rest.map((p, i) => (
          <Polaroid
            key={p.id}
            p={p}
            caption={caption(p)}
            by={by?.(p)}
            className="self-center"
            style={{ transform: `rotate(${TILT[i + 1]}deg)` }}
          />
        ))}
      </div>
    );
  }
  if (layout === "strip") {
    return (
      <div className="mt-4 flex flex-1 items-center">
        <div
          className="flex w-full gap-2 rounded-lg bg-foreground p-2 [background-position:0_2px] [background-size:14px_100%] [background-repeat:repeat-x]"
          style={{
            backgroundImage: `radial-gradient(circle, ${palette.background} 2px, transparent 2.5px)`,
          }}
        >
          {photos.map((p) => (
            <figure key={p.id} className="flex-1 bg-foreground px-1 py-3">
              <img
                src={p.src}
                alt={getPlace(p.placeId)?.name ?? ""}
                className="aspect-[3/4] w-full rounded-sm object-cover"
              />
              <figcaption className="mt-1 truncate text-center font-script text-sm text-background">
                {caption(p) || getPlace(p.placeId)?.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 grid flex-1 grid-cols-2 gap-4">
      {photos.map((p, i) => (
        <Polaroid
          key={p.id}
          p={p}
          caption={caption(p)}
          by={by?.(p)}
          className="self-center"
          style={{ transform: `rotate(${TILT[i % 4]}deg)` }}
        />
      ))}
    </div>
  );
}
