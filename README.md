# Ans2Sans 🐚✈️

A playful, AI-powered trip planner. Pick a destination anywhere in the world, add your must-visits, swipe through
recommendations, and get a day-by-day itinerary that works around opening hours, travel time, weather, crowds and
your budget. On the trip, check in at each stop with a photo. Your photos stay sealed in a time capsule until the
final day, and the day after you get home they turn into a digital scrapbook. You can plan solo or with friends.

## Quick start

```sh
npm install        # or: bun install
npm run dev        # http://localhost:3000
```

Create an account and plan your first trip. There is no built-in or sample data: every city, place, price,
photo and fun fact comes live from open data (Wikipedia, Open-Meteo, OpenStreetMap) or, when enabled, the AI.

### Optional: AI features

Copy `.env.example` to `.env` and set `GROQ_API_KEY` (free at [console.groq.com/keys](https://console.groq.com/keys)).
With a key, **GPT-OSS 120B on Groq** (`openai/gpt-oss-120b`, override with `GROQ_MODEL`) also:

- tunes prices, opening hours and durations for discovered places, and writes fun facts
- adds restaurants that fit your dietary needs and budget, plus local hidden gems
- finds filming locations for **any** movie or show
- suggests future destinations based on your trips and interests

Without a key, the app runs entirely on free open data, and only those extras are hidden.

## Features

| Area                | What works                                                                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning            | Worldwide destination search, trip wizard (dates, budget, accommodation, travelers, interests, pace, diet), must-visit list with search for attractions/restaurants/activities, bucket-list reminders                                                                 |
| Recommendations     | Swipe deck that learns from every swipe, save, visit and skip; favors places near your picks, bucket-list items, dietary fit, popularity and hidden gems                                                                                                              |
| Itinerary           | Groups nearby stops, respects opening hours, schedules around rain (indoor vs outdoor) and peak crowds; warns when too much is picked and offers _add a day_ / _trim optional picks_                                                                                  |
| Best time to travel | 12-month comparison using two years of real weather observations plus seasonal crowds and prices; mark months you can't go; compare up to 3 options                                                                                                                   |
| Budget              | Estimates for stay (hostel/rental/hotel/resort), food, local transport and entry fees; per-day costs; one-tap cheaper alternatives; actual expense tracking                                                                                                           |
| Map & routes        | Interactive OpenStreetMap map, real walking/driving routes, mode comparison with time and cost and a suggested mode, place details with fun facts and an hourly crowd forecast, nearby ideas you can add                                                              |
| On the trip         | Travel mode with live forecast, next stop and routed travel time; photo check-ins that reveal the next stop; schedule assistant (running late, skip, add, nearby, change transport, stay longer, rearrange, **it's raining**, **place closed**, **I missed a place**) |
| Memories            | Time capsule that unlocks on the final day (editable captions), automatic scrapbook the day after with four layouts, themes, notes, a map of where you went, print/PDF download and sharing                                                                           |
| Group trips         | Invite links, live sync of the itinerary for everyone, suggestions and votes, organizer finalize, shared time capsule and scrapbook with photo credits                                                                                                                |
| Accounts            | Email/password accounts (scrypt-hashed passwords, httpOnly session cookies); trips sync across devices                                                                                                                                                                |

## Data sources (all free, no keys)

- **Open-Meteo**: geocoding, 16-day forecasts, historical weather
- **Wikipedia**: places, photos, descriptions, popularity (used to separate famous spots from hidden gems)
- **OpenStreetMap**: map tiles and walking/driving routing (OSRM). For heavy production traffic, point
  `MapView.tsx` at a tile provider of your choice, per the
  [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

Transit times, prices and crowd levels are modeled estimates, and the UI labels them as such.

## Production

```sh
npm run build
npm start          # node .output/server/index.mjs
```

Accounts, trips and group trips are stored as JSON files in `DATA_DIR` (default `./.data`), so the host needs a
persistent disk. To use a database instead, replace `src/server/db.ts`, which exposes only `get`, `put`, `update` and
`remove`. Set `NITRO_PRESET` to target other hosts.

## Project layout

```
src/
  routes/          screens (TanStack Start file routes)
  components/app/  app UI (map, timeline, swipe deck, logo, whimsy…)
  lib/             planner logic: itinerary, recommendations, crowds, budget, group merge, store
  services/        open-data clients: places (Wikipedia), weather, geocoding, routing, AI glue
  server/          server functions, auth, JSON store, AI (Groq, OpenAI-compatible chat completions)
```

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm test` · `npm run typecheck` · `npm run lint`
