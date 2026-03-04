export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') return new Response(null, { status: 405 });

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { userId } = body || {};
  if (!userId) return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });

  const base = SUPABASE_URL.replace(/\/+$/, '');
  const authAdminUrl = `${base}/auth/v1/admin/users`;

  // Delete auth user via GoTrue admin endpoint (no family checks)
  const authDel = await fetch(`${authAdminUrl}/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY
    }
  });

  if (!authDel.ok) {
    const err = await authDel.text().catch(() => null);
    return new Response(JSON.stringify({ error: err || 'Failed to delete auth user' }), { status: authDel.status });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
