'use strict';

/* ============================================================
   SKY CRED — front-end logic
   Data source: /api/weather (Vercel serverless proxy for
   WeatherAPI.com /v1/current.json, aqi=yes). No mock data.
   ============================================================ */

const DEFAULT_CITY = 'Mumbai';

const POPULAR_CITIES = [
  { name: 'Mumbai',    emoji: '🌊' },
  { name: 'Delhi',     emoji: '🏛️' },
  { name: 'Bengaluru', emoji: '🌳' },
  { name: 'Kolkata',   emoji: '🚋' },
  { name: 'Chennai',   emoji: '🏖️' },
  { name: 'Hyderabad', emoji: '💎' },
  { name: 'Pune',      emoji: '⛰️' },
  { name: 'London',    emoji: '☂️' },
  { name: 'New York',  emoji: '🗽' },
  { name: 'Tokyo',     emoji: '🗼' },
];

/* WeatherAPI condition codes, grouped for theme + personality rules */
const CODE_GROUPS = {
  clear:   [1000],
  cloudy:  [1003, 1006, 1009],
  fog:     [1030, 1135, 1147],
  rain:    [1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246],
  snow:    [1066, 1069, 1114, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264, 1279, 1282],
  thunder: [1087, 1273, 1276],
};

/* Personality rules (thresholds defined in personalityFor below) */
const PERSONALITIES = {
  'Storm Warning': '⛈️ — Electrical mood swings overhead. Best to stay indoors and watch the drama.',
  'Snow Day': '❄️ — Frozen assets everywhere. Layer up and channel cozy energy.',
  'Rain Check': '☔ — The sky is rescheduling plans. Umbrella protocol: engaged.',
  'Fog Watch': '🌫️ — Visibility on a budget. Slow down and keep your headlights honest.',
  'Sun Alert': '🧴 — High solar exposure on record. SPF, shades and actual shade are your friends.',
  'Chilly Check': '🧣 — Cold snap detected. Dress in layers, like a well-diversified portfolio.',
  'Perfect Day': '🌟 — Flawless conditions across the board. The sky is paying all its bills on time.',
  'Humid Haze': '🫠 — Sticky air in circulation. Hydration mode: ON.',
  'Balanced Day': '🌤️ — Mixed conditions on file. Scan the report below before stepping out.',
};

/* AQI categories (US EPA scale, approximated from PM2.5 in µg/m³) */
const AQI_LEVELS = [
  { max: 12,    label: 'Good',                           cls: 'good',      advice: 'Air is clean. Breathe easy and enjoy the outdoors.' },
  { max: 35.4,  label: 'Moderate',                       cls: 'moderate',  advice: 'Acceptable air. Sensitive groups should keep an eye on it.' },
  { max: 55.4,  label: 'Unhealthy for Sensitive Groups', cls: 'usg',       advice: 'Sensitive groups: limit long outdoor exertion.' },
  { max: 150.4, label: 'Unhealthy',                      cls: 'unhealthy', advice: 'Everyone should limit prolonged outdoor exertion.' },
  { max: 250.4, label: 'Very Unhealthy',                 cls: 'very-bad',  advice: 'Avoid outdoor activity where possible.' },
  { max: 1e9,   label: 'Hazardous',                      cls: 'hazardous', advice: 'Stay indoors — air is at emergency levels.' },
];

const state = {
  lastQuery: DEFAULT_CITY,
  lastData: null,
  season: 'auto',
  raw: '',
  pretty: '',
  activeTab: 'formatted',
};

/* Season option — Auto detects from the city's latitude + today's month */
const SEASON_META = {
  auto:    { emoji: '✨', name: 'Auto' },
  spring:  { emoji: '🌸', name: 'Spring' },
  summer:  { emoji: '☀️', name: 'Summer' },
  monsoon: { emoji: '🌧️', name: 'Monsoon' },
  autumn:  { emoji: '🍂', name: 'Autumn' },
  winter:  { emoji: '❄️', name: 'Winter' },
};

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
));
const has = (arr, v) => arr.indexOf(v) !== -1;
const isNum = (v) => typeof v === 'number' && isFinite(v);

/* ---------- weather rules ---------- */

