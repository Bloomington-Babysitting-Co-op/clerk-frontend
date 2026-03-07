export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') return new Response(null, { status: 405 });

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { path, expires } = body || {};
  if (!path) return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 });

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });

  // Require an Authorization header (Bearer access token) to ensure caller is authenticated
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401 });

  const base = SUPABASE_URL.replace(/\/+$/, '');

  // Validate token by fetching /auth/v1/user
  try {
    const userRes = await fetch(`${base}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        apikey: SERVICE_KEY
      }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Token validation failed' }), { status: 401 });
  }

  const bucket = 'family-photos';
  const expiresIn = Number(expires) || 60;

  try {
    const signUrl = `${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY
      },
      body: JSON.stringify({ expiresIn })
    });

    const data = await signRes.json().catch(() => null);
    if (!signRes.ok) {
      return new Response(JSON.stringify({ error: data || 'Failed to create signed url' }), { status: signRes.status });
    }

    // try common response keys
    const signed = data?.signedURL || data?.signedUrl || data?.signed || data?.publicURL || data?.publicUrl || null;
    if (!signed) return new Response(JSON.stringify({ error: 'No signed url returned' }), { status: 500 });

    return new Response(JSON.stringify({ signedUrl: signed }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), { status: 500 });
  }
}
