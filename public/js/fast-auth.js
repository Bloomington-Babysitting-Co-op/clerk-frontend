(function(){
  try {
    // Iterate all localStorage entries and look for anything that resembles
    // a Supabase auth/session token. Be permissive: different SDK versions
    // store different shapes and key names.
    for (let i = 0; i < (localStorage || {}).length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (!v) continue;

      // Quick hit on keys that usually contain auth data. Also explicitly
      // accept project-specific keys like `sb-<project>-auth-token`.
      if (!/supabase|\bsb\b|sb:|auth/i.test(k) && !/supabase|\bsb\b|sb:|auth/i.test(v) && !/-auth-token$/i.test(k)) continue;

      try {
        const parsed = JSON.parse(v);
        if (!parsed) continue;

        // Common token/session shapes across SDK versions
        if (parsed.access_token || parsed.refresh_token || parsed.currentSession || parsed.persistedSession || parsed.session || parsed.user) return;

        // Also inspect nested objects for token-like entries
        if (typeof parsed === 'object') {
          for (const val of Object.values(parsed)) {
            if (!val) continue;
            if (typeof val === 'object' && (val.access_token || val.refresh_token || val.user)) return;
            if (typeof val === 'string' && val.length > 20) return;
          }
        }
        // If a key ends with `-auth-token` it may be a plain string token
        if (/-auth-token$/i.test(k) && typeof v === 'string' && v.length > 20) return;
      } catch (e) {
        // If it's not JSON but a long string, assume it's a token
        if (typeof v === 'string' && v.length > 20) return;
      }
    }
  } catch (e) {}

  if (location.pathname !== '/login.html') location.replace('/login.html');
})();
