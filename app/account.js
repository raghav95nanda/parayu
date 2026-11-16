'use strict';

window.ParayuAccount = (() => {
  const config = window.PARAYU_SUPABASE;
  const configured = Boolean(config?.url && config?.key);
  const page = new URL('./', location.href);
  const prefix = `parayu-account:${page.pathname}:${config?.url || ''}:`;
  const identityKey = prefix + 'identity';
  const sdkStorageKey = prefix + 'session';
  const authReturn = new URL(location.href).searchParams.has('parayu-auth');
  const recoveryLink = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
  let authError = new URLSearchParams(location.hash.slice(1)).get('error_code')
    || new URL(location.href).searchParams.get('error_code');
  let client, user = null, verified = false, syncError = '', syncing = false;
  let signOutRequested = false, recovering = false, queued = false, lastSync = 0;
  let mode = 'login';
  const memory = new Map();

  function get(key) {
    try { return localStorage.getItem(key) ?? memory.get(key); }
    catch { return memory.get(key); }
  }

  function put(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, value); } catch {}
  }

  function remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch {}
  }

  function savedUser() {
    try {
      if (!get(sdkStorageKey)) return null;
      const identity = JSON.parse(get(identityKey));
      return identity?.id ? identity : null;
    } catch { return null; }
  }

  // The locally remembered identity lets a signed-in learner keep practicing offline.
  // Only an authenticated Supabase session is used for network operations.
  if (configured && !authReturn) user = savedUser();

  function dayPrefix(id) { return prefix + `user:${id}:`; }
  function validDay(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '2024-01-01') return false;
    const parsed = new Date(`${day}T00:00:00Z`);
    return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === day;
  }
  function moveDay(day, offset) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }
  function savedDays(id) {
    const base = dayPrefix(id);
    const keys = new Set(memory.keys());
    try {
      for (let i = 0; i < localStorage.length; i++) keys.add(localStorage.key(i));
    } catch {}
    return new Map([...keys].filter(key => key?.startsWith(base)).map(key => [key.slice(base.length), get(key)]));
  }
  function guestDays() {
    return Object.entries(state.guestDays || state.days)
      .filter(([day, xp]) => xp > 0 && validDay(day)).map(([day]) => day);
  }
  function getStreakStats() {
    const today = dateKey();
    const dates = (user ? [...savedDays(user.id).keys()] : guestDays())
      .filter(day => validDay(day) && day <= today).sort();
    let run = 0, best = 0, previous = '';
    for (const day of dates) {
      run = previous && moveDay(previous, 1) === day ? run + 1 : 1;
      best = Math.max(best, run);
      previous = day;
    }
    const didPracticeToday = previous === today;
    const current = didPracticeToday || previous === moveDay(today, -1) ? run : 0;
    return { current, best, activityDays: dates.length, didPracticeToday };
  }
  function recordDay(day) {
    if (!user || !validDay(day)) return false;
    const key = dayPrefix(user.id) + day;
    if (!get(key)) { put(key, 'pending'); void sync(); }
    return true;
  }

  async function sync(force = false) {
    if (!client || !user || !verified || recovering || navigator.onLine === false) return;
    if (syncing) { queued = true; return; }
    const id = user.id;
    const pending = [...savedDays(id)].filter(([, status]) => status === 'pending').map(([day]) => day);
    if (!force && !pending.length && Date.now() - lastSync < 60_000) return;
    syncing = true;
    syncError = '';
    refresh();
    try {
      for (let i = 0; i < pending.length && user?.id === id; i += 100) {
        const days = pending.slice(i, i + 100);
        const rows = days.map(day => ({ user_id: id, practice_date: day }));
        const { error } = await client.from('parayu_practice_days')
          .upsert(rows, { onConflict: 'user_id,practice_date', ignoreDuplicates: true });
        if (error) throw error;
        for (const day of days) put(dayPrefix(id) + day, 'synced');
      }
      let after = '2023-12-31';
      while (user?.id === id) {
        const { data, error } = await client.from('parayu_practice_days').select('practice_date')
          .eq('user_id', id).gt('practice_date', after).order('practice_date').limit(100);
        if (error) throw error;
        if (!data.length) break;
        for (const { practice_date: day } of data) {
          if (validDay(day)) put(dayPrefix(id) + day, 'synced');
        }
        after = data.at(-1).practice_date;
      }
      if (user?.id === id) lastSync = Date.now();
    } catch (error) {
      if (user?.id === id) {
        syncError = ['PGRST205', '42P01', '42501'].includes(error.code)
          ? 'Streak sync needs the Supabase table and permissions in setup.sql.'
          : 'Couldn’t sync. Your practice is saved here and will sync when you reconnect.';
      }
    } finally {
      syncing = false;
      refresh();
      if (queued) { queued = false; void sync(true); }
    }
  }

  function statusText() {
    if (!user) return 'Your streak is saved on this device. Log in to sync it across devices.';
    if (recovering) return 'Set your new password to finish signing in.';
    if (syncError) return syncError;
    if (navigator.onLine === false || !verified) return 'Practice is saved offline and will sync when you reconnect.';
    if (syncing) return 'Syncing your practice days…';
    return 'Your streak is synced across devices.';
  }
  function streakCard() {
    const stats = getStreakStats();
    return `<section class="account-streak-card" aria-label="Practice streak"><h2>Practice streak</h2>
      <div class="account-streak-grid">
        <div><strong data-streak-current>${stats.current}</strong><span>Current streak</span></div>
        <div><strong data-streak-best>${stats.best}</strong><span>Longest streak</span></div>
        <div><strong data-streak-total>${stats.activityDays}</strong><span>Days practised</span></div>
      </div>
      <p data-streak-today>${stats.didPracticeToday ? 'Today’s practice counts.' : 'Finish a lesson, roleplay, or review to count today.'}</p>
      <div class="account-streak-footer"><p data-streak-status role="status">${esc(statusText())}</p>
      <button class="btn light" type="button" data-account="open" data-account-streak-label>${user ? 'Manage account' : 'Log in'}</button></div></section>`;
  }
  function refresh() {
    const stats = getStreakStats();
    const bind = (selector, text) => document.querySelectorAll(selector).forEach(node => {
      if (node.textContent !== String(text)) node.textContent = text;
    });
    bind('[data-streak-current]', stats.current);
    bind('[data-streak-best]', stats.best);
    bind('[data-streak-total]', stats.activityDays);
    bind('[data-streak-unit]', stats.current === 1 ? 'day' : 'days');
    bind('[data-streak-today]', stats.didPracticeToday ? 'Today’s practice counts.' : 'Finish a lesson, roleplay, or review to count today.');
    bind('[data-streak-status]', statusText());
    bind('[data-account-streak-label]', user ? 'Manage account' : 'Log in');
    bind('[data-account-label]', user ? 'Account' : 'Log in');
  }

  function authMessage(message) {
    const node = document.querySelector('#account-message');
    if (node) node.textContent = message;
  }
  function dialog(kind = 'login', message = '') {
    mode = kind;
    let body;
    if (!configured || !client) {
      body = `<h1>Parayu account</h1><p>Account login becomes available when this site is connected to Supabase. You can keep practising and building a streak on this device.</p>`;
    } else if (user && kind !== 'recover') {
      const canImport = guestDays().some(day => !get(dayPrefix(user.id) + day));
      body = `<h1>Your account</h1><p>Signed in as <strong>${esc(user.email || 'your email')}</strong></p>
        <p data-streak-status role="status">${esc(statusText())}</p>
        <div class="account-actions">
          ${recovering ? '<button class="btn" type="button" data-account="recover">Set new password</button>' : ''}
          ${canImport && !recovering ? '<button class="btn light" type="button" data-account="import">Add practice days from this device</button>' : ''}
          <button class="btn light" type="button" data-account="sync">Sync now</button>
          <button class="textbtn" type="button" data-account="logout">Log out</button>
        </div>`;
    } else {
      const headings = { login: 'Log in to Parayu', signup: 'Create an account', reset: 'Reset your password', recover: 'Set a new password' };
      const buttons = { login: 'Log in', signup: 'Create account', reset: 'Send reset link', recover: 'Save new password' };
      const passwordField = kind === 'reset' ? '' : `<label>Password<input name="password" type="password" autocomplete="${kind === 'login' ? 'current-password' : 'new-password'}" ${kind === 'login' ? '' : 'minlength="8"'} required></label>`;
      body = `<h1>${headings[kind]}</h1><p>${kind === 'reset' ? 'We’ll email you a link to set a new password.' : kind === 'signup' ? 'Use an email address you can verify. Choose a password with at least eight characters.' : kind === 'recover' ? 'Choose a password with at least eight characters.' : 'Keep your practice streak when you switch devices.'}</p>
        <form id="account-form" class="account-form">
          ${kind === 'recover' ? '' : '<label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required></label>'}
          ${passwordField}<button class="btn" type="submit">${buttons[kind]}</button>
        </form>
        <div class="account-actions">${kind === 'login' ? '<button class="textbtn" type="button" data-account="signup">Create account</button><button class="textbtn" type="button" data-account="reset">Forgot password?</button>' : kind === 'recover' ? '' : '<button class="textbtn" type="button" data-account="login">Back to login</button>'}</div>`;
    }
    session = null;
    openDialog(`${modalHeader('ACCOUNT')}<section class="account-dialog">${body}<p id="account-message" role="status">${esc(message)}</p></section>`);
  }

  function redirectURL() {
    const url = new URL(page);
    url.searchParams.set('parayu-auth', '1');
    return url.href;
  }
  function authFeedback(error) {
    if (navigator.onLine === false || error.status === 0 || error.name === 'AuthRetryableFetchError') return 'Connect to the internet and try again.';
    if (error.code === 'email_not_confirmed') return 'Check your email and confirm your address before logging in.';
    if (error.code === 'invalid_credentials') return 'That email or password didn’t match. Try again or reset your password.';
    if (error.status === 429) return 'Too many attempts. Wait a little before trying again.';
    return error.message || 'Something went wrong. Please try again.';
  }
  async function submit(event) {
    const form = event.target;
    if (form.id !== 'account-form') return;
    event.preventDefault();
    if (!client || form.dataset.busy) return;
    const kind = mode;
    const values = new FormData(form);
    const email = values.get('email')?.trim();
    const password = values.get('password');
    const button = form.querySelector('button');
    form.dataset.busy = 'true';
    button.disabled = true;
    authMessage('One moment…');
    try {
      let result;
      if (kind === 'login') result = await client.auth.signInWithPassword({ email, password });
      if (kind === 'signup') result = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectURL() } });
      if (kind === 'reset') result = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectURL() });
      if (kind === 'recover') result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
      if (kind === 'recover') { recovering = false; void sync(true); }
      if (!form.isConnected) return;
      if (kind === 'signup' && !result.data.session) dialog('login', 'Check your email for a confirmation link, then log in.');
      else if (kind === 'reset') dialog('login', 'If that address has an account, you’ll receive a password reset link.');
      else dialog('login', kind === 'recover' ? 'Your password has been updated.' : 'You’re signed in.');
    } catch (error) {
      if (form.isConnected) authMessage(authFeedback(error));
    } finally {
      form.dataset.busy = '';
      button.disabled = false;
    }
  }

  async function logout(button) {
    if (!client || signOutRequested) return;
    signOutRequested = true;
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      if (button.isConnected) dialog('login', 'You’re logged out.');
    } catch (error) { if (button.isConnected) authMessage(authFeedback(error)); }
    finally { signOutRequested = false; button.disabled = false; }
  }

  function start() {
    refresh();
    if (!configured || !window.supabase) return;
    client = window.supabase.createClient(config.url, config.key, {
      auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true, storageKey: sdkStorageKey }
    });
    client.auth.onAuthStateChange((event, authSession) => {
      const next = authSession?.user;
      const changed = user?.id !== next?.id;
      if (next) {
        user = { id: next.id, email: next.email };
        put(identityKey, JSON.stringify(user));
        verified = true;
      } else if (event === 'SIGNED_OUT' || navigator.onLine !== false) {
        user = null;
        remove(identityKey);
        verified = false;
        recovering = false;
      }
      if (changed) { lastSync = 0; syncError = ''; }
      if (event === 'PASSWORD_RECOVERY' || (recoveryLink && authReturn && next && !authError && event === 'INITIAL_SESSION')) recovering = true;
      // Supabase callbacks run under the auth lock. Defer all SDK calls.
      setTimeout(() => {
        refresh();
        if (recovering && (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) dialog('recover');
        if (authReturn && event === 'INITIAL_SESSION') {
          history.replaceState(null, '', page.pathname);
          if (authError) dialog('login', 'This email link expired or was already used. Request a fresh link.');
          else if (next && !recovering) dialog('login', 'Your email is confirmed.');
          authError = '';
        }
        if (changed && event === 'SIGNED_OUT' && !signOutRequested && document.querySelector('.account-dialog')) dialog('login');
        if (next && !recovering) void sync(changed);
      }, 0);
    });
    window.addEventListener('online', () => {
      refresh();
      if (user && !verified) void client.auth.refreshSession().then(result => {
        if (!result.error) void sync(true);
        else { syncError = authFeedback(result.error); refresh(); }
      });
      else void sync(true);
    });
    window.addEventListener('offline', refresh);
    window.addEventListener('storage', event => {
      if (user && event.key?.startsWith(dayPrefix(user.id))) refresh();
    });
  }

  document.addEventListener('submit', event => { void submit(event); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-account]');
    const action = button?.dataset.account;
    if (!action) return;
    if (action === 'logout') { void logout(button); return; }
    if (action === 'sync') { refresh(); void sync(true); return; }
    if (action === 'import' && user) {
      for (const day of guestDays()) {
        const key = dayPrefix(user.id) + day;
        if (!get(key)) put(key, 'pending');
      }
      dialog('login', 'Your practice days were added to this account.');
      void sync(true);
      return;
    }
    dialog(action === 'open' ? 'login' : action);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { refresh(); void sync(); }
  });
  window.addEventListener('DOMContentLoaded', start);

  return { getStreakStats, recordDay, streakCard, isSignedIn: () => Boolean(user) };
})();
