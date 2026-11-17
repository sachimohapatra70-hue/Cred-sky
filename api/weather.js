/**
 * SkySignal - weather proxy
 * Vercel serverless function. Keeps WEATHER_API_KEY server-side only.
 *
 * GET /api/weather?q=<city>   (defaults to Mumbai)
 *
 * Upstream: WeatherAPI.com /v1/current.json with aqi=yes
 * The upstream response body is passed through untouched, so the
 * "Raw JSON" view in the UI is byte-for-byte the API response.
 */

const UPSTREAM = 'https://api.weatherapi.com/v1/current.json';

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({
        error: { code: 405, message: 'Only GET requests are supported.' },
      });
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: {
          code: 500,
          message: 'Server misconfiguration: WEATHER_API_KEY environment variable is not set.',
        },
      });
    }

    const q = String((req.query && req.query.q) || '').trim() || 'Mumbai';
    const url = `${UPSTREAM}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&aqi=yes`;

    let upstream;
    try {
      upstream = await fetch(url, { headers: { accept: 'application/json' } });
    } catch (networkErr) {
      return res.status(502).json({
        error: { code: 502, message: 'Could not reach the weather service. Please retry.' },
      });
    }

    const bodyText = await upstream.text();
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseErr) {
      return res.status(502).json({
        error: { code: 502, message: 'Weather service returned an unreadable response.' },
      });
    }

    if (!upstream.ok) {
      const apiError =
        data && data.error ? data.error : { code: upstream.status, message: 'Weather service error.' };
      return res.status(upstream.status).json({ error: apiError });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=180, stale-while-revalidate=300');
    return res.status(200).send(bodyText);
  } catch (err) {
    return res.status(500).json({
      error: { code: 500, message: 'Unexpected server error.' },
    });
  }
};
