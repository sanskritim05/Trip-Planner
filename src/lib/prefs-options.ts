/** Shared, icon-labelled options for every preference picker (onboarding, wizard, profile). */
import {
  Backpack,
  BedDouble,
  Bike,
  Building2,
  Bus,
  Camera,
  Car,
  Castle,
  ChefHat,
  Clapperboard,
  Coffee,
  Compass,
  Crown,
  Feather,
  Fish,
  Footprints,
  Gauge,
  Gem,
  Heart,
  Hotel,
  House,
  Landmark,
  Leaf,
  MilkOff,
  Moon,
  Mountain,
  Palette,
  PartyPopper,
  Rocket,
  Salad,
  ShoppingBag,
  Snail,
  Sparkles,
  Sun,
  Sunrise,
  Tent,
  Ticket,
  TrainFront,
  TreePalm,
  Trees,
  User,
  Users,
  UtensilsCrossed,
  Vegan,
  Wallet,
  Waves,
  Wheat,
  Zap,
} from "lucide-react";
import type { Choice, Stop } from "@/components/app/pickers";
import type { Accommodation, BudgetStyle, Interest, Mode, Pace, Prefs, Trip } from "./types";

export const INTEREST_CHOICES: Choice<Interest>[] = [
  { value: "Nature", label: "Nature", desc: "Parks, hikes, views", icon: Trees },
  { value: "Food", label: "Food", desc: "Markets & local eats", icon: UtensilsCrossed },
  { value: "History", label: "History", desc: "Ruins & old towns", icon: Landmark },
  { value: "Art", label: "Art", desc: "Museums & galleries", icon: Palette },
  { value: "Beaches", label: "Beaches", desc: "Sand, sun, swims", icon: Waves },
  { value: "Shopping", label: "Shopping", desc: "Boutiques & markets", icon: ShoppingBag },
  { value: "Adventure", label: "Adventure", desc: "Get the heart racing", icon: Mountain },
  { value: "Nightlife", label: "Nightlife", desc: "Bars & late nights", icon: Moon },
  { value: "Photography", label: "Photography", desc: "Picture-perfect spots", icon: Camera },
  { value: "Entertainment", label: "Entertainment", desc: "Shows, games, fun", icon: Ticket },
  { value: "Hidden gems", label: "Hidden gems", desc: "Where locals go", icon: Gem },
  {
    value: "Filming locations",
    label: "Movie spots",
    desc: "Scenes from the screen",
    icon: Clapperboard,
  },
];

export const STYLE_CHOICES: Choice<string>[] = [
  { value: "Slow & cozy", label: "Slow & cozy", desc: "Long lunches, no rush", icon: Coffee },
  { value: "Adventurous", label: "Adventurous", desc: "Say yes to everything", icon: Compass },
  { value: "Luxury escape", label: "Luxury escape", desc: "Treat yourself", icon: Crown },
  { value: "Backpacker", label: "Backpacker", desc: "More trip, less spend", icon: Backpack },
  { value: "Foodie trips", label: "Foodie", desc: "Plan around meals", icon: ChefHat },
  { value: "Culture deep-dive", label: "Culture buff", desc: "Learn the stories", icon: Landmark },
];

export const DIET_CHOICES: Choice<string>[] = [
  { value: "No restrictions", label: "Anything goes", icon: UtensilsCrossed },
  { value: "Vegetarian", label: "Vegetarian", icon: Salad },
  { value: "Vegan", label: "Vegan", icon: Vegan },
  { value: "Gluten-free", label: "Gluten-free", icon: Wheat },
  { value: "Dairy-free", label: "Dairy-free", icon: MilkOff },
  { value: "Halal", label: "Halal", icon: Leaf },
  { value: "Kosher", label: "Kosher", icon: Fish },
];

export const TRANSPORT_CHOICES: Choice<Mode>[] = [
  { value: "walk", label: "Walking", desc: "See it all on foot", icon: Footprints },
  { value: "transit", label: "Public transit", desc: "Trains, trams, buses", icon: TrainFront },
  { value: "drive", label: "Car or taxi", desc: "Door to door", icon: Car },
];

export const DESTINATION_CHOICES: Choice<string>[] = [
  { value: "Cities", label: "Cities", icon: Building2 },
  { value: "Beaches", label: "Beaches", icon: TreePalm },
  { value: "Mountains", label: "Mountains", icon: Mountain },
  { value: "Countryside", label: "Countryside", icon: Trees },
  { value: "Islands", label: "Islands", icon: Sun },
  { value: "Historic towns", label: "Historic towns", icon: Castle },
];

export const BUDGET_STOPS: Stop<BudgetStyle>[] = [
  { value: "budget", label: "Budget", desc: "Hostels, street food, free sights", icon: Wallet },
  { value: "moderate", label: "Moderate", desc: "Comfy stays and a few splurges", icon: Sparkles },
  { value: "luxury", label: "Luxury", desc: "Five stars and tasting menus", icon: Gem },
];

