export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') return new Response(null, { status: 405 });

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Missing email or password' }), { status: 400 });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const base = SUPABASE_URL.replace(/\/+$/, '');
  const authUrl = `${base}/auth/v1/admin/users`;

  const createRes = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY
    },
    body: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { provider: 'email' }
    })
  });

  const created = await createRes.json().catch(() => null);
  if (!createRes.ok) {
    return new Response(JSON.stringify({ error: created || 'Failed to create user' }), { status: createRes.status });
  }

  const userId = created?.id || created?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'No user id returned' }), { status: 500 });
  }
  return new Response(JSON.stringify({ userId }), { status: 200 });
}
