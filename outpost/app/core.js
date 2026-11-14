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
    async function call(method, url, body, key) {
      key = key || await env.getKey();
      for (let i = 0; i < 4; i++) {
        const w = last + 550 - Date.now(); last = Date.now() + Math.max(w, 0); if (w > 0) await sleep(w);
        let res;
        try {
          res = await env.fetch('https://api.resend.com' + url, {
            method,
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'User-Agent': 'outpost/0.2' },
            body: body ? JSON.stringify(body) : undefined
          });
        } catch (e) { return { ok: false, status: 0, error: 'Could not reach Resend. Check your connection.' }; }
        if (res.status === 429) { await sleep((+res.headers.get('retry-after') || 1) * 1000); continue; }
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data.message || 'Request failed (' + res.status + ')') };
      }
      return { ok: false, status: 429, error: 'Resend is rate limiting requests. Try again shortly.' };
    }

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
        await env.setKey(key); db.mode = mode; await save();
        return { ok: true, mode };
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
        const r = await call('POST', '/emails', m);
        if (!r.ok) return { ok: false, error: r.error };
        db.sent[r.data.id] = { id: r.data.id, from: m.from, to: m.to, cc: m.cc || [], bcc: m.bcc || [], subject: m.subject,
          html: m.html, text: m.text, created_at: new Date().toISOString(), last_event: 'sent' };
        await save(); return { ok: true };
      },
      async draftSave(d) { const i = db.drafts.findIndex(x => x.id === d.id); d.updated = Date.now(); if (i < 0) db.drafts.unshift(d); else db.drafts[i] = d; await save(); },
      async draftDel(id) { db.drafts = db.drafts.filter(x => x.id !== id); await save(); },
      async settings(s) { db.settings = { ...db.settings, ...s }; await save(); },
      async signout() { await env.delKey(); db = blank(); await save(); },
      pick() { return env.pick(); },
      ext(u) { if (/^(https:\/\/|mailto:)/.test(String(u))) env.ext(u); }
    };
    return async (c, a) => { await init(); if (!Object.prototype.hasOwnProperty.call(H, c)) throw new Error('blocked'); return H[c](a); };
  }
  root.createCore = createCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = createCore;
})(typeof window !== 'undefined' ? window : globalThis);
