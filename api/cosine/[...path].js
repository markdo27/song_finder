/**
 * api/cosine/[...path].js
 * Vercel Node.js serverless function — proxies all /api/cosine/* to cosine.club.
 * API key is stored in the COSINE_API_KEY env var (never sent to the browser).
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cosineKey = process.env.COSINE_API_KEY || '';
  if (!cosineKey) return res.status(500).json({ message: 'COSINE_API_KEY env var not set on server' });

  // Strip /api/cosine prefix to get the cosine.club sub-path
  const subpath = req.url.replace(/^\/api\/cosine/, '') || '/';
  const url = `https://cosine.club/api/v1${subpath}`;

  try {
    const init = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${cosineKey}`,
        'Content-Type': 'application/json',
      },
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      init.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(url, init);
    const text = await upstream.text();
    res.status(upstream.status)
      .setHeader('Content-Type', 'application/json')
      .send(text);
  } catch (err) {
    res.status(502).json({ message: `Proxy error: ${err.message}` });
  }
}
