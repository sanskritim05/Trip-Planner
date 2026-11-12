/**
 * Open-data place discovery backed by Wikipedia (free, keyless, CORS-enabled).
 *
 * For any city we combine a nearest-articles geosearch with a handful of themed
 * "nearcoord" searches, drop things that aren't visitable (stations, districts,
 * events, people…), classify the rest into app categories with sensible visit
 * durations / costs / hours, and use page views to tell crowd favourites from
 * hidden gems.
 */
import type { Category, City, Interest, Place } from "@/lib/types";
import { timeoutSignal } from "./http";

const API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

type WikiPage = {
  pageid: number;
  title: string;
  description?: string;
  extract?: string;
  coordinates?: { lat: number; lon: number }[];
  thumbnail?: { source: string };
  original?: { source: string };
  pageviews?: Record<string, number | null>;
  missing?: boolean;
};

/* Wikipedia asks API clients to be gentle: keep a few requests in flight and back off on 429. */
const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const waiting: (() => void)[] = [];
async function slot() {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise<void>((r) => waiting.push(r));
  inFlight++;
}
function release() {
  inFlight--;
  waiting.shift()?.();
}
// Browsers send their own User-Agent; Wikimedia asks apps to identify themselves via Api-User-Agent.
const UA_HEADERS: Record<string, string> =
  typeof window === "undefined"
    ? { "User-Agent": "Ans2Sans/1.0 (open-source trip planner)" }
    : { "Api-User-Agent": "Ans2Sans/1.0 (trip planner)" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type QueryResult = {
  query?: {
    pages?: WikiPage[];
    redirects?: { from: string; to: string }[];
    normalized?: { from: string; to: string }[];
  };
};

export async function wikiApi(
  params: Record<string, string>,
  signal?: AbortSignal,
  api = API,
): Promise<QueryResult> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  for (let attempt = 0; ; attempt++) {
    await slot();
    let res: Response;
    try {
      res = await fetch(`${api}?${qs}`, {
        headers: UA_HEADERS,
        signal: timeoutSignal(15_000, signal),
      });
    } finally {
      release();
    }
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      // Wikimedia may say how long to wait; otherwise back off exponentially.
      const after = Number(res.headers.get("retry-after"));
      await sleep(after > 0 ? Math.min(after, 10) * 1000 : 800 * 2 ** attempt);
      continue;
    }
    throw new Error(`Wikipedia ${res.status}`);
  }
}

const views = (p: WikiPage) =>
  Object.values(p.pageviews ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);

/* ---------------------------- classification ---------------------------- */

type Rule = {
  re: RegExp;
  category: Category;
  tags: Interest[];
  duration: number;
  cost: number;
  open: number;
  close: number;
  indoor: boolean;
};

