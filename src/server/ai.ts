/**
 * Optional AI layer (server only), powered by Groq. Enabled when GROQ_API_KEY
 * is set; every feature has an open-data fallback on the client, so the app
 * works without it.
 *
 * Uses Groq's OpenAI-compatible Chat Completions API with strict JSON-schema
 * structured outputs (constrained decoding). Default model: openai/gpt-oss-120b,
 * a production model with strict-schema support. Override with GROQ_MODEL
 * (must be a model that supports strict structured outputs).
 *
 * Suggestions always name a Wikipedia article so the client can ground them with
 * real coordinates and photos instead of trusting model-generated positions.
 */
import { z } from "zod/v4";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const AI_MODEL = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";

export function aiEnabled() {
  return !!process.env["GROQ_API_KEY"];
}

const INSTRUCTIONS =
  "You are the travel brain of Ans2Sans, a playful trip planner. Be accurate: only name real, currently operating places. " +
  "Prices are typical per-person USD amounts for visitors; hours are typical local opening hours in 24h integers (use 0 and 24 for always open). " +
  "Wikipedia titles must be exact English Wikipedia article titles, or an empty string if no article exists. " +
  "Write in a warm, plain style and never use em dashes.";

/** JSON Schema for Groq strict mode: every property required, no extra properties. */
export function toGroqSchema(schema: z.ZodType) {
  const { $schema: _drop, ...json } = z.toJSONSchema(schema, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  return json;
}

type GroqResponse = {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
};

/** The model's JSON text, or null when the answer was cut off or refused. */
export function responseText(data: GroqResponse): string | null {
  const choice = data.choices?.[0];
  if (!choice || choice.finish_reason === "length" || choice.message?.refusal) return null;
  return choice.message?.content ?? null;
}

const MAX_ATTEMPTS = 3;

/**
 * Keep whatever is valid: if a list contains one malformed item, drop that item
 * instead of discarding the whole answer.
 */
export function salvage<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> | null {
  const full = schema.safeParse(raw);
  if (full.success) return full.data;
  if (!(schema instanceof z.ZodObject) || !raw || typeof raw !== "object") return null;
  const shape = schema.shape as Record<string, z.ZodType>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(shape)) {
    const value = (raw as Record<string, unknown>)[key];
    if (field instanceof z.ZodArray && Array.isArray(value)) {
      out[key] = value.flatMap((item) => {
        const r = (field.element as z.ZodType).safeParse(item);
        return r.success ? [r.data] : [];
      });
    } else {
      const r = field.safeParse(value);
      if (!r.success) return null;
      out[key] = r.data;
    }
  }
  return out as z.infer<T>;
}

async function ask<T extends z.ZodType>(
  schema: T,
  name: string,
  prompt: string,
): Promise<z.infer<T> | null> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["GROQ_API_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        // Groq recommends keeping all instructions in the user turn for reasoning models.
        messages: [{ role: "user", content: `${INSTRUCTIONS}\n\n${prompt}` }],
        // Quick lookup tasks: low reasoning effort keeps answers fast and cheap.
        reasoning_effort: "low",
        max_completion_tokens: 16000,
        response_format: {
          type: "json_schema",
          json_schema: { name, schema: toGroqSchema(schema), strict: true },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.ok) {
      const text = responseText((await res.json()) as GroqResponse);
      return text ? salvage(schema, JSON.parse(text)) : null;
    }
    const body = await res.text().catch(() => "");
    const last = attempt >= MAX_ATTEMPTS;
    if (res.status === 429 && !last) {
      // Free-tier token limits reset within a minute; Groq says exactly how long to wait.
      const wait = Number(/try again in ([\d.]+)s/.exec(body)?.[1] ?? "5");
      if (wait <= 35) {
        await new Promise((r) => setTimeout(r, (wait + 0.5) * 1000));
        continue;
      }
    }
    if (res.status === 400 && body.includes("json_validate_failed")) {
      // The rejected answer is included; keep its valid items rather than wasting it.
      try {
        const failed = (JSON.parse(body) as { error?: { failed_generation?: string } }).error
          ?.failed_generation;
        const rescued = failed ? salvage(schema, JSON.parse(failed)) : null;
        if (rescued) return rescued;
      } catch {
        /* unparseable, so fall through to retry */
      }
      if (!last) continue;
    }
    if (res.status >= 500 && !last) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    throw new Error(`Groq ${res.status}: ${body.slice(0, 600)}`);
  }
}

const CATEGORY = z
  .string()
  .describe(
    "One of: Landmark, Museum, Food, Nature, Shopping, Neighborhood, Beach, Adventure, Entertainment",
  );
