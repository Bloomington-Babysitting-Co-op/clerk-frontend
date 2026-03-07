export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') return new Response(null, { status: 405 });

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { email } = body || {};
  if (!email) return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });

  const base = SUPABASE_URL.replace(/\/+$/, '');
  const recoverUrl = `${base}/auth/v1/recover`;

  try {
    const resp = await fetch(recoverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY
      },
      body: JSON.stringify({ email })
    });

    const result = await resp.json().catch(() => null);
    if (!resp.ok) return new Response(JSON.stringify({ error: result || 'Failed to send reset' }), { status: resp.status });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Error sending reset' }), { status: 500 });
  }
}