const RULES: Rule[] = [
  {
    re: /\b(food market|market hall|public market|covered market|night market|bazaar|souk)\b/i,
    category: "Food",
    tags: ["Food", "Shopping"],
    duration: 75,
    cost: 15,
    open: 8,
    close: 20,
    indoor: true,
  },
  {
    re: /\b(restaurant|café|cafe|coffeehouse|bakery|patisserie|brasserie|bistro|tavern|pub|brewery|winery|tea ?house|confectioner|food hall|eatery|izakaya|trattoria)\b/i,
    category: "Food",
    tags: ["Food"],
    duration: 75,
    cost: 25,
    open: 9,
    close: 22,
    indoor: true,
  },
  {
    re: /\b(aquarium|zoo|theme park|amusement park|water park|planetarium)\b/i,
    category: "Entertainment",
    tags: ["Entertainment", "Nature"],
    duration: 180,
    cost: 30,
    open: 9,
    close: 18,
    indoor: false,
  },
  {
    re: /\b(museum|gallery|art cent(re|er)|exhibition|science cent(re|er)|kunsthalle)\b/i,
    category: "Museum",
    tags: ["Art", "History"],
    duration: 120,
    cost: 15,
    open: 10,
    close: 18,
    indoor: true,
  },
  {
    re: /\b(stadium|arena|theat(re|er)|opera|concert hall|bullring|music venue|casino|cinema|circus)\b/i,
    category: "Entertainment",
    tags: ["Entertainment", "Nightlife"],
    duration: 120,
    cost: 35,
    open: 10,
    close: 23,
    indoor: true,
  },
  {
    re: /\b(cathedral|basilica|church|temple|shrine|mosque|synagogue|monastery|abbey|chapel|pagoda|convent|minster|kirk)\b/i,
    category: "Landmark",
    tags: ["History", "Photography"],
    duration: 60,
    cost: 0,
    open: 9,
    close: 18,
    indoor: true,
  },
  {
    re: /\b(palace|castle|fortress|fort|citadel|château|chateau|palau|palazzo|alcázar|kremlin)\b/i,
    category: "Landmark",
    tags: ["History", "Photography"],
    duration: 100,
    cost: 15,
    open: 9,
    close: 18,
    indoor: true,
  },
  {
    re: /\b(beach|bay|cove|seafront|boardwalk|waterfront)\b/i,
    category: "Beach",
    tags: ["Beaches", "Nature"],
    duration: 150,
    cost: 0,
    open: 0,
    close: 24,
    indoor: false,
  },
  {
    re: /\b(national park|nature reserve|botanical|garden|park|forest|woods|hill|mountain|peak|lake|waterfall|falls|valley|gorge|canyon|lagoon|island|cliffs?|cave|volcano|glacier)\b/i,
    category: "Nature",
    tags: ["Nature", "Photography"],
    duration: 90,
    cost: 0,
    open: 7,
    close: 21,
    indoor: false,
  },
  {
    re: /\b(old town|historic (centre|center|quarter|district)|quarter|neighbou?rhood|medina|village within|centre of the old city)\b/i,
    category: "Neighborhood",
    tags: ["Photography", "Hidden gems"],
    duration: 90,
    cost: 0,
    open: 0,
    close: 24,
    indoor: false,
  },
  {
    re: /\b(shopping|mall|department store|bookshop|bookstore|arcade|boutique|major avenue|boulevard|rambla|promenade|shopping street|high street)\b/i,
    category: "Shopping",
    tags: ["Shopping", "Photography"],
    duration: 75,
    cost: 0,
    open: 10,
    close: 20,
    indoor: false,
  },
  {
    re: /\b(observation tower|observation deck|viewpoint|lookout|ferris wheel|skyscraper|tower)\b/i,
    category: "Landmark",
    tags: ["Photography"],
    duration: 60,
    cost: 18,
    open: 9,
    close: 22,
    indoor: false,
  },
  {
    re: /\b(bridge|monument|memorial|statue|fountain|arch|obelisk|lighthouse|square|plaza|piazza|plaça|platz|place|gate|walls|ruins|amphitheat(re|er)|aqueduct|cemetery)\b/i,
    category: "Landmark",
    tags: ["History", "Photography"],
    duration: 40,
    cost: 0,
    open: 0,
    close: 24,
    indoor: false,
  },
  {
    re: /\b(building by|house by|designed by|mansion|townhouse|historic house|residence|villa|modernis|art nouveau|landmark|architectur)/i,
    category: "Landmark",
    tags: ["Art", "History", "Photography"],
    duration: 60,
    cost: 12,
    open: 9,
    close: 19,
    indoor: true,
  },
];

const EXCLUDE = [
  /\b(station|metro|subway|railway|rail line|light rail|tram line|bus|airport|interchange|motorway|highway|expressway|line \d)\b/i,
  /\b(municipality|district of|borough|human settlement|commune in|city and|city in|town in|village in|capital of|county|province|prefecture|region of|state in|country in|ward of|electoral|constituency|parish in)\b/i,
  /\b(university|college|school|academy|institute|hospital|clinic|company|corporation|bank|headquarters|office building|embassy|consulate|prison|police|ministry|government building|parliament building|court)\b/i,
  /\b(bombing|battle|siege|attack|riot|protest|election|treaty|massacre|uprising|earthquake|disaster|fire of|war|strike|crash|murder|incident|festival \d{4})\b/i,
  /\b(footballer|politician|singer|actor|actress|writer|poet|composer|businessman|businesswoman|painter|architect|sculptor|footballer|cyclist|journalist|bishop|king|queen)\b/i,
  /\b(football club|sports club|basketball team|band|album|song|film|novel|newspaper|magazine|television|radio|record label|archdiocese|diocese|organization|organisation|association|federation|hotel|apartment|residential|street in|road in)\b/i,
  /\(\d{3,4}\s*[–-]\s*\d{3,4}\)/,
];