const INTEREST = z
  .string()
  .describe(
    "One of: Nature, Food, Shopping, History, Art, Adventure, Beaches, Nightlife, Photography, Hidden gems, Filming locations, Entertainment",
  );

const PlaceDetails = z.object({
  category: CATEGORY,
  costUsd: z.number(),
  durationMin: z.number(),
  openHour: z.number(),
  closeHour: z.number(),
  indoor: z.boolean(),
  tags: z.array(INTEREST),
  blurb: z.string().describe("One inviting sentence, max 160 characters"),
  funFact: z.string().describe("A surprising, true fun fact, max 200 characters"),
});

const EnrichSchema = z.object({
  places: z.array(PlaceDetails.extend({ id: z.string() })),
  extra: z.array(
    PlaceDetails.extend({
      name: z.string(),
      wikipediaTitle: z.string(),
      lat: z.number(),
      lng: z.number(),
      address: z.string(),
      diet: z
        .array(z.string())
        .describe(
          "Dietary needs this place handles well, e.g. Vegetarian, Vegan, Gluten-free, Halal",
        ),
    }),
  ),
});
export type EnrichResult = z.infer<typeof EnrichSchema>;

export async function enrichPlaces(input: {
  city: string;
  country: string;
  places: { id: string; name: string; description: string; category: string }[];
  interests: string[];
  dietary: string[];
  budgetStyle: string;
}): Promise<EnrichResult | null> {
  const list = input.places
    .map((p) => `- ${p.id} | ${p.name} | ${p.category} | ${p.description}`)
    .join("\n");
  return ask(
    EnrichSchema,
    "place_details",
    `Destination: ${input.city}, ${input.country}.
Traveler interests: ${input.interests.join(", ") || "anything"}. Dietary needs: ${input.dietary.filter((d) => d !== "No restrictions").join(", ") || "none"}. Budget style: ${input.budgetStyle}.

1) For each place below, return accurate visitor details keyed by the same id (skip any that are not really visitable).
${list}

2) In "extra", add up to 6 great places missing from the list: at least 3 restaurants or food spots that suit the dietary needs and budget (put the cuisine in the blurb), plus beloved local hidden gems and activities matching the interests.`,
  );
}

const FilmSchema = z.object({
  title: z.string(),
  kind: z.enum(["Movie", "TV"]),
  locations: z.array(
    z.object({
      name: z.string(),
      city: z.string(),
      country: z.string(),
      lat: z.number(),
      lng: z.number(),
      address: z.string(),
      scene: z.string().describe("What was filmed here, max 180 characters"),
      wikipediaTitle: z.string(),
      category: CATEGORY,
      costUsd: z.number(),
      durationMin: z.number(),
      openHour: z.number(),
      closeHour: z.number(),
      visitable: z.boolean().describe("Whether the public can visit or view it"),
    }),
  ),
});
export type FilmResult = z.infer<typeof FilmSchema>;

export async function filmingLocations(title: string): Promise<FilmResult | null> {
  return ask(
    FilmSchema,
    "filming_locations",
    `List up to 10 real, well-documented filming locations for the movie or TV show "${title}". Only include locations you are confident about; use the official title and kind. If you don't recognise the title, return it with an empty locations list.`,
  );
}

const DestSchema = z.object({
  destinations: z.array(
    z.object({
      name: z.string(),
      country: z.string(),
      wikipediaTitle: z.string(),
      lat: z.number(),
      lng: z.number(),
      why: z
        .string()
        .describe(
          "Why this traveler would love it, referencing their past trips or interests, max 160 characters",
        ),
      bestMonths: z.string(),
      tags: z.array(INTEREST),
    }),
  ),
});
export type DestResult = z.infer<typeof DestSchema>;

export async function suggestDestinations(input: {
  interests: string[];
  visited: string[];
  loved: string[];
  bucket: string[];
  budgetStyle: string;
  /** Optional theme to lean into, e.g. "Beaches". */
  focus?: string;
}): Promise<DestResult | null> {
  return ask(
    DestSchema,
    "destination_ideas",
    `Suggest 6 future trip destinations (cities or towns) for this traveler.
Interests: ${input.interests.join(", ") || "varied"}. Budget: ${input.budgetStyle}.
Already visited: ${input.visited.join(", ") || "none yet"}. Places they loved: ${input.loved.join(", ") || "unknown"}. Bucket list: ${input.bucket.join(", ") || "empty"}.
Avoid places they've visited; offer a mix of famous and under-the-radar picks with experiences similar to what they enjoyed.${input.focus ? `\nEvery pick must be outstanding for: ${input.focus}.` : ""}`,
  );
}