function themeFor(current) {
  const code = current.condition.code;
  const isDay = current.is_day === 1;
  if (has(CODE_GROUPS.thunder, code)) return 'thunder';
  if (has(CODE_GROUPS.snow, code)) return 'snow';
  if (has(CODE_GROUPS.rain, code)) return 'rain';
  if (has(CODE_GROUPS.fog, code)) return 'fog';
  if (has(CODE_GROUPS.cloudy, code)) return 'cloudy';
  if (has(CODE_GROUPS.clear, code)) return isDay ? 'clear-day' : 'clear-night';
  return isDay ? 'cloudy' : 'clear-night';
}

function personalityFor(current) {
  const code = current.condition.code;
  const temp = current.temp_c ?? 0;
  const uv = current.uv ?? 0;
  const wind = current.wind_kph ?? 0;
  const humidity = current.humidity ?? 0;
  const precip = current.precip_mm ?? 0;
  const pm25 = current.air_quality ? current.air_quality.pm2_5 : null;
  const isDay = current.is_day === 1;
  const airOk = pm25 == null ? true : pm25 <= 55;

  if (has(CODE_GROUPS.thunder, code) || wind >= 60) return 'Storm Warning';
  if (has(CODE_GROUPS.snow, code)) return 'Snow Day';
  if (has(CODE_GROUPS.rain, code)) return 'Rain Check';
  if (has(CODE_GROUPS.fog, code)) return 'Fog Watch';
  if (isDay && (uv >= 7 || (has(CODE_GROUPS.clear, code) && temp >= 30))) return 'Sun Alert';
  if (temp <= 10) return 'Chilly Check';
  if (temp >= 18 && temp <= 29 && uv <= 6 && wind < 25 && humidity <= 70 && precip < 0.5 && airOk) return 'Perfect Day';
  if (temp >= 27 && humidity > 75) return 'Humid Haze';
  return 'Balanced Day';
}

/* Playful 300–900 "sky credit score": higher = friendlier weather. */
function skyScoreFor(current) {
  const t = current.temp_c ?? 23;
  const uv = current.uv ?? 0;
  const wind = current.wind_kph ?? 0;
  const humidity = current.humidity ?? 50;
  const precip = current.precip_mm ?? 0;
  const pm25 = current.air_quality ? current.air_quality.pm2_5 : null;

  const tempPts = 250 * Math.max(0, 1 - Math.abs(t - 23) / 15);   // best at 23°C
  const uvPts   = 150 * Math.max(0, (12 - uv) / 12);              // low UV wins
  const windPts = 100 * Math.max(0, (50 - wind) / 50);            // calm wins
  const humPts  = 100 * Math.max(0, 1 - Math.abs(humidity - 50) / 50); // 50% ideal
  const airPts  = pm25 == null ? 75 : 150 * Math.max(0, (100 - pm25) / 100);
  const rainPts = 100 * Math.max(0, 1 - precip / 5);              // up to 5mm penalty

  const total = 300 + tempPts + uvPts + windPts + humPts + airPts + rainPts;
  return Math.round(Math.min(900, Math.max(300, total)));
}

function scoreBand(score) {
  if (score >= 800) return 'A+ · Sky Excellence';
  if (score >= 700) return 'A · Great';
  if (score >= 600) return 'B · Fair';
  if (score >= 500) return 'C · Building Credit';
  return 'D · High-Risk Sky';
}

function uvInfo(uv) {
  if (!isNum(uv)) return { label: '—', cls: '' };
  if (uv < 3)  return { label: 'Low', cls: 'good' };
  if (uv < 6)  return { label: 'Moderate', cls: 'moderate' };
  if (uv < 8)  return { label: 'High', cls: 'usg' };
  if (uv < 11) return { label: 'Very High', cls: 'unhealthy' };
  return { label: 'Extreme', cls: 'hazardous' };
}