function classify(title: string, desc: string): Rule | null {
  const text = `${title}: ${desc}`;
  if (EXCLUDE.some((re) => re.test(desc))) {
    // A few exclusion words are fine when the title clearly names a sight.
    if (!/\b(old town|quarter|palace|castle|cathedral|museum|park|market)\b/i.test(title))
      return null;
  }
  return RULES.find((r) => r.re.test(text)) ?? null;
}

/* ------------------------------- images -------------------------------- */

const GRAD: Record<Category, [string, string]> = {
  Landmark: ["#fbcfe1", "#bfe3ee"],
  Museum: ["#e9d5ff", "#fbcfe1"],
  Food: ["#fed7aa", "#fbcfe1"],
  Nature: ["#bbf7d0", "#bfe3ee"],
  Shopping: ["#fbcfe1", "#fde68a"],
  Neighborhood: ["#fde68a", "#bfe3ee"],
  Beach: ["#bfe3ee", "#fde68a"],
  Adventure: ["#bfe3ee", "#bbf7d0"],
  Entertainment: ["#e9d5ff", "#bfe3ee"],
};

/** A soft gradient postcard, shown only while a real photo is being found or if none exists. */
export function placeholderImage(category: Category, label = "") {
  const [a, b] = GRAD[category] ?? GRAD.Landmark;
  const safe = label.replace(/[<>&"]/g, "").slice(0, 28);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='400' height='300' fill='url(#g)'/><circle cx='330' cy='60' r='38' fill='white' opacity='.45'/><path d='M0 235 Q 50 215 100 235 T 200 235 T 300 235 T 400 235 V300 H0Z' fill='white' opacity='.5'/><g transform='translate(200 128)'><path d='M0 52C-26 22-38 4-38-14a38 38 0 0 1 76 0c0 18-12 36-38 66Z' fill='white' opacity='.85'/><circle cy='-14' r='14' fill='${b}'/></g><text x='200' y='272' font-size='20' font-family='sans-serif' fill='#3b4a6b' text-anchor='middle'>${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ------------------------------ text bits ------------------------------ */

function sentences(text: string) {
  return text
    .replace(/\s*\([^)]*\)/g, "")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export function pickFunFact(extract: string | undefined): string | undefined {
  const ss = sentences(extract ?? "").slice(1);
  const juicy = ss.find((s) =>
    /\b(oldest|largest|tallest|first|only|longest|famous|record|biggest|smallest|highest|unesco|world heritage|\d{3,4})\b/i.test(
      s,
    ),
  );
  const pick = juicy ?? ss[0];
  if (!pick) return undefined;
  return pick.length < 260 ? pick : pick.slice(0, 257).replace(/\s\S*$/, "") + "…";
}

function blurb(desc: string | undefined, extract: string | undefined) {
  const first = sentences(extract ?? "")[0];
  if (first && first.length <= 170) return first;
  if (desc) return desc.charAt(0).toUpperCase() + desc.slice(1) + ".";
  return first ? first.slice(0, 167).replace(/\s\S*$/, "") + "…" : "A local favorite worth a look.";
}

/* ------------------------------ conversion ----------------------------- */

function toPlace(p: WikiPage, cityId: string, rule: Rule): Place | null {
  const c = p.coordinates?.[0];
  if (!c) return null;
  const pop = views(p);
  // Very popular paid sights tend to have pricier tickets.
  const cost = rule.cost > 0 && pop > 20000 ? Math.round(rule.cost * 1.8) : rule.cost;
  return {
    id: `w-${p.pageid}`,
    cityId,
    name: p.title
      .replace(/\s*\([^)]*\)$/, "")
      .replace(/, [A-Z][\w\s.'-]+$/, (m) => (m.length < 22 ? "" : m)),
    category: rule.category,
    description: blurb(p.description, p.extract),
    image: isPhoto(p.thumbnail?.source)
      ? p.thumbnail.source
      : placeholderImage(rule.category, p.title),
    lat: c.lat,
    lng: c.lon,
    cost,
    duration: rule.duration,
    open: rule.open,
    close: rule.close,
    tags: [...rule.tags],
    popularity: pop,
    indoor: rule.indoor,
    ...(pickFunFact(p.extract) ? { funFact: pickFunFact(p.extract)! } : {}),
    source: "wiki",
    wiki: p.title,
  };
}

const BASE_PROPS = {
  prop: "coordinates|pageimages|description|pageviews",
  piprop: "thumbnail",
  pithumbsize: "640",
  pvipdays: "30",
  colimit: "max",
  pilimit: "max",
};
const EXTRACT_PROPS = {
  prop: "extracts",
  exintro: "1",
  explaintext: "1",
  exsentences: "4",
  exlimit: "max",
};

function chunk<T>(xs: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Coordinates, photo, short description and popularity for many titles (50 per request). */
async function detailsForTitles(titles: string[], signal?: AbortSignal): Promise<WikiPage[]> {
  return (await detailsWithAliases(titles, signal)).pages;
}

/** Like detailsForTitles, plus a map from each requested title to the article it redirects to. */
async function detailsWithAliases(titles: string[], signal?: AbortSignal) {
  const res = await Promise.all(
    chunk(titles, 50).map((c) =>
      wikiApi(
        { action: "query", titles: c.join("|"), redirects: "1", ...BASE_PROPS },
        signal,
      ).catch((): QueryResult => ({ query: { pages: [] } })),
    ),
  );
  const alias = new Map<string, string>();
  for (const r of res)
    for (const x of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])])
      alias.set(x.from.toLowerCase(), x.to.toLowerCase());
  const pages = res.flatMap((r) => r.query?.pages ?? []).filter((p) => !p.missing);
  return { pages, alias };
}

/** Intro text for up to ~60 pages (extracts are limited to 20 pages per request). */
async function addExtracts(pages: WikiPage[], signal?: AbortSignal) {
  const byId = new Map(pages.map((p) => [p.pageid, p]));
  const res = await Promise.all(
    chunk(
      pages.map((p) => String(p.pageid)),
      20,
    ).map((c) =>
      wikiApi({ action: "query", pageids: c.join("|"), ...EXTRACT_PROPS }, signal).catch(() => ({
        query: { pages: [] },
      })),
    ),
  );
  for (const p of res.flatMap((r) => r.query?.pages ?? [])) {
    const target = byId.get(p.pageid);
    if (target && p.extract) target.extract = p.extract;
  }
}

const THEMES = [
  "museum OR gallery OR palace OR castle",
  "cathedral OR basilica OR temple OR shrine OR church",
  "park OR garden OR beach OR viewpoint OR lake",
  "market OR square OR tower OR bridge OR monument",
  "restaurant OR café OR bakery OR food market",
  "theatre OR stadium OR zoo OR aquarium OR old town",
];

/** Discover visitable places around a city. */
export async function discoverCityPlaces(
  city: Pick<City, "id" | "name" | "lat" | "lng">,
  signal?: AbortSignal,
): Promise<Place[]> {
  const coord = `${city.lat}|${city.lng}`;
  const near = wikiApi(
    { action: "query", list: "geosearch", gscoord: coord, gsradius: "10000", gslimit: "100" },
    signal,
  )
    .then((r) =>
      (
        (r as unknown as { query?: { geosearch?: { title: string }[] } }).query?.geosearch ?? []
      ).map((g) => g.title),
    )
    .catch(() => [] as string[]);
  const themed = THEMES.map((t) =>
    wikiApi(
      {
        action: "query",
        list: "search",
        srsearch: `nearcoord:14km,${city.lat},${city.lng} ${t}`,
        srlimit: "20",
        srprop: "",
      },
      signal,
    )
      .then((r) =>
        ((r as unknown as { query?: { search?: { title: string }[] } }).query?.search ?? []).map(
          (g) => g.title,
        ),
      )
      .catch(() => [] as string[]),
  );
  const titles = [...new Set((await Promise.all([near, ...themed])).flat())].filter(
    (t) => t !== city.name,
  );
  const pages = await detailsForTitles(titles, signal);
  return rankAndConvert(pages, city, false, signal);
}

async function rankAndConvert(
  pages: WikiPage[],
  city: Pick<City, "id" | "name">,
  loose = false,
  signal?: AbortSignal,
): Promise<Place[]> {
  const cityName = city.name.split(",")[0]!.toLowerCase();
  const candidates: { p: WikiPage; rule: Rule }[] = [];
  const seen = new Set<number>();
  for (const p of pages) {
    if (
      p.title.toLowerCase() === cityName ||
      /^(list|lists|outline|history|timeline|geography|culture|economy) of\b/i.test(p.title) ||
      seen.has(p.pageid)
    )
      continue;
    const rule =
      classify(p.title, p.description ?? "") ??
      (loose ? (RULES.find((r) => r.category === "Landmark" && r.duration === 60) ?? null) : null);
    if (!rule || !p.coordinates?.[0]) continue;
    seen.add(p.pageid);
    candidates.push({ p, rule });
  }
  candidates.sort((a, b) => views(b.p) - views(a.p));
  const top = loose ? candidates.slice(0, 20) : candidates.slice(0, 48);
  await addExtracts(
    top.map((c) => c.p),
    signal,
  );
  const kept = top.map(({ p, rule }) => toPlace(p, city.id, rule)).filter((x): x is Place => !!x);
  // The quietest quarter of the list are the hidden gems.
  const cut = kept[Math.floor(kept.length * 0.7)]?.popularity ?? 0;
  for (const p of kept) {
    if ((p.popularity ?? 0) <= cut && !p.tags.includes("Hidden gems")) p.tags.push("Hidden gems");
  }
  return kept;
}

/** Free-text search for places near a city (attractions, restaurants, landmarks, activities). */
export async function searchCityPlaces(
  city: Pick<City, "id" | "name" | "lat" | "lng">,
  query: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const r = await wikiApi(
    {
      action: "query",
      list: "search",
      srsearch: `nearcoord:25km,${city.lat},${city.lng} ${query}`,
      srlimit: "20",
      srprop: "",
    },
    signal,
  );
  const titles = (
    (r as unknown as { query?: { search?: { title: string }[] } }).query?.search ?? []
  ).map((g) => g.title);
  if (!titles.length) return [];
  return rankAndConvert(await detailsForTitles(titles, signal), city, true, signal);
}

/** Look up exact Wikipedia titles (used to ground AI suggestions with real coordinates & photos). */
export async function resolveTitles(titles: string[], signal?: AbortSignal) {
  const { pages, alias } = await detailsWithAliases(titles.filter(Boolean), signal);
  const byTitle = new Map<string, WikiPage>();
  for (const p of pages) byTitle.set(p.title.toLowerCase(), p);
  const find = (t: string) => {
    let key = t.toLowerCase();
    // Follow normalization, then redirect (e.g. "maui" -> "Maui" -> "Maui (island)").
    for (let i = 0; i < 3 && !byTitle.has(key) && alias.has(key); i++) key = alias.get(key)!;
    return byTitle.get(key);
  };
  return {
    get(title: string) {
      const p = find(title);
      if (!p) return null;
      return {
        title: p.title,
        pageid: p.pageid,
        lat: p.coordinates?.[0]?.lat,
        lng: p.coordinates?.[0]?.lon,
        image: isPhoto(p.thumbnail?.source) ? p.thumbnail.source : undefined,
        description: p.description,
        extract: p.extract,
        popularity: views(p),
      };
    },
  };
}

/** City summary: photo, intro and popularity. */
export async function citySummary(title: string, signal?: AbortSignal) {
  const r = await wikiApi(
    {
      action: "query",
      titles: title,
      redirects: "1",
      prop: "pageimages|extracts|description",
      piprop: "thumbnail",
      pithumbsize: "1280",
      exintro: "1",
      explaintext: "1",
      exsentences: "3",
    },
    signal,
  );
  const p = r.query?.pages?.[0];
  if (!p || p.missing) return null;
  return {
    image: isPhoto(p.thumbnail?.source) ? p.thumbnail.source : undefined,
    extract: p.extract,
    description: p.description,
  };
}

/* -------------------------------- photos -------------------------------- */

const PHOTO_WIDTH = "640";
/** A real photo, not a map, flag, logo or diagram (those are SVGs rendered to PNG). */
export const isPhoto = (url: string | undefined): url is string =>
  !!url && !/\.svg/i.test(url) && /\.(jpe?g|png|webp)(\/|$|\?)/i.test(url);
const STOP = new Set([
  "the",
  "and",
  "dos",
  "das",
  "del",
  "des",
  "der",
  "von",
  "van",
  "les",
  "los",
  "las",
]);
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Does a search hit name the same thing? `strict` requires every main word of the
 * name (used when we can't confirm the location); otherwise two shared words do.
 */
function sameThing(name: string, hit: string, strict: boolean) {
  const want = words(name);
  const got = new Set(words(hit));
  if (!want.length) return false;
  const shared = want.filter((w) => got.has(w)).length;
  return strict ? shared === want.length : shared >= Math.min(2, want.length);
}

/** Words too common to identify a place on their own. */
const GENERIC = new Set(
  "sao san santo santa saint fort forte church igreja museum museu park parque garden jardim square praca plaza street rua tower torre house casa palace palacio cathedral bridge ponte market mercado city old new national hotel restaurant cafe bar beach praia island lake river mount".split(
    " ",
  ),
);
const distinctive = (s: string) => words(s).filter((w) => !GENERIC.has(w));

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** Accept a hit if it's near the place we're looking for and names it. */
function plausible(q: PhotoQuery, title: string, at?: { lat: number; lon: number }) {
  if (q.lat != null && q.lng != null && at) {
    const limit = Math.max(2, ((q.radius ?? 400) / 1000) * 4);
    return (
      km({ lat: q.lat, lng: q.lng }, { lat: at.lat, lng: at.lon }) <= limit &&
      sameThing(q.name, title, false)
    );
  }
  // No location to check: the name must match fully, and the hit must either be
  // exactly that name or mention the city/country (so "Seymour Island, Antarctica"
  // never shows Seymour Island in the Galapagos).
  if (!sameThing(q.name, title, true)) return false;
  const exact =
    words(title.replace(/^File:/, "").replace(/\.\w+$/, "")).join(" ") === words(q.name).join(" ");
  const ctx = distinctive(q.context ?? "");
  const got = new Set(words(title));
  return exact || (ctx.length > 0 && ctx.some((w) => got.has(w)));
}

type CommonsPage = {
  title: string;
  index?: number;
  coordinates?: { lat: number; lon: number }[];
  imageinfo?: { thumburl?: string; mime?: string }[];
};

function commonsThumb(pages: CommonsPage[] | undefined, title?: string) {
  const list = (pages ?? []).filter((p) => p.imageinfo?.[0]?.mime === "image/jpeg");
  const best = title ? list.find((p) => p.title === title) : list[0];
  return best?.imageinfo?.[0]?.thumburl;
}

/** Best-matching Wikipedia article photo from a text search. */
async function wikipediaSearchPhoto(q: PhotoQuery, signal?: AbortSignal) {
  const r = await wikiApi(
    {
      action: "query",
      generator: "search",
      gsrsearch: `${q.name} ${q.context ?? ""}`.trim(),
      gsrlimit: "5",
      prop: "pageimages|coordinates",
      piprop: "thumbnail",
      pithumbsize: PHOTO_WIDTH,
    },
    signal,
  );
  const pages = (r.query?.pages ?? []) as (WikiPage & { index?: number })[];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.find(
    (p) => isPhoto(p.thumbnail?.source) && plausible(q, p.title, p.coordinates?.[0]),
  )?.thumbnail?.source;
}

/** A photo on Wikimedia Commons whose file name matches. */
async function commonsSearchPhoto(q: PhotoQuery, signal?: AbortSignal) {
  const r = (await wikiApi(
    {
      action: "query",
      generator: "search",
      gsrsearch: `${q.name} ${q.context ?? ""} filetype:bitmap`.trim(),
      gsrnamespace: "6",
      gsrlimit: "8",
      prop: "imageinfo|coordinates",
      iiprop: "url|mime",
      iiurlwidth: PHOTO_WIDTH,
    },
    signal,
    COMMONS_API,
  )) as { query?: { pages?: CommonsPage[] } };
  const pages = (r.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return commonsThumb(pages.filter((p) => plausible(q, p.title, p.coordinates?.[0])));
}

/** The closest geotagged photo on Wikimedia Commons. */
async function commonsNearbyPhoto(
  name: string,
  lat: number,
  lng: number,
  radius: number,
  signal?: AbortSignal,
) {
  const near = (await wikiApi(
    {
      action: "query",
      list: "geosearch",
      gscoord: `${lat}|${lng}`,
      gsradius: String(radius),
      gsnamespace: "6",
      gslimit: "10",
    },
    signal,
    COMMONS_API,
  )) as { query?: { geosearch?: { title: string }[] } };
  // A nearby file only counts if its name mentions the place (not just "fort" or "são").
  const key = new Set(distinctive(name));
  const titles = (near.query?.geosearch ?? [])
    .map((g) => g.title)
    .filter((t) => /\.jpe?g$/i.test(t) && words(t).some((w) => key.has(w)));
  if (!titles.length) return undefined;
  const info = (await wikiApi(
    {
      action: "query",
      titles: titles.join("|"),
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: PHOTO_WIDTH,
    },
    signal,
    COMMONS_API,
  )) as { query?: { pages?: CommonsPage[] } };
  // Keep geosearch order: nearest first.
  for (const t of titles) {
    const url = commonsThumb(info.query?.pages, t);
    if (url) return url;
  }
  return undefined;
}

export type PhotoQuery = {
  name: string;
  /** Extra words that disambiguate the search, e.g. the city or country. */
  context?: string;
  lat?: number;
  lng?: number;
  /** Search radius in meters for geotagged photos (larger for whole towns). */
  radius?: number;
};

/**
 * Find a real photo for something: a Wikipedia search, then Wikimedia Commons by
 * name, then the nearest geotagged Commons photo. Undefined if nothing turns up.
 */
export async function findPhoto(q: PhotoQuery, signal?: AbortSignal): Promise<string | undefined> {
  const steps: (() => Promise<string | undefined>)[] = [
    () => wikipediaSearchPhoto(q, signal),
    () => commonsSearchPhoto(q, signal),
  ];
  if (q.lat != null && q.lng != null)
    steps.push(() => commonsNearbyPhoto(q.name, q.lat!, q.lng!, q.radius ?? 400, signal));
  for (const step of steps) {
    const url = await step().catch(() => undefined);
    if (url) return url;
  }
  return undefined;
}

export const isPlaceholderImage = (src: string | undefined) => !src || src.startsWith("data:");

/**
 * Swap placeholders for real photos where one can be found. `context` is the
 * place's city or country. Returns every place, changed or not.
 */
export async function fillPhotos(
  places: Place[],
  context: (p: Place) => string,
  signal?: AbortSignal,
): Promise<Place[]> {
  // One at a time: photo lookups are a nice-to-have and shouldn't crowd out other requests.
  const out: Place[] = [];
  for (const p of places) {
    if (!isPlaceholderImage(p.image) || signal?.aborted) {
      out.push(p);
      continue;
    }
    const url = await findPhoto(
      { name: p.name, context: context(p), lat: p.lat, lng: p.lng, radius: 300 },
      signal,
    ).catch(() => undefined);
    out.push(url ? { ...p, image: url } : p);
  }
  return out;
}
