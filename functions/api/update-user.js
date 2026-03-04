export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') return new Response(null, { status: 405 });

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { userId, email } = body || {};
  if (!userId || !email) return new Response(JSON.stringify({ error: 'Missing userId or email' }), { status: 400 });

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });

  const base = SUPABASE_URL.replace(/\/+$/, '');
  const authAdminUrl = `${base}/auth/v1/admin/users`;

  // Update auth user email via admin endpoint
  const upd = await fetch(`${authAdminUrl}/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY
    },
    body: JSON.stringify({ email: email, email_confirm: true })
  });

  const result = await upd.json().catch(() => null);
  if (!upd.ok) {
    return new Response(JSON.stringify({ error: result || 'Failed to update user' }), { status: upd.status });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
