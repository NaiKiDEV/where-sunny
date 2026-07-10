# Where Sunny? ☀️

Find where the sun is actually shining — nearby, a day trip, or a flight away.

A backend-less PWA: a fullscreen map that scores every reachable place by a
**sun score** (sunshine hours, cloud cover, rain probability, temperature
comfort) computed from live [Open-Meteo](https://open-meteo.com) forecasts,
and tells you whether the trip beats staying home.

## Stack

- **Vite + React + TypeScript**, installable PWA (`vite-plugin-pwa`)
- **MapLibre GL** with free no-key vector tiles (OpenFreeMap)
- **TanStack Query** (+ IndexedDB persistence) for forecast caching, **Zustand** for app state
- **Open-Meteo** forecast + geocoding APIs — free, no key, CORS-enabled
- Bundled **GeoNames** city dataset (~69k places) as travel candidates
- **Vitest** for the pure-TS core domain

See [docs/DESIGN.md](docs/DESIGN.md) for the full product and architecture design.

## Development

```bash
pnpm install
pnpm setup:data   # downloads GeoNames, builds public/data/cities.json + PWA icons
pnpm dev
```

`pnpm test` runs the core-domain test suite; `pnpm build` type-checks and
produces the production bundle in `dist/`.

## How it works

1. Pick an origin (geolocation or city search) and a travel tier
   (Nearby 50 km · Day trip 300 km · Getaway 1000 km · Flight 3000 km).
2. The bundled city list is filtered to ≤300 candidates within range.
3. One batched Open-Meteo request per ~100 candidates fetches 7-day daily
   forecasts (3–4 HTTP calls total, cached ~2 h).
4. Every place gets a 0–100 sun score per day; the best day within your time
   window (today / tomorrow / weekend / 7 days) ranks the list and colors the
   map. A comfort preset (cool / mild / hot / any) tunes what "good" means.
5. Any place can be **watched** regardless of range or size — search it, star
   it, and it always shows its forecast, marker, and details.
6. Detail views cross-check the score against three independent weather models
   (ECMWF, GFS, ICON) and show an hourly sun timeline, so you can see both how
   confident the forecast is and *when* the sun actually appears.

## Data & attribution

- Weather: [Open-Meteo](https://open-meteo.com) (CC-BY 4.0, non-commercial free tier)
- Places: [GeoNames](https://www.geonames.org) (CC-BY 4.0)
- Map tiles: [OpenFreeMap](https://openfreemap.org) © OpenStreetMap contributors
