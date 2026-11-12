export type Interest =
  | "Nature"
  | "Food"
  | "Shopping"
  | "History"
  | "Art"
  | "Adventure"
  | "Beaches"
  | "Nightlife"
  | "Photography"
  | "Hidden gems"
  | "Filming locations"
  | "Entertainment";

export const INTERESTS: Interest[] = [
  "Nature",
  "Food",
  "Shopping",
  "History",
  "Art",
  "Adventure",
  "Beaches",
  "Nightlife",
  "Photography",
  "Entertainment",
  "Hidden gems",
  "Filming locations",
];

export type Category =
  | "Landmark"
  | "Museum"
  | "Food"
  | "Nature"
  | "Shopping"
  | "Neighborhood"
  | "Beach"
  | "Adventure"
  | "Entertainment";
export const INDOOR_CATEGORIES: Category[] = ["Museum", "Food", "Shopping", "Entertainment"];
export type Accommodation = "hostel" | "hotel" | "airbnb" | "resort";
export type Mode = "walk" | "transit" | "drive";
export type Pace = "relaxed" | "balanced" | "packed";
export type BudgetStyle = "budget" | "moderate" | "luxury";

export type Season = {
  label: string;
  months: string;
  startMonth: number; // 0-11
  weather: string;
  temp: string;
  cost: 1 | 2 | 3;
  crowd: 1 | 2 | 3;
  highlight: string;
  why: string;
  recommended?: boolean;
};

export type City = {
  id: string;
  name: string;
  country: string;
  region: string;
  image: string;
  blurb: string;
  overview: string;
  tags: Interest[];
  lat: number;
  lng: number;
  timezone: string;
  idealDays: string;
  dailyCost: Record<BudgetStyle, number>; // USD per person per day, estimate
  seasons: Season[];
  /** Built on demand from open data. */
  source?: "live";
};

export type Place = {
  id: string;
  cityId: string;
  name: string;
  category: Category;
  description: string;
  image: string;
  lat: number;
  lng: number;
  cost: number; // USD estimate per person
  duration: number; // minutes
  open: number; // hour 0-24
  close: number;
  tags: Interest[];
  address?: string;
  film?: { title: string; kind: "Movie" | "TV"; scene: string };
  funFact?: string;
  /** Relative popularity (e.g. monthly page views). Low values mark hidden gems. */
  popularity?: number;
  indoor?: boolean;
  /** Dietary options a restaurant is known to cater for. */
  diet?: string[];
  source?: "wiki" | "ai";
  wiki?: string;
};

export type TripPlace = {
  placeId: string;
  source: "must" | "swipe" | "bucket" | "group";
  priority: boolean;
};

export type Activity = {
  id: string;
  kind: "place" | "meal";
  placeId: string | null;
  label?: string;
  start: number; // minutes from midnight
  duration: number;
  travelMin: number; // travel time from previous stop
  status: "pending" | "done" | "skipped";
  conflict?: string | null;
};

export type Day = { date: string; activities: Activity[] };

export type Photo = {
  id: string;
  activityId: string;
  placeId: string;
  day: number; // 0-based trip day
  src: string;
  caption: string;
  createdAt: string;
  by?: string;
};

export type ExpenseCategory =
  "Accommodation" | "Food" | "Transportation" | "Attractions" | "Shopping" | "Other";
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Accommodation",
  "Food",
  "Transportation",
  "Attractions",
  "Shopping",
  "Other",
];
export type Expense = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note: string;
};

export type ScrapbookTheme = "blush" | "sea" | "sand";
export type PageLayout = "grid" | "collage" | "hero" | "strip";
export type Scrapbook = {
  theme: ScrapbookTheme;
  coverPhotoId: string | null;
  order: string[]; // photo ids in custom order
  removed: string[];
  captions: Record<string, string>;
  notes: Record<string, string>; // page key -> text
  layouts: Record<string, PageLayout>; // page key -> layout
  title: string;
};

export type GroupMember = {
  id: string;
  name: string;
  role: "organizer" | "member";
  color: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";
};
export type Suggestion = {
  placeId: string;
  by: string;
  votes: Record<string, "yes" | "no">;
  place?: Place;
};
export type Group = {
  members: GroupMember[];
  inviteCode: string;
  suggestions: Suggestion[];
  finalized: boolean;
  /** Set once the trip is shared on the server; members sync through it. */
  shared?: boolean;
  version?: number;
};

export type Trip = {
  id: string;
  cityId: string;
  name: string;
  startDate: string;
  endDate: string;
  flexible: boolean;
  budget: number;
  currency: string;
  budgetStyle: BudgetStyle;
  budgetSplit: Record<"Accommodation" | "Food" | "Transportation" | "Attractions", number>;
  accommodation: Accommodation;
  /** Months (0-11) the traveler can't go, used by Best Time to Travel. */
  unavailableMonths: number[];
  travelers: number;
  travelerType: "solo" | "couple" | "family" | "friends";
  interests: Interest[];
  pace: Pace;
  walking: "low" | "medium" | "high";
  transport: Mode;
  dietary: string[];
  startHour: number;
  status: "draft" | "planned";
  step: number; // wizard / planning step for drafts
  places: TripPlace[];
  passed: string[]; // swiped left
  days: Day[];
  unscheduled: { placeId: string; reason: string }[];
  photos: Photo[];
  expenses: Expense[];
  scrapbook: Scrapbook | null;
  group: Group | null;
  confirmed: boolean;
  updatedAt: string;
};

export type BucketItem = {
  id: string;
  kind: "destination" | "attraction" | "restaurant";
  refId: string; // city id or place id
  savedAt: string;
  visited: boolean;
  note: string;
};

export type Prefs = {
  activities: Interest[];
  style: string[];
  budget: BudgetStyle;
  dietary: string[];
  transport: Mode[];
  destinations: string[];
  pace: Pace;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: "reminder" | "planning" | "memories";
  link?: string;
};

export type AppState = {
  version: 3;
  user: { id: string; name: string; email: string; avatar: string | null } | null;
  onboarded: boolean;
  prefs: Prefs;
  trips: Trip[];
  bucket: BucketItem[];
  /** Places & cities discovered at runtime (search, open data, AI), keyed by id. */
  places: Record<string, Place>;
  cities: Record<string, City>;
  /** Learned taste: tag/category -> weight, nudged by swipes, saves, visits and skips. */
  taste: Record<string, number>;
  notifications: AppNotification[];
  settings: {
    notifReminders: boolean;
    notifPlanning: boolean;
    notifMemories: boolean;
    privateProfile: boolean;
    shareLocation: boolean;
  };
};
