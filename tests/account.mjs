import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/account.js', import.meta.url), 'utf8');
const data = new Map();
const remote = new Map([['alice', new Set(['2025-01-30', '2025-01-31'])], ['bob', new Set()]]);
const windowEvents = new Map(), documentEvents = new Map();
const href = 'https://test.github.io/parayu/';
let authCallback;
let currentDay = '2025-02-01';
const browser = { onLine: true };
const localStorage = {
  get length() { return data.size; },
  key(i) { return [...data.keys()][i]; },
  getItem(k) { return data.get(k) ?? null; },
  setItem(k, v) { data.set(k, v); },
  removeItem(k) { data.delete(k); }
};
const client = {
  auth: { onAuthStateChange(callback) { authCallback = callback; } },
  from(table) {
    assert.equal(table, 'parayu_practice_days');
    return {
      async upsert(rows, options) {
        assert.equal(browser.onLine, true);
        assert.deepEqual({ ...options }, { onConflict: 'user_id,practice_date', ignoreDuplicates: true });
        for (const row of rows) remote.get(row.user_id).add(row.practice_date);
        return { error: null };
      },
      select(column) {
        assert.equal(column, 'practice_date');
        let id, cursor;
        return {
          eq(_, value) { id = value; return this; },
          gt(_, value) { cursor = value; return this; },
          order() { return this; },
          async limit(n) {
            return { error: null, data: [...remote.get(id)].sort().filter(day => day > cursor).slice(0, n).map(practice_date => ({ practice_date })) };
          }
        };
      }
    };
  }
};
const window = {
  PARAYU_SUPABASE: {url:'https://test.supabase.co',key:'sb_publishable_test'},
  supabase: { createClient: () => client },
  addEventListener: (event, handler) => windowEvents.set(event, handler)
};
const context = vm.createContext({ window, document: {
  addEventListener: (event, handler) => documentEvents.set(event, handler),
  querySelector: () => null, querySelectorAll: () => []
}, localStorage, navigator: browser, location: { href, hash: '' }, URL, URLSearchParams, setTimeout,
state: { days: { '2025-01-31': 20 }, guestDays: { '2025-01-31': 20 } }, dateKey: () => currentDay });
vm.runInContext(source, context);
const account = window.ParayuAccount;
const stats = () => ({...account.getStreakStats()});
const flush = () => new Promise(resolve => setTimeout(resolve, 20));
assert.deepEqual(stats(), { current: 1, best: 1, activityDays: 1, didPracticeToday: false });
assert.equal(account.recordDay(currentDay), false, 'Guest practice stays in the app’s local state');
windowEvents.get('DOMContentLoaded')();
authCallback('INITIAL_SESSION', { user: { id: 'alice', email: 'alice@example.test' } });
await flush();
assert.equal(stats().current, 2);
browser.onLine = false;
assert.equal(account.recordDay(currentDay), true);
assert.equal(account.recordDay(currentDay), true);
assert.equal(stats().current, 3);
assert.equal(stats().activityDays, 3);
assert.ok(!remote.get('alice').has(currentDay), 'Offline completions are queued');
browser.onLine = true;
windowEvents.get('online')();
await flush();
assert.equal(remote.get('alice').size, 3, 'Reconnection syncs one row per date');
currentDay = '2025-02-03';
assert.equal(stats().current, 0, 'A missed day resets the current streak');
assert.equal(stats().best, 3, 'Longest streak is retained');
authCallback('SIGNED_OUT', null);
authCallback('SIGNED_IN', { user: { id: 'bob', email: 'bob@example.test' } });
await flush();
assert.equal(stats().activityDays, 0, 'Switching accounts does not carry over another learner’s days');
assert.equal(remote.get('bob').size, 0, 'Guest days require an explicit import');
console.log('Passed: guest streak, cloud history, offline practice, reconnect and duplicate handling, missed-day reset, longest streak, account switching.');
