// Local demo — copy from your real deployment or .env when testing auth.
// Set DEMO_UI_ONLY to false and add real SUPABASE_* values to exercise sign-in.
window.__config = {
  DEMO_UI_ONLY: true,
  APP_URL: typeof location !== 'undefined' ? location.origin : 'http://localhost:8765',
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
};
