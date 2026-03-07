#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Load .env into process.env (if present)
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch (e) {
  // dotenv may not be installed in some environments; proceed anyway
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const out = `window.__ENV__ = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_KEY: key }, null, 2)};\n`;

const outPath = path.join(process.cwd(), 'public', '_env.js');
fs.writeFileSync(outPath, out, { encoding: 'utf8' });
console.log('Wrote', outPath);
