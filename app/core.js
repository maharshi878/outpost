// Shared by Electron (desktop) and Capacitor (Android). No DOM, no Node APIs.
(function (root) {
  function createCore(env) {
    const blank = () => ({ sent: {}, inbox: {}, drafts: [], settings: {}, mode: 'full', lastSync: 0 });
    const ts = s => new Date(String(s).replace(' ', 'T').replace(/\+00$/, 'Z')).getTime() || 0;
    const sorted = o => Object.values(o).sort((a, b) => ts(b.created_at) - ts(a.created_at)).map(e => ({ ...e }));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let db = null, ready = null, last = 0;
    const init = () => ready || (ready = Promise.resolve(env.load()).then(d => { db = { ...blank(), ...(d || {}) }; }));
    const save = () => env.save(db);

    // The only network code. Resend allows 2 requests per second, so calls are spaced out.
    // 429 is retried after the wait Resend asks for, unless it is a daily or monthly quota (waiting will not help).
    // GETs and sends that carry an Idempotency-Key are also retried on network errors and 5xx, so a flaky
    // connection can never produce a duplicate email.
    async function call(method, url, body, key, extra) {
      key = key || await env.getKey();
      const safe = method === 'GET' || !!(extra && extra['Idempotency-Key']);
      for (let i = 0; i < 5; i++) {
        const w = last + 550 - Date.now(); last = Date.now() + Math.max(w, 0); if (w > 0) await sleep(w);
        let res;
        try {
          res = await env.fetch('https://api.resend.com' + url, {
            method,
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': 'outpost/0.2', ...(extra || {}) },
            body: body ? JSON.stringify(body) : undefined
          });
        } catch (e) {
          if (safe && i < 3) { await sleep(900 * (i + 1)); continue; }
          return { ok: false, status: 0, error: 'Could not reach Resend. Check your connection.' };
        }
        if (res.status >= 500 && safe && i < 3) { await sleep(900 * (i + 1)); continue; }
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          if (/quota/i.test(data.name || '')) return { ok: false, status: 429, data, quota: true, error: data.message || 'Resend quota reached.' };
          await sleep(Math.min(30, +res.headers.get('retry-after') || 1) * 1000); continue;
        }
        return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data.message || 'Request failed (' + res.status + ')') };
      }
      return { ok: false, status: 429, error: 'Resend is rate limiting requests. Try again shortly.' };
    }

    // Sending limits, counted from what Resend recorded for this key (UTC days and months, like the meters).
    const limits = () => ({ day: +db.settings.dayLimit || 100, mon: +db.settings.monLimit || 3000 });
    function used() {
      const n = new Date().toISOString(), d = n.slice(0, 10), m = n.slice(0, 7); let day = 0, mon = 0;
      for (const e of Object.values(db.sent)) { const t = new Date(String(e.created_at).replace(' ', 'T').replace(/\+00$/, 'Z')); if (isNaN(t)) continue; const i = t.toISOString(); if (i.startsWith(d)) day++; if (i.startsWith(m)) mon++; }
      return { day, mon };
    }
    const uuid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2);

    async function syncBox(kind, url) {
      let after = null;
      for (let p = 0; p < 10; p++) {
        const r = await call('GET', url + '?limit=100' + (after ? '&after=' + after : ''));
        if (!r.ok) return r;
        const items = r.data.data || []; let fresh = 0;
        for (const e of items) { const o = db[kind][e.id]; if (o) o.last_event = e.last_event; else { db[kind][e.id] = e; fresh++; } }
        if (!r.data.has_more || !items.length || !fresh) break;
        after = items[items.length - 1].id;
      }
      return { ok: true };
    }

    const H = {
      async state() {
        return { hasKey: !!(await env.getKey()), mode: db.mode, settings: { ...db.settings }, lastSync: db.lastSync,
          sent: sorted(db.sent), inbox: sorted(db.inbox), drafts: db.drafts.map(d => ({ ...d })) };
      },
      async keySet(key) {
        key = String(key || '').trim();
        if (!/^re_\w+/.test(key)) return { ok: false, error: 'Resend keys start with re_' };
        const r = await call('GET', '/emails?limit=1', null, key);
        let mode = 'full';
        if (!r.ok) {
          if (r.data && r.data.name === 'restricted_api_key') mode = 'send-only';
          else return { ok: false, error: r.status === 0 ? r.error : 'Resend rejected that key. Check it and try again.' };
        }
        const level = await env.setKey(key); db.mode = mode; await save();
        return { ok: true, mode, level };
      },
      async sync() {
        if (!(await env.getKey())) return { ok: false, error: 'No API key saved.' };
        let err = null;
        const s = await syncBox('sent', '/emails');
        if (!s.ok && !(s.data && s.data.name === 'restricted_api_key')) err = s.error;
        await syncBox('inbox', '/emails/receiving'); // best effort: only works once Resend receiving is on
        db.lastSync = Date.now(); await save();
        return { ok: !err, error: err };
      },
      async domains() {
        const r = await call('GET', '/domains');
        return r.ok ? (r.data.data || []).filter(d => d.status === 'verified').map(d => d.name) : [];
      },
      async get({ box, id }) {
        const o = db[box] && db[box][id]; if (!o) return { ok: false, error: 'Message not found.' };
        if (o.html || o.text) return { ok: true, mail: { ...o } };
        const r = await call('GET', (box === 'inbox' ? '/emails/receiving/' : '/emails/') + encodeURIComponent(id));
        if (!r.ok) return { ok: false, error: r.error };
        const d = r.data;
        Object.assign(o, { html: d.html, text: d.text, cc: d.cc, bcc: d.bcc, reply_to: d.reply_to, last_event: d.last_event || o.last_event });
        await save(); return { ok: true, mail: { ...o } };
      },
      async send(m) {
        const { force, ...msg } = m || {};
        if (!force) {
          const u = used(), l = limits();
          if (u.day >= l.day) return { ok: false, limit: 'day', error: `You have already sent ${u.day} of ${l.day} messages today (UTC). Resend may reject more.` };
          if (u.mon >= l.mon) return { ok: false, limit: 'month', error: `You have already sent ${u.mon} of ${l.mon} messages this month. Resend may reject more.` };
        }
        m = msg;
        const r = await call('POST', '/emails', m, null, { 'Idempotency-Key': uuid() });
        if (!r.ok) return { ok: false, error: r.error };
        db.sent[r.data.id] = { id: r.data.id, from: m.from, to: m.to, cc: m.cc || [], bcc: m.bcc || [], subject: m.subject,
          html: m.html, text: m.text, created_at: new Date().toISOString(), last_event: 'sent' };
        await save(); return { ok: true };
      },
      async draftSave(d) { const i = db.drafts.findIndex(x => x.id === d.id); d.updated = Date.now(); if (i < 0) db.drafts.unshift(d); else db.drafts[i] = d; await save(); },
      async draftDel(id) { db.drafts = db.drafts.filter(x => x.id !== id); await save(); },
      async settings(s) { db.settings = { ...db.settings, ...s }; await save(); },
      async vault() { return env.vault ? env.vault() : { level: 'unknown', where: null, has: !!(await env.getKey()) }; },
      async keyDel() { await env.delKey(); db.mode = 'full'; await save(); return { ok: true }; },
      async signout() { await env.delKey(); db = blank(); await save(); },
      pick() { return env.pick(); },
      ext(u) { if (/^(https:\/\/|mailto:)/.test(String(u))) env.ext(u); }
    };
    return async (c, a) => { await init(); if (!Object.prototype.hasOwnProperty.call(H, c)) throw new Error('blocked'); return H[c](a); };
  }
  root.createCore = createCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = createCore;
})(typeof window !== 'undefined' ? window : globalThis);
