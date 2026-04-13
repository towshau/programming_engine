# Login Page — Standalone HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign In — Locker Room Gym</title>
<style>
  :root {
    /* Brand */
    --color-gold: #b8860b;
    --color-gold-light: #d4a017;
    --color-gold-50: #fef9c3;
    --color-gold-100: #fde68a;

    /* Backgrounds */
    --bg: #f0f2f5;
    --bg2: #ffffff;
    --bg3: #f6f8fa;

    /* Text */
    --text: #1a1f2e;
    --text-muted: #6b7280;

    /* Borders */
    --border: #e2e8f0;

    /* Status */
    --red: #dc2626;
    --red-bg: #fee2e2;
    --red-border: #fecaca;

    /* Shadows */
    --shadow-sm: 0 1px 4px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.10);

    /* Inputs */
    --input-bg: var(--bg2);
    --input-border: var(--border);
    --input-focus: rgba(184, 134, 11, 0.35);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Loading state */
  #auth-check {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: var(--text-muted);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
  }
  .check-spinner {
    width: 24px; height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Card */
  #login-wrap {
    display: none;
    width: 100%;
    max-width: 460px;
    padding: 24px;
  }

  .login-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 44px 40px;
    box-shadow: var(--shadow-md), 0 0 0 1px rgba(0,0,0,0.02);
  }

  /* Header */
  .card-header {
    text-align: center;
    margin-bottom: 32px;
  }
  .brand-icon {
    width: 48px; height: 48px;
    background: var(--color-gold);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 18px;
    color: #ffffff;
    font-weight: 900;
    font-size: 16px;
    letter-spacing: 0.02em;
  }
  .card-header h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.02em;
    margin-bottom: 6px;
  }
  .card-header p {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* Google button */
  .google-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 20px;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    margin-bottom: 24px;
    font-family: inherit;
  }
  .google-btn:hover:not(:disabled) {
    background: var(--bg3);
    border-color: #cbd5e1;
    box-shadow: var(--shadow-sm);
  }
  .google-btn:active:not(:disabled) { box-shadow: none; }
  .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Divider */
  .divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 24px;
  }
  .divider-line { flex: 1; height: 1px; background: var(--border); }
  .divider-text {
    font-size: 11px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 500;
  }

  /* Form */
  .form-group { margin-bottom: 18px; }
  .form-group label {
    display: block;
    font-size: 13px;
    color: var(--text);
    font-weight: 500;
    margin-bottom: 6px;
  }
  .form-group input {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 10px;
    padding: 12px 14px;
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .form-group input:focus {
    border-color: var(--color-gold);
    box-shadow: 0 0 0 3px rgba(184, 134, 11, 0.12);
  }
  .form-group input::placeholder { color: #9ca3af; }
  .form-group input:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Error */
  #error-msg {
    background: var(--red-bg);
    border: 1px solid var(--red-border);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 18px;
    font-size: 13px;
    color: var(--red);
    display: none;
    align-items: flex-start;
    gap: 10px;
    line-height: 1.5;
  }
  #error-msg.visible { display: flex; }

  /* Submit button */
  .submit-btn {
    width: 100%;
    background: var(--color-gold);
    border: none;
    border-radius: 10px;
    padding: 12px 20px;
    color: #ffffff;
    font-size: 14px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 6px;
  }
  .submit-btn:hover:not(:disabled) {
    background: var(--color-gold-light);
    box-shadow: var(--shadow-sm);
  }
  .submit-btn:active:not(:disabled) { box-shadow: none; }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
  .submit-btn:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 2px;
  }

  .btn-spinner {
    width: 15px; height: 15px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .btn-spinner-muted {
    width: 15px; height: 15px;
    border: 2px solid var(--border);
    border-top-color: var(--text-muted);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .card-footer {
    text-align: center;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: #9ca3af;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
  }
</style>
</head>
<body>

<div id="auth-check">
  <div class="check-spinner"></div>
  CHECKING SESSION
</div>

<div id="login-wrap">
  <div class="login-card">

    <div class="card-header">
      <div class="brand-icon">LR</div>
      <h1>Coach OS</h1>
      <p>Sign in to access the staff portal</p>
    </div>

    <!-- Google OAuth — mirrors src/lib/auth.js signInWithGoogle() -->
    <button class="google-btn" id="google-btn" type="button">
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.63l6.9-6.9C35.95 2.47 30.42 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.04 6.24C12.57 13.41 17.88 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.09-.4-4.55H24v9.02h12.94c-.56 3-2.25 5.55-4.8 7.25l7.36 5.7c4.3-3.97 6.78-9.82 6.78-17.42z"/>
        <path fill="#FBBC05" d="M10.6 28.54A14.5 14.5 0 0 1 9.5 24c0-1.57.28-3.09.78-4.54l-8.04-6.24A24 24 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l8.04-6.24z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.9-5.8l-7.36-5.7c-2.05 1.38-4.68 2.2-8.54 2.2-6.12 0-11.43-3.91-13.4-9.46l-8.04 6.24C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
    </button>

    <div class="divider">
      <div class="divider-line"></div>
      <span class="divider-text">OR</span>
      <div class="divider-line"></div>
    </div>

    <!-- Email / Password — mirrors src/lib/auth.js signIn() -->
    <form id="login-form" novalidate>
      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email"
               placeholder="you@example.com" autocomplete="email" required />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password"
               placeholder="••••••••" autocomplete="current-password" required />
      </div>

      <div id="error-msg" role="alert">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span id="error-text"></span>
      </div>

      <button type="submit" class="submit-btn" id="submit-btn">Sign In</button>
    </form>

    <div class="card-footer">LOCKER ROOM GYM — STAFF PORTAL</div>
  </div>
</div>

<script src="/config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>
// ─── Supabase client — credentials loaded from config.js ─────────────────────
const { createClient } = window.supabase;
const sbClient = createClient(window.__config.SUPABASE_URL, window.__config.SUPABASE_ANON_KEY);

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const authCheck  = document.getElementById('auth-check');
const loginWrap  = document.getElementById('login-wrap');
const loginForm  = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passInput  = document.getElementById('password');
const submitBtn  = document.getElementById('submit-btn');
const googleBtn  = document.getElementById('google-btn');
const errorMsg   = document.getElementById('error-msg');
const errorText  = document.getElementById('error-text');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showError(msg) {
  errorText.textContent = msg;
  errorMsg.classList.add('visible');
}
function clearError() {
  errorMsg.classList.remove('visible');
  errorText.textContent = '';
}
function setLoading(on) {
  submitBtn.disabled  = on;
  googleBtn.disabled  = on;
  emailInput.disabled = on;
  passInput.disabled  = on;
  submitBtn.innerHTML = on
    ? '<div class="btn-spinner"></div> Signing in…'
    : 'Sign In';
}

// ─── syncUserWithDatabase — ported from src/lib/auth.js ──────────────────────
async function syncUserWithDatabase() {
  try {
    const { data: userData, error: userError } = await sbClient.auth.getUser();
    if (userError || !userData?.user?.id) return;

    const user = userData.user;

    const { data: byAuthId } = await sbClient
      .from('staff_database')
      .select('*')
      .eq('auth_id', user.id)
      .maybeSingle();
    if (byAuthId) return;

    const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
    if (normalizedEmail) {
      const { data: byEmail } = await sbClient
        .from('staff_database')
        .select('*')
        .eq('personal_email', normalizedEmail)
        .maybeSingle();

      if (byEmail) {
        if (byEmail.auth_id && byEmail.auth_id !== user.id) return;
        if (byEmail.auth_id === user.id) return;

        await sbClient
          .from('staff_database')
          .update({ auth_id: user.id })
          .eq('personal_email', normalizedEmail);
        return;
      }
    }

    const fullName = user.user_metadata?.full_name || '';
    const [firstToken = '', ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
    await sbClient.from('staff_database').insert({
      auth_id:        user.id,
      personal_email: normalizedEmail,
      first_name:     firstToken || null,
      last_name:      rest.length ? rest.join(' ') : null,
      mobile_number:  null,
    });
  } catch (err) {
    console.error('syncUserWithDatabase error:', err);
  }
}

// ─── Check existing session ───────────────────────────────────────────────────
(async () => {
  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
      window.location.replace('/');
      return;
    }
  } catch (_) {}

  authCheck.style.display = 'none';
  loginWrap.style.display = 'block';
})();

// ─── Email / Password login ──────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email    = emailInput.value.trim();
  const password = passInput.value;
  if (!email || !password) { showError('Please enter your email and password.'); return; }

  setLoading(true);

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) { setLoading(false); showError(error.message); return; }

  await syncUserWithDatabase();

  setLoading(false);
  window.location.replace('/');
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
googleBtn.addEventListener('click', async () => {
  clearError();
  googleBtn.disabled = true;
  googleBtn.innerHTML = '<div class="btn-spinner-muted"></div> Redirecting to Google…';

  const appUrl = window.__config?.APP_URL || window.location.origin;
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${appUrl}/` },
  });

  if (error) {
    googleBtn.disabled = false;
    googleBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.63l6.9-6.9C35.95 2.47 30.42 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.04 6.24C12.57 13.41 17.88 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.09-.4-4.55H24v9.02h12.94c-.56 3-2.25 5.55-4.8 7.25l7.36 5.7c4.3-3.97 6.78-9.82 6.78-17.42z"/>
        <path fill="#FBBC05" d="M10.6 28.54A14.5 14.5 0 0 1 9.5 24c0-1.57.28-3.09.78-4.54l-8.04-6.24A24 24 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l8.04-6.24z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.9-5.8l-7.36-5.7c-2.05 1.38-4.68 2.2-8.54 2.2-6.12 0-11.43-3.91-13.4-9.46l-8.04 6.24C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google`;
    showError(error.message);
  }
});
</script>
</body>
</html>
```