function aqiInfo(pm25) {
  if (!isNum(pm25)) return null;
  return AQI_LEVELS.find((l) => pm25 <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

/* ---------- rendering ---------- */

function cityHue(name) {
  const s = String(name || DEFAULT_CITY);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 3600;
  return Math.floor(h / 10);
}

function popularEmoji(name) {
  const key = String(name || '').toLowerCase();
  const hit = POPULAR_CITIES.find((c) => c.name.toLowerCase() === key);
  return hit ? hit.emoji : '🌍';
}

function renderWeather(data, queried) {
  const loc = data.location || {};
  const cur = data.current || {};
  const place = [loc.name, loc.region, loc.country].filter(Boolean).join(', ');

  document.body.dataset.theme = themeFor(cur);
  document.documentElement.style.setProperty('--city-hue', String(cityHue(loc.name || queried)));
  document.title = `${loc.name || queried} — SkySignal`;

  $('w-location').textContent = place || queried;
  $('city-chip').textContent = popularEmoji(loc.name || queried);
  $('w-localtime').textContent =
    `Local time: ${loc.localtime || '—'} · Data updated: ${cur.last_updated || '—'}`;

  const iconUrl = (cur.condition && cur.condition.icon ? cur.condition.icon : '')
    .replace(/^\/\//, 'https://')
    .replace('64x64', '128x128');
  $('w-icon').src = iconUrl;
  $('w-icon').alt = (cur.condition && cur.condition.text) || 'Weather condition icon';

  $('w-temp').textContent = isNum(cur.temp_c) ? String(Math.round(cur.temp_c)) : '—';
  $('w-condition').textContent = (cur.condition && cur.condition.text) || '—';
  $('w-feels').textContent = isNum(cur.feelslike_c) ? String(Math.round(cur.feelslike_c)) : '—';

  const personality = personalityFor(cur);
  const score = skyScoreFor(cur);
  $('p-emoji-name').textContent = `${PERSONALITIES[personality].split(' — ')[0]} ${personality}`;
  $('p-desc').textContent = PERSONALITIES[personality].split(' — ')[1];
  $('sky-score').textContent = String(score);
  $('score-band').textContent = scoreBand(score);

  const uv = uvInfo(cur.uv);
  const metrics = [
    { label: 'Feels Like',    value: isNum(cur.feelslike_c) ? `${Math.round(cur.feelslike_c)}°C` : '—', sub: 'real-feel' },
    { label: 'Humidity',      value: isNum(cur.humidity)    ? `${cur.humidity}%` : '—',                sub: 'relative' },
    { label: 'Wind',          value: isNum(cur.wind_kph)    ? `${Math.round(cur.wind_kph)} kph` : '—', sub: cur.wind_dir || '' },
    { label: 'UV Index',      value: isNum(cur.uv)          ? String(cur.uv) : '—',                    sub: uv.label, cls: uv.cls },
    { label: 'Pressure',      value: isNum(cur.pressure_mb) ? `${cur.pressure_mb} mb` : '—',           sub: 'sea level' },
    { label: 'Visibility',    value: isNum(cur.vis_km)      ? `${cur.vis_km} km` : '—',                sub: 'daylight' },
    { label: 'Precipitation', value: isNum(cur.precip_mm)   ? `${cur.precip_mm} mm` : '—',             sub: 'recent' },
    { label: 'Cloud Cover',   value: isNum(cur.cloud)       ? `${cur.cloud}%` : '—',                   sub: 'of sky' },
  ];
  $('metrics-grid').innerHTML = metrics.map((m) => `
    <div class="tile">
      <p class="tile-label">${esc(m.label)}</p>
      <p class="tile-value ${m.cls || ''}">${esc(m.value)}</p>
      <p class="tile-sub">${esc(m.sub)}</p>
    </div>`).join('');

  renderAqi(cur.air_quality);
  renderJson();

  state.lastData = data;
  applyScene();

  $('result').hidden = false;
  $('error').hidden = true;
  $('status').hidden = true;
  $('search-hint').textContent = loc.name
    ? `Resolved to ${place}${isNum(loc.lat) && isNum(loc.lon) ? ` (${loc.lat}, ${loc.lon})` : ''}. Fresh data fetched just for you.`
    : '';
}

function renderAqi(aq) {
  const box = $('aqi-content');
  if (!aq || !isNum(aq.pm2_5)) {
    box.innerHTML = `<p class="aqi-none">AQI data isn't available for this location right now. Everything else above is fully live.</p>`;
    return;
  }
  const info = aqiInfo(aq.pm2_5);
  const pm10 = isNum(aq.pm10) ? aq.pm10 : null;
  box.innerHTML = `
    <div class="aqi-badge ${info.cls}">
      <span class="aqi-score">${esc(info.label)}</span>
      <span class="aqi-note">based on PM2.5 · US EPA scale (approx.)</span>
    </div>
    <p class="aqi-advice">${esc(info.advice)}</p>
    <div class="pollutant">
      <span class="pollutant-label">PM2.5</span>
      <div class="bar"><div class="bar-fill ${info.cls}" style="width:${Math.min(100, (aq.pm2_5 / 150) * 100)}%"></div></div>
      <span class="pollutant-value">${esc(aq.pm2_5)} µg/m³</span>
    </div>
    <div class="pollutant">
      <span class="pollutant-label">PM10</span>
      <div class="bar"><div class="bar-fill ${pm10 != null ? info.cls : ''}" style="width:${pm10 != null ? Math.min(100, (pm10 / 250) * 100) : 0}%"></div></div>
      <span class="pollutant-value">${pm10 != null ? esc(pm10) + ' µg/m³' : '—'}</span>
    </div>`;
}

function renderJson() {
  $('json-view').textContent = state.activeTab === 'raw' ? state.raw : state.pretty;
  $('tab-formatted').classList.toggle('active', state.activeTab === 'formatted');
  $('tab-raw').classList.toggle('active', state.activeTab === 'raw');
}

/* ---------- UI state ---------- */

function showStatus(message) {
  $('status-text').textContent = message;
  $('status').hidden = false;
  $('error').hidden = true;
  $('result').hidden = true;
}

function showError(title, detail) {
  $('error-title').textContent = title;
  $('error-detail').textContent = detail;
  $('status').hidden = true;
  $('result').hidden = true;
  $('error').hidden = false;
}

/* ---------- data fetching ---------- */

async function fetchWeather(city) {
  const target = String(city || '').trim() || DEFAULT_CITY;
  state.lastQuery = target;
  showStatus(`Fetching the live sky signal for ${target}…`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`/api/weather?q=${encodeURIComponent(target)}`, { signal: controller.signal });
    const text = await res.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (e) { /* non-JSON body */ }

    if (!res.ok) {
      const apiMsg = payload && payload.error ? payload.error.message : null;
      if (res.status === 400) {
        showError('City not found 🔎', `${apiMsg || 'No matching location.'} Double-check the spelling, or try "City, Country" (e.g. "Springfield, US").`);
      } else if (res.status === 401 || res.status === 403) {
        showError('Weather desk says no 🔐', apiMsg || 'The weather API rejected the request. The key may be invalid or expired.');
      } else if (res.status === 429) {
        showError('Rate limit hit ⏳', apiMsg || 'Too many sky credit checks in a row. Give it a minute and retry.');
      } else {
        showError('Something went wrong ⚠️', apiMsg || `Weather service error (HTTP ${res.status}).`);
      }
      return;
    }
    if (!payload || !payload.current || !payload.location) {
      showError('Confusing report 🤔', 'The weather service returned data we could not understand. Try again.');
      return;
    }
    state.raw = text;
    state.pretty = JSON.stringify(payload, null, 2);
    renderWeather(payload, target);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    showError(
      aborted ? 'The sky kept us waiting ⏱️' : 'Network hiccup 📡',
      aborted ? 'The request timed out. Check your connection and try again.'
              : 'Could not reach the weather desk. Check your connection and try again.'
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- season + live sky scene ---------- */

function autoSeason(lat) {
  const m = new Date().getMonth() + 1; // 1..12
  const south = lat != null && lat < 0;
  const tropical = lat != null && Math.abs(lat) <= 35;
  let s;
  if (m >= 6 && m <= 9) s = tropical && !south ? 'monsoon' : 'summer';
  else if (m === 12 || m <= 2) s = 'winter';
  else if (m <= 5) s = 'spring';
  else s = 'autumn';
  if (south) {
    if (s === 'winter') s = 'summer';
    else if (s === 'summer') s = 'winter';
    else if (s === 'spring') s = 'autumn';
    else if (s === 'autumn') s = 'spring';
    if (tropical && (m === 12 || m <= 3)) s = 'monsoon';
  }
  return s;
}

function buildSeasonChips() {
  $('season-chips').innerHTML = Object.keys(SEASON_META).map(
    (id) => `<button type="button" class="chip season-chip" data-season="${id}" title="${esc(SEASON_META[id].name)} season">${SEASON_META[id].emoji} ${esc(SEASON_META[id].name)}</button>`
  ).join('');
  syncSeasonChips();
}

function syncSeasonChips() {
  document.querySelectorAll('#season-chips .chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.season === state.season);
  });
}

/* Map live weather to an animated scene for the canvas */
function sceneFor(cur) {
  const code = cur.condition.code;
  const night = cur.is_day !== 1;
  if (has(CODE_GROUPS.thunder, code)) return { kind: 'thunder', night, intensity: 1 };
  if (has(CODE_GROUPS.snow, code)) return { kind: 'snow', night, intensity: Math.min(1, 0.4 + (cur.precip_mm || 0) / 3) };
  if (has(CODE_GROUPS.rain, code)) {
    const light = has([1072, 1150, 1153, 1180, 1198], code);
    return { kind: 'rain', night, intensity: light ? 0.35 : Math.min(1, 0.55 + (cur.precip_mm || 0) / 6) };
  }
  if (has(CODE_GROUPS.fog, code)) return { kind: 'fog', night, intensity: 0.6 };
  if (code === 1003) return { kind: 'partly', night, intensity: 0.5 };
  if (has(CODE_GROUPS.cloudy, code)) return { kind: 'clouds', night, intensity: 0.7 };
  return { kind: 'clear', night, intensity: 0.5 };
}

function applyScene() {
  const eff = state.season === 'auto'
    ? autoSeason(state.lastData && state.lastData.location ? state.lastData.location.lat : null)
    : state.season;
  document.body.dataset.season = eff;
  const meta = SEASON_META[eff] || SEASON_META.auto;
  const note = $('season-note');
  if (note) {
    note.textContent = `Season: ${meta.emoji} ${meta.name} · ${state.season === 'auto' ? 'auto-detected' : 'picked by you'}`;
  }
  if (state.lastData && state.lastData.current) {
    Sky.setScene(Object.assign(sceneFor(state.lastData.current), { accent: eff === 'auto' ? null : eff }));
  }
}

/* ---------- events + init ---------- */

function buildPopular() {
  $('popular-cities').innerHTML = POPULAR_CITIES.map(
    (c) => `<button type="button" class="chip" data-city="${esc(c.name)}" title="${esc(c.name)}">${c.emoji} ${esc(c.name)}</button>`
  ).join('');
}

function wireEvents() {
  $('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = $('city-input').value.trim();
    if (!value) {
      $('search-hint').textContent = 'Type a city name first 🙂';
      $('city-input').focus();
      return;
    }
    fetchWeather(value);
  });

  $('popular-cities').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $('city-input').value = chip.dataset.city;
    fetchWeather(chip.dataset.city);
  });

  $('refresh-btn').addEventListener('click', () => fetchWeather(state.lastQuery));
  $('retry-btn').addEventListener('click', () => fetchWeather(state.lastQuery));

  $('tab-formatted').addEventListener('click', () => { state.activeTab = 'formatted'; renderJson(); });
  $('tab-raw').addEventListener('click', () => { state.activeTab = 'raw'; renderJson(); });

  $('season-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.season = chip.dataset.season;
    try { localStorage.setItem('skysignal.season', state.season); } catch (err) { /* storage unavailable */ }
    syncSeasonChips();
    applyScene();
  });

  $('copy-json').addEventListener('click', async () => {
    const text = state.activeTab === 'raw' ? state.raw : state.pretty;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const btn = $('copy-json');
    const original = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = original; }, 1600);
  });
}

function init() {
  Sky.mount($('sky-canvas'));
  try {
    const saved = localStorage.getItem('skysignal.season');
    if (saved && SEASON_META[saved]) state.season = saved;
  } catch (e) { /* storage unavailable */ }
  buildPopular();
  buildSeasonChips();
  wireEvents();
  fetchWeather(DEFAULT_CITY); // Mumbai loads automatically on launch
}

document.addEventListener('DOMContentLoaded', init);
