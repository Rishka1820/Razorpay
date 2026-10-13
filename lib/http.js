export function originOf(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = req.headers;
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host && host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function route(fn) {
  return async (req, ctx) => {
    try {
      const out = await fn(req, ctx);
      return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      const status = e.status || 400;
      if (status >= 500) console.error(e);
      return Response.json({ error: e.message || 'Something went wrong' }, { status });
    }
  };
}
