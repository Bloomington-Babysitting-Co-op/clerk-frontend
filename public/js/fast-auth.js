(function(){
  try {
    const keys = Object.keys(localStorage || {});
    for (const k of keys) {
      if (/supabase|sb:|supabase.auth/i.test(k)) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const parsed = JSON.parse(v);
          if (parsed && (parsed.access_token || parsed.currentSession || parsed.user)) return;
        } catch (e) {
          if (typeof v === 'string' && v.length > 20) return;
        }
      }
    }
  } catch (e) {}
  if (location.pathname !== '/login.html') location.replace('/login.html');
})();