export const PACE_STOPS: Stop<Pace>[] = [
  {
    value: "relaxed",
    label: "Relaxed",
    desc: "A couple of stops a day, lots of lingering",
    icon: Snail,
  },
  { value: "balanced", label: "Balanced", desc: "A good mix of seeing and resting", icon: Gauge },
  { value: "packed", label: "Packed", desc: "See everything, sleep on the plane", icon: Rocket },
];

export const WALKING_STOPS: Stop<Trip["walking"]>[] = [
  { value: "low", label: "A little", desc: "Short strolls between stops", icon: Feather },
  { value: "medium", label: "Some", desc: "Happy to walk 20–30 minutes", icon: Footprints },
  { value: "high", label: "All day", desc: "Comfy shoes, no limits", icon: Zap },
];

export const TRAVELER_CHOICES: Choice<Trip["travelerType"]>[] = [
  { value: "solo", label: "Solo", desc: "Just me", icon: User },
  { value: "couple", label: "Couple", desc: "The two of us", icon: Heart },
  { value: "family", label: "Family", desc: "Kids in tow", icon: House },
  { value: "friends", label: "Friends", desc: "The whole crew", icon: Users },
];

export const STAY_CHOICES: Choice<Accommodation>[] = [
  { value: "hostel", label: "Hostel", desc: "Social & cheap", icon: Tent },
  { value: "airbnb", label: "Rental", desc: "A home away", icon: House },
  { value: "hotel", label: "Hotel", desc: "Easy & comfy", icon: Hotel },
  { value: "resort", label: "Resort", desc: "Pools & pampering", icon: BedDouble },
];

export const START_STOPS: Stop<string>[] = [
  { value: "7", label: "7 AM", desc: "Early bird: beat every crowd", icon: Sunrise },
  { value: "8", label: "8 AM", desc: "Up and out with the locals", icon: Sunrise },
  { value: "9", label: "9 AM", desc: "A civilized start", icon: Coffee },
  { value: "10", label: "10 AM", desc: "Breakfast first, always", icon: Coffee },
  { value: "11", label: "11 AM", desc: "Vacation means sleeping in", icon: BedDouble },
];

export const MODE_ICON = { walk: Footprints, transit: Bus, drive: Car, bike: Bike } as const;

/** Choosing "Anything goes" clears specific diets, and vice versa. */
export function toggleDiet(next: string[], prev: string[]) {
  const added = next.find((d) => !prev.includes(d));
  if (added === "No restrictions") return ["No restrictions"];
  return next.filter((d) => d !== "No restrictions");
}

/** A playful "travel personality" summarising someone's preferences. */
export function travelPersona(p: Pick<Prefs, "activities" | "style" | "budget" | "pace">) {
  const has = (i: Interest) => p.activities.includes(i);
  const style = (s: string) => p.style.includes(s);
  const pick = (() => {
    if (has("Food") && (style("Foodie trips") || p.activities.length <= 3))
      return {
        title: "The Flavor Chaser",
        icon: ChefHat,
        blurb: "You plan days around your next meal, and honestly, that's the right way to travel.",
      };
    if (has("Beaches") && p.pace === "relaxed")
      return {
        title: "The Golden-Hour Drifter",
        icon: Waves,
        blurb: "Salt in your hair, nowhere to be. Sunsets are your schedule.",
      };
    if (has("Adventure") || style("Adventurous"))
      return {
        title: "The Trailblazer",
        icon: Mountain,
        blurb: "If there's a summit, a cliff path or a sunrise hike, you're already lacing up.",
      };
    if (has("History") || has("Art") || style("Culture deep-dive"))
      return {
        title: "The Story Collector",
        icon: Landmark,
        blurb: "Every old street has a secret, and you want to hear all of them.",
      };
    if (has("Hidden gems") || has("Photography"))
      return {
        title: "The Gem Hunter",
        icon: Gem,
        blurb:
          "Skip the queue, find the quiet courtyard. Your photos look like postcards nobody else has.",
      };
    if (has("Nightlife") || has("Entertainment"))
      return {
        title: "The Night Owl",
        icon: Moon,
        blurb: "The city really wakes up after dark, and so do you.",
      };
    if (p.budget === "luxury" || style("Luxury escape"))
      return {
        title: "The Soft-Life Voyager",
        icon: Crown,
        blurb: "Fluffy robes, rooftop views, zero stress. You've earned it.",
      };
    if (style("Backpacker") || p.budget === "budget")
      return {
        title: "The Thrifty Explorer",
        icon: Backpack,
        blurb: "Maximum memories, minimum spend. You know every free museum day.",
      };
    return {
      title: "The Happy Wanderer",
      icon: PartyPopper,
      blurb: "A little of everything, and a lot of fun. You're up for whatever the trip brings.",
    };
  })();
  const pace = PACE_STOPS.find((s) => s.value === p.pace)?.label ?? "Balanced";
  const budget = BUDGET_STOPS.find((s) => s.value === p.budget)?.label ?? "Moderate";
  return { ...pick, traits: [pace, budget, ...p.activities.slice(0, 3)] };
}
