const test = require('node:test');
const assert = require('node:assert');
const createCore = require('../app/core.js');

const res = (status, data = {}, headers = {}) => ({ ok: status < 300, status, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => data });
function make(handler, extra = {}) {
  const calls = []; let key = 're_test', saved = null;
  const core = createCore({
    fetch: async (url, o) => { calls.push({ url, ...o, at: Date.now() }); return handler(url, o, calls.length); },
    load: async () => saved, save: async d => { saved = JSON.parse(JSON.stringify(d)); },
    getKey: async () => key, setKey: async v => { key = v; return 'keychain'; }, delKey: async () => { key = null; },
    ...extra
  });
  return { core, calls, key: () => key };
}

test('requests are spaced for the 2 per second limit', async () => {
  const { core, calls } = make(() => res(200, { data: [], has_more: false }));
  await core('sync'); // sent + inbox = 2 calls
  assert.equal(calls.length, 2);
  assert.ok(calls[1].at - calls[0].at >= 500, 'second call came too soon');
});

test('429 is retried after the wait Resend asks for', async () => {
  let n = 0;
  const { core, calls } = make(() => ++n === 1 ? res(429, { name: 'rate_limit_exceeded' }, { 'retry-after': '1' }) : res(200, { id: 'a1' }));
  const t = Date.now(); const r = await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't' });
  assert.equal(r.ok, true); assert.equal(calls.length, 2); assert.ok(Date.now() - t >= 900);
});

test('a daily quota 429 is not retried', async () => {
  const { core, calls } = make(() => res(429, { name: 'daily_quota_exceeded', message: 'Daily quota hit' }));
  const r = await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't' });
  assert.equal(r.ok, false); assert.equal(calls.length, 1); assert.match(r.error, /Daily quota/);
});

test('sends carry one idempotency key and survive a network blip without duplicating', async () => {
  let n = 0;
  const { core, calls } = make(() => { if (++n === 1) throw new Error('offline'); return res(200, { id: 'a1' }); });
  const r = await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't' });
  assert.equal(r.ok, true); assert.equal(calls.length, 2);
  assert.ok(calls[0].headers['Idempotency-Key']);
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
});

test('the local daily limit blocks a send unless forced', async () => {
  const { core, calls } = make((u, o) => o.method === 'POST' ? res(200, { id: 'new' }) : res(200, { data: [], has_more: false }));
  await core('settings', { dayLimit: 1 });
  assert.equal((await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't' })).ok, true);
  const n = calls.length;
  const blocked = await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't' });
  assert.equal(blocked.ok, false); assert.equal(blocked.limit, 'day'); assert.equal(calls.length, n, 'nothing was sent');
  const forced = await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't', force: true });
  assert.equal(forced.ok, true);
  assert.equal(JSON.parse(calls[calls.length - 1].body).force, undefined, 'force must not reach Resend');
});

test('the key never appears in state and keyDel removes it but keeps mail', async () => {
  const { core, key } = make(() => res(200, { data: [], has_more: false }));
  const st = await core('state');
  assert.equal(st.hasKey, true); assert.ok(!JSON.stringify(st).includes('re_test'));
  await core('keyDel');
  assert.equal(key(), null); assert.equal((await core('state')).hasKey, false);
});

test('signout wipes key and mail', async () => {
  const { core, key } = make((u, o) => o.method === 'POST' ? res(200, { id: 'x' }) : res(200, { data: [], has_more: false }));
  await core('send', { from: 'a@b.co', to: ['c@d.co'], subject: 's', text: 't' });
  await core('signout');
  const st = await core('state'); assert.equal(key(), null); assert.equal(st.sent.length, 0);
});

test('unknown commands are refused', async () => {
  const { core } = make(() => res(200));
  await assert.rejects(() => core('getKey'), /blocked/);
  await assert.rejects(() => core('constructor'), /blocked/);
});
