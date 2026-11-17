# ☁️ SKY CRED — The Sky's Credit Score

A playful weather web app that rates the sky's "credit score": live weather data,
dynamic sky themes, city-specific accent colors, AQI, and fun weather personalities
like **Perfect Day**, **Rain Check**, and **Sun Alert**.

> SKY CRED is a weather metaphor — it is **not** a financial credit score.

## Live features

- **Mumbai loads automatically on launch** (default query), fresh data on every search.
- **City search** for any city worldwide ("City, Country" helps disambiguate).
- **10 Popular City shortcuts**: Mumbai, Delhi, Bengaluru, Kolkata, Chennai, Hyderabad, Pune, London, New York, Tokyo.
- **Current conditions**: temperature, feels-like, condition text + icon, humidity, wind (speed + direction), UV index, pressure, visibility, precipitation, cloud cover.
- **AQI panel** (PM2.5 / PM10, US EPA scale approximation) — shown only when the API provides air quality data.
- **SKY SCORE (300–900)** — a playful, deterministic rating computed from temperature comfort, UV, wind, humidity, precipitation and air quality. Higher = friendlier sky.
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
- **Weather Data Inspector**: Formatted JSON / Raw JSON tabs + Copy. Both views render the same underlying API response (the serverless proxy passes the upstream body through untouched).
- **Handled states**: loading, city-not-found, API key/rate-limit errors, network failures, missing AQI, request timeout.

## Architecture

```
sky-cred/
├── api/weather.js      # Vercel serverless function — proxies WeatherAPI.com (key stays server-side)
├── index.html          # Single-page front end
├── styles.css          # Weather themes + responsive layout
├── app.js              # Rendering, personality/score rules, JSON inspector
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
2. Create a Vercel project and add the environment variable:
   - `WEATHER_API_KEY` = your WeatherAPI.com key (all environments)
3. Deploy (`vercel deploy --prod`) or connect the GitHub repo for auto-deploys on every push to `main`.

## Credits & disclaimer

- Weather data by [WeatherAPI.com](https://www.weatherapi.com/).
- SKY SCORE is a playful weather rating, not a financial score and not safety guidance.
  Always confirm severe weather with official sources.
