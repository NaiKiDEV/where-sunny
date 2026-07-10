Me:
Imagine I had to create a "Where Sunny?" app which aggregates weather data and suggest you places whetlre you can walk, drive, fly to, to reach a certain country, city or a place where it will be sunny, so you could have a good time.
What if the app had no backend and had everything onboard on the same app and it was pwa or mobile native app.Is this possible to pull off, do we need a dedicated backend, is there a free and open way to get this data, how could we solve this, to have this app.

Claude:

Yes, totally doable without a backend — and you're lucky, because weather is one of the few domains with a genuinely free, open, no-API-key data source.
The data problem is solved: Open-Meteo
Open-Meteo (open-meteo.com) is the answer here. Free for non-commercial use, no API key, no signup, CORS enabled (so it works straight from a PWA), and generous limits (~10k requests/day). It gives you forecasts up to 16 days with cloud cover, sunshine duration, precipitation probability, temperature — everything "Where Sunny?" needs. It also has a free geocoding API for city name → coordinates. For commercial use it's a cheap paid tier, but for a hobby app you're fine.
The architecture without a backend
The trick is that "where is it sunny near me" is a spatial search, and weather APIs answer point queries. So the app does this client-side:

Get user location, pick a travel radius (walk ~5km, drive ~300km, fly ~2500km).
Sample candidate points — either a bundled offline list of cities (a JSON of ~10–50k world cities with coords and population is a few MB, ships with the app) or a hex/grid sampling around the user.
Batch-query Open-Meteo — it supports multiple coordinates in one request (comma-separated lats/lons), so you can score 100+ locations in a handful of HTTP calls.
Score and rank: sunshine hours + low cloud cover + temperature comfort, weighted against travel distance. Cache results in IndexedDB/AsyncStorage for an hour so you don't hammer the API.

Where you'd eventually want a backend (but don't need one to launch)
Only three reasons: hiding a paid API key (not needed with Open-Meteo), pre-computing global "sunshine heatmaps" so clients don't do the sampling work, and rate-limit pooling if you get lots of users. All optimizations, not requirements.
PWA vs native
PWA works fine since Open-Meteo allows CORS and geolocation is available in browsers. Given your React Native background, Expo would let you ship both from one codebase — and RN gives you nicer background location + notifications ("it'll be sunny in Nida this weekend") which is arguably the killer feature for this app.
The one genuinely interesting engineering problem is the candidate-selection step — want to sketch how the city-grid sampling and scoring function could work?
