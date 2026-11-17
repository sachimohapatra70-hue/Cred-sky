# 📡 SkySignal — Live Sky Vibes

A playful weather web app that shows the sky the way it actually looks: **live
animated backgrounds** (falling rain, drifting snow, sun with rays, moon +
twinkling stars, clouds, fog, lightning), a **season option**, city-specific
sky colors, AQI, and fun weather personalities like **Perfect Day**,
**Rain Check**, and **Sun Alert**.

> The SkyScore badge is a playful weather rating — it is **not** a financial credit score.

## Live features

- **Mumbai loads automatically on launch** (default query), fresh data on every search.
- **City search** for any city worldwide ("City, Country" helps disambiguate).
- **10 Popular City shortcuts**: Mumbai, Delhi, Bengaluru, Kolkata, Chennai, Hyderabad, Pune, London, New York, Tokyo.
- **Live animated sky** (canvas, zero dependencies), driven by the real weather:
  - 🌧️ **Rain** → falling raindrops (heavier rain = denser downpour)
  - ❄️ **Snow** → drifting snowflakes
  - ⛈️ **Thunder** → dark clouds, heavy rain, lightning flashes
  - 🌫️ **Fog** → rolling mist
  - ☀️ **Day sun** → glowing sun with slowly rotating rays (partly cloudy → sun + drifting clouds)
  - 🌙 **Night** → moon + twinkling stars, occasional shooting star (stars stay faintly visible through clouds/rain)
- **Season option** (✨ Auto / 🌸 Spring / ☀️ Summer / 🌧️ Monsoon / 🍂 Autumn / ❄️ Winter):
  - Auto detects the season from the city's latitude + today's month (northern/southern hemisphere aware, monsoon for tropical belts).
  - Your pick tints the sky gradient and adds seasonal particles (winter flurry, monsoon drizzle, autumn leaves, spring petals) whenever the real weather is calm.
  - Choice is remembered in `localStorage`.
- **Current conditions**: temperature, feels-like, condition text + icon, humidity, wind (speed + direction), UV index, pressure, visibility, precipitation, cloud cover.
- **AQI panel** (PM2.5 / PM10, US EPA scale approximation) — shown only when the API provides air quality data.
- **SkyScore (300–900)** — a playful, deterministic rating computed from temperature comfort, UV, wind, humidity, precipitation and air quality.
- **Weather personalities** with defined rules:
  | Personality | Rule (checked in order) |
  |---|---|
  | Storm Warning | thunder codes (1087, 1273, 1276) **or** wind ≥ 60 kph |
  | Snow Day | snow/sleet/ice-pellet condition codes |
  | Rain Check | rain/drizzle/shower condition codes |
  | Fog Watch | mist/fog/freezing-fog codes (1030, 1135, 1147) |
  | Sun Alert | daytime **and** (UV ≥ 7 **or** clear sky with temp ≥ 30°C) |
  | Chilly Check | temp ≤ 10°C |
  | Perfect Day | 18–29°C, UV ≤ 6, wind < 25 kph, humidity ≤ 70%, no rain, PM2.5 ≤ 55 |
  | Humid Haze | temp ≥ 27°C and humidity > 75% |
  | Balanced Day | everything else (default) |
- **Dynamic visual themes** (7 gradients) driven by weather condition + day/night, plus a **deterministic city signature color** (hue hashed from the city name).
- **Weather Data Inspector**: Formatted JSON / Raw JSON tabs + Copy. Both views render the same underlying API response.
- **Handled states**: loading, city-not-found, API key/rate-limit errors, network failures, missing AQI, request timeout.
- Accessibility: respects `prefers-reduced-motion` (static sky), particles pause when the tab is hidden.

## Architecture

```
sky-cred/
├── api/weather.js      # Vercel serverless function — proxies WeatherAPI.com (key stays server-side)
├── index.html          # Single-page front end
├── styles.css          # Weather/season themes + responsive layout
├── sky.js              # Animated sky canvas engine (rain, snow, sun, moon, stars, clouds, fog, lightning)
├── app.js              # Rendering, personality/score rules, season logic, JSON inspector
└── .env.example        # Template for the local .env file
```

- **API**: `GET https://api.weatherapi.com/v1/current.json` with params `key`, `q` (city), `aqi=yes`, response JSON.
- The browser never sees the API key: the front end calls `/api/weather?q=<city>` and the
  serverless function attaches `WEATHER_API_KEY` from environment variables.
- Responses are edge-cached for 180s (`s-maxage`) to be gentle on the API quota; every search still triggers a fresh lookup.

## Local development

```bash
npm install -g vercel      # or use npx
cp .env.example .env       # add your WeatherAPI.com key
vercel dev                 # http://localhost:3000
```

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Vercel project: add the environment variable
   - `WEATHER_API_KEY` = your WeatherAPI.com key (all environments)
3. Deploy (`vercel deploy --prod`) or connect the GitHub repo for auto-deploys on every push to `main`.

## Credits & disclaimer

- Weather data by [WeatherAPI.com](https://www.weatherapi.com/).
- SkyScore is a playful weather rating, not a financial score and not safety guidance.
  Always confirm severe weather with official sources.
