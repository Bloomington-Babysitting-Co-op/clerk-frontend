import { createClient } from "https://esm.sh/@supabase/supabase-js";

const env = typeof window !== "undefined" && window.__ENV__ ? window.__ENV__ : null;

const SUPABASE_URL = env?.SUPABASE_URL || null;
const SUPABASE_KEY = env?.SUPABASE_KEY || null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error(
		'Supabase config missing: ensure public/_env.js is generated and loaded (run `npm run generate-env` locally, set Cloudflare Pages secrets for build).'
	);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (typeof window !== 'undefined') window.supabase = supabase;
