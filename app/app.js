'use strict';
const call = (c, a) => window.api.call(c, a);
const $ = id => document.getElementById(id);
const root = $('root');
const mq = matchMedia('(max-width:760px)');
const S = { box: 'sent', sent: [], inbox: [], drafts: [], settings: {}, mode: 'full', hasKey: false, q: '', sel: null, err: '', lastSync: 0, reading: false, anim: true };
let built = false, syncing = false, sig = '', gaugeAnim = true, cmp = null;
const C = { id: null, att: [], to: [], cc: [], bcc: [] }, F = {};

const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [x, v] of Object.entries(a)) {
    if (x === 'class') e.className = v;
    else if (x.startsWith('on')) e.addEventListener(x.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(x, v === true ? '' : v);
  }
  for (const c of k.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const arr = x => Array.isArray(x) ? x : split(x || '');
const split = s => String(s).split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
const valid = x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x);
const pd = s => new Date(String(s).replace(' ', 'T').replace(/\+00$/, 'Z'));
const first = a => Array.isArray(a) ? a[0] : a;
const addr = s => { const m = /<([^>]+)>/.exec(s || ''); return m ? m[1] : (s || ''); };
const nameOf = s => { const m = /^\s*"?([^"<]+?)"?\s*</.exec(s || ''); return m ? m[1] : addr(s).split('@')[0]; };
const when = s => {
  const d = pd(s), n = new Date();
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.getFullYear() === n.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};
const dayLabel = s => {
  const d = pd(s), n = new Date(), a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const diff = Math.round((b - a) / 864e5);
  if (diff <= 0) return 'Today'; if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], d.getFullYear() === n.getFullYear() ? { month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric', year: 'numeric' });
};
const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
const hue = s => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 360; return x; };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toHtml = t => '<div style="font:14px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222">' +
  esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>') + '</div>';
const plain = e => e.text || (e.html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const kb = s => s > 1e6 ? (s / 1e6).toFixed(1) + ' MB' : Math.ceil(s / 1e3) + ' KB';
const link = (t, u) => h('a', { href: '#', onclick: e => { e.preventDefault(); call('ext', u); } }, t);

const ICO = {
  inbox: 'M4 13l2.5-7h11L20 13v6H4v-6zM4 13h4.5l1 2.5h5l1-2.5H20', send: 'M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z',
  file: 'M6 3h8l4 4v14H6V3zM14 3v4h4', sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4', edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  refresh: 'M20 11a8 8 0 10-2 6M20 5v6h-6', reply: 'M10 8L4 13l6 5M4 13h9a7 7 0 017 7', fwd: 'M14 8l6 5-6 5M20 13h-9a7 7 0 00-7 7',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', back: 'M15 5l-7 7 7 7', x: 'M6 6l12 12M18 6L6 18',
  clip: 'M20 11l-8 8a5 5 0 01-7-7l8-8a3.5 3.5 0 015 5l-8 8a2 2 0 01-3-3l7-7', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', min: 'M6 12h12'
};
const ico = (n, fill, sz = 20) => { const s = h('span', { class: 'ic' }); s.innerHTML = `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${ICO[n]}"/></svg>`; return s; };
const logo = sz => { const s = h('span', { class: 'ic' }); s.innerHTML = `<svg viewBox="0 0 32 32" width="${sz}" height="${sz}"><rect width="32" height="32" rx="10" style="fill:var(--pri)"/><path d="M8 11.5h16v9H8zM8 12l8 6 8-6" fill="none" style="stroke:var(--pri-fg)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`; return s; };
const avatar = (a, s = 40) => h('span', { class: 'av', style: `--h:${hue(a)};--s:${s}px` }, (a[0] || '?').toUpperCase());

const ST = { sent: ['Accepted by Resend', ''], delivered: ['Delivered', 'ok'], opened: ['Opened', 'ok'], clicked: ['Link clicked', 'ok'], delivery_delayed: ['Delayed, retrying', 'wn'],
  bounced: ['Bounced', 'bad'], complained: ['Marked as spam', 'bad'], failed: ['Failed', 'bad'], scheduled: ['Scheduled', ''], canceled: ['Canceled', ''] };
const stat = ev => ST[ev] || [(ev || '').replace(/_/g, ' '), ''];
const dot = ev => ev ? h('span', { class: 'dot ' + stat(ev)[1], title: stat(ev)[0] }) : null;
const chipStatus = ev => ev ? h('span', { class: 'st ' + stat(ev)[1] }, h('span', { class: 'dot' }), stat(ev)[0]) : null;

function toast(m, act, ms = 3500) {
  const old = $('toast'); if (old) old.remove();
  const t = h('div', { id: 'toast', class: 'toast', style: `--d:${ms}ms` }, m, act && h('button', { onclick: () => { act.fn(); t.remove(); } }, act.label), act ? h('span', { class: 'bar' }) : null);
  document.body.append(t); setTimeout(() => t.isConnected && t.remove(), ms);
}

function quota() {
  const n = new Date(), d = n.toISOString().slice(0, 10), m = d.slice(0, 7); let day = 0, mon = 0;
  for (const e of S.sent) { const t = pd(e.created_at); if (isNaN(t)) continue; const i = t.toISOString(); if (i.startsWith(d)) day++; if (i.startsWith(m)) mon++; }
  return { day, mon };
}
const meter = (l, v, m) => {
  const w = Math.min(100, v / m * 100) + '%';
  return h('div', { class: 'meter' }, h('div', { class: 'ml' }, h('span', {}, l), h('b', {}, v + ' / ' + m)),
    h('div', { class: 'gauge' }, h('i', { class: v / m > .9 ? 'hot' : '', 'data-w': w, style: 'width:' + (gaugeAnim ? '0%' : w) })));
};
const usage = () => { const q = quota(); return h('div', { class: 'usage' }, meter('Sent today', q.day, S.settings.dayLimit || 100), meter('This month', q.mon, S.settings.monLimit || 3000), h('p', { class: 'cap' }, 'Resend free plan, counted on this device.')); };

const TITLES = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts', starred: 'Starred' };
function items() {
  let raw;
  if (S.box === 'drafts') raw = S.drafts;
  else if (S.box === 'starred') raw = [...S.sent, ...S.inbox].filter(e => S.settings.stars && S.settings.stars[e.id]).sort((a, b) => pd(b.created_at) - pd(a.created_at));
  else raw = S[S.box];
  if (!S.q) return raw;
  const q = S.q.toLowerCase();
  return raw.filter(e => [e.subject, e.from, arr(e.to).join(' ')].join(' ').toLowerCase().includes(q));
}

function applyTheme() { document.documentElement.dataset.theme = S.settings.theme || ''; }

/* ---------- shell ---------- */
function draw() {
  applyTheme();
  if (!S.hasKey) { built = false; root.className = 'solo'; root.replaceChildren(onboard()); return; }
  const fresh = !built; if (fresh) buildShell();
  const sc = fresh ? 0 : $('rows').scrollTop;
  drawNav(); drawHead(); drawBanners(); drawRows(); $('rows').scrollTop = sc;
  if (fresh) drawReader();
}
function buildShell() {
  built = true; root.className = 'app';
  root.replaceChildren(
    h('aside', { id: 'rail', class: 'rail' }),
    h('section', { class: 'pane' },
      h('header', { class: 'ph' }, h('div', {}, h('h1', { id: 'title', class: 'serif' }), h('span', { id: 'cnt', class: 'cnt' })),
        h('button', { id: 'syncb', class: 'ib', title: 'Sync with Resend', 'aria-label': 'Sync', onclick: sync }, ico('refresh'))),
      h('div', { class: 'sw' }, ico('search'), h('input', { id: 'q', placeholder: 'Search mail', 'aria-label': 'Search', enterkeyhint: 'search', oninput: e => { S.q = e.target.value; drawHead(); drawRows(); } }), h('kbd', { class: 'dk' }, '/')),
      h('div', { id: 'banners' }), h('div', { id: 'ptr', class: 'ptr' }, ico('refresh')), h('div', { id: 'rows', class: 'rows' })),
    h('section', { id: 'reader', class: 'reader' }),
    h('nav', { id: 'tabs', class: 'tabs' }),
    h('button', { id: 'fab', class: 'fab', 'aria-label': 'Compose', onclick: () => openC() }, ico('edit'), h('span', {}, 'Compose')));
  const rows = $('rows'), ptr = $('ptr'); let y0 = null, dy = 0, ly = 0;
  rows.addEventListener('touchstart', e => { y0 = rows.scrollTop === 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  rows.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0) / 2.2; if (dy > 0) { ptr.style.transition = 'none'; ptr.style.height = Math.min(dy, 60) + 'px'; ptr.classList.toggle('ready', dy >= 48); } }, { passive: true });
  rows.addEventListener('touchend', () => { ptr.style.transition = ''; ptr.style.height = ''; ptr.classList.remove('ready'); if (y0 != null && dy >= 48) sync(); y0 = null; dy = 0; });
  rows.addEventListener('scroll', () => { const y = rows.scrollTop; $('fab').classList.toggle('min', y > ly && y > 80); ly = y; }, { passive: true });
}
function drawNav() {
  const NAV = [['inbox', 'Inbox', 'inbox'], ['sent', 'Sent', 'send'], ['drafts', 'Drafts', 'file'], ['starred', 'Starred', 'star']];
  $('rail').replaceChildren(
    h('div', { class: 'brand' }, logo(30), h('span', { class: 'serif' }, 'Outpost')),
    h('button', { class: 'compose', onclick: () => openC() }, ico('edit'), 'Compose', h('kbd', {}, 'C')),
    h('nav', {}, ...NAV.map(([k, l, i]) => h('button', { class: 'nav' + (S.box === k ? ' on' : ''), onclick: () => go(k) }, ico(i), h('span', {}, l), k === 'drafts' && S.drafts.length ? h('em', {}, S.drafts.length) : null))),
    h('div', { class: 'foot' }, usage(), h('div', { class: 'fl' }, h('span', { class: 'mu' }, S.lastSync ? 'Synced ' + ago(S.lastSync) : 'Not synced yet'), h('button', { class: 'ib', title: 'Settings', 'aria-label': 'Settings', onclick: settings }, ico('sliders')))));
  $('tabs').replaceChildren(...[['inbox', 'Inbox', 'inbox'], ['sent', 'Sent', 'send'], ['drafts', 'Drafts', 'file']].map(([k, l, i]) => h('button', { class: S.box === k ? 'on' : '', onclick: () => go(k) }, ico(i), l)),
    h('button', { onclick: settings }, ico('sliders'), 'You'));
  if (gaugeAnim) { gaugeAnim = false; requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.gauge i').forEach(i => i.style.width = i.dataset.w))); }
}
function drawHead() {
  const n = items().length;
  $('title').textContent = TITLES[S.box];
  $('cnt').textContent = S.q ? n + (n === 1 ? ' result' : ' results') : n + (n === 1 ? ' message' : ' messages');
}
function drawBanners() {
  const b = $('banners'), seen = () => { S.settings.cfSeen = true; call('settings', { cfSeen: true }); }, out = [];
  if (S.err) out.push(h('div', { class: 'err' }, S.err));
  if (S.box === 'sent' && S.mode === 'send-only') out.push(h('div', { class: 'banner' }, 'This key can only send, so sent history is not synced. Create a Full access key in Resend to fill this list.'));
  if (S.box === 'sent' && !S.settings.cfSeen && S.sent.length) out.push(h('div', { class: 'banner' }, 'Want replies too? Cloudflare Email Routing is free and takes a few minutes.',
    h('div', { class: 'a' }, h('button', { class: 'link', onclick: () => { seen(); go('inbox'); } }, 'Show me how'), h('button', { class: 'link', onclick: () => { seen(); drawBanners(); } }, 'Dismiss'))));
  b.replaceChildren(...out);
}
function go(k) {
  S.box = k; S.sel = null; S.q = ''; S.reading = false; S.anim = true; root.classList.remove('reading');
  const q = $('q'); if (q) q.value = '';
  drawNav(); drawHead(); drawBanners(); drawRows(); drawReader(); $('rows').scrollTop = 0;
}

/* ---------- list ---------- */
function guide() {
  const ab = (t, u) => h('button', { class: 'pill alt', onclick: () => call('ext', u) }, t);
  return h('div', { class: 'guide' }, h('h2', { class: 'serif' }, 'Receive mail on your domain'),
    h('p', { class: 'cap' }, 'Outpost sends through Resend. To get replies, pick one route.'),
    h('h3', {}, 'Cloudflare Email Routing (free)'),
    h('ol', {}, h('li', {}, 'Add your domain to Cloudflare.'), h('li', {}, 'Open Email, then Email Routing, and enable it. Cloudflare sets the MX records.'),
      h('li', {}, 'Create an address like hello@yourdomain and forward it to a mailbox you already read.'),
      h('li', {}, 'Use that address as Send from in Settings so replies find their way back.')),
    h('p', { class: 'cap' }, 'Cloudflare forwards to another inbox. It cannot deliver into a local app.'),
    h('h3', {}, 'Resend receiving'),
    h('p', { class: 'cap' }, 'Turn on receiving for a domain or subdomain in Resend. What it catches shows up in this Inbox on the next sync.'),
    h('div', { class: 'a' }, ab('Cloudflare docs', 'https://developers.cloudflare.com/email-routing/'), ab('Resend docs', 'https://resend.com/docs')));
}
function empty() {
  if (S.q) return h('div', { class: 'blank' }, h('p', { class: 'serif' }, 'No matches'), h('p', {}, 'Nothing in ' + TITLES[S.box] + ' matches "' + S.q + '".'));
  if (S.box === 'inbox') return guide();
  const m = { sent: ['Nothing sent yet', 'Write a message and it lands here with live delivery status.'], drafts: ['No drafts', 'Unfinished messages are saved here automatically.'], starred: ['Nothing starred', 'Star a message to pin it here.'] }[S.box];
  return h('div', { class: 'blank' }, h('p', { class: 'serif' }, m[0]), h('p', {}, m[1]), S.box === 'sent' ? h('button', { class: 'pill', onclick: () => openC() }, ico('edit'), 'Compose') : null);
}
function row(e, i) {
  const d = S.box === 'drafts', b = e._b || S.box, to = arr(e.to), p = d ? first(to) : b === 'sent' ? first(to) : e.from;
  const nm = d ? (to.length ? nameOf(first(to)) : 'No recipient') : (b === 'sent' ? 'To ' : '') + nameOf(p);
  const star = S.settings.stars && S.settings.stars[e.id];
  return h('button', { class: 'row' + (S.sel && S.sel.id === e.id ? ' on' : '') + (S.anim ? ' enter' : ''), style: `--i:${Math.min(i, 12)}`, onclick: () => d ? openC(e) : openMail(e) },
    avatar(addr(p) || '?'),
    h('div', { class: 'rc' },
      h('div', { class: 'r1' }, h('span', { class: 'nm' }, nm), h('span', { class: 'dt' }, when(d ? new Date(e.updated).toISOString() : e.created_at))),
      h('div', { class: 'r2' }, h('span', { class: 'sj' }, e.subject || '(no subject)'), star ? h('span', { class: 'star' }, ico('star', true, 14)) : null, d ? null : dot(e.last_event))));
}
function drawRows() {
  const rows = $('rows'), l = items(); rows.replaceChildren();
  if (!l.length) { rows.append(empty()); S.anim = false; return; }
  let last = '';
  l.slice(0, 400).forEach((e, i) => {
    const d = dayLabel(S.box === 'drafts' ? new Date(e.updated).toISOString() : e.created_at);
    if (d !== last) { rows.append(h('div', { class: 'day' }, d)); last = d; }
    rows.append(row(e, i));
  });
  S.anim = false;
}

/* ---------- reader ---------- */
function frame(e) {
  const body = e.html || '<pre style="white-space:pre-wrap;font:inherit;margin:0">' + esc(e.text || '') + '</pre>';
  const f = h('iframe', { sandbox: 'allow-same-origin allow-popups allow-popups-to-escape-sandbox', scrolling: 'no', title: 'Message body' });
  f.srcdoc = '<meta charset="utf-8"><base target="_blank"><style>html{overflow:hidden}body{font:15px/1.6 system-ui,sans-serif;color:#161a2e;margin:0;padding:22px 24px;word-wrap:break-word}img{max-width:100%;height:auto}</style>' + body;
  const fit = () => { try { f.style.height = f.contentDocument.documentElement.scrollHeight + 'px'; } catch {} };
  f.addEventListener('load', () => { fit(); setTimeout(fit, 200); setTimeout(fit, 800); });
  return h('div', { class: 'paper' }, f);
}
function drawReader() {
  const r = $('reader'), s = S.sel; r.replaceChildren(); r.scrollTop = 0;
  if (!s) { r.append(h('div', { class: 'blank', style: 'height:100%' }, logo(44), h('p', { class: 'serif' }, 'Select a message'), h('p', {}, 'Or press C to write a new one.'))); return; }
  const e = s.e, inbox = s.box === 'inbox', on = !!(S.settings.stars && S.settings.stars[e.id]);
  const sb = h('button', { class: 'ib' + (on ? ' on' : ''), title: 'Star', 'aria-label': 'Star', onclick: () => toggleStar(e, sb) }, ico('star', on));
  r.append(
    h('div', { class: 'rbar' }, h('button', { class: 'ib mo', title: 'Back', 'aria-label': 'Back', onclick: back }, ico('back')), h('span', { class: 'sp' }), sb,
      h('button', { class: 'ib', title: 'Reply', 'aria-label': 'Reply', onclick: () => reply(e, inbox) }, ico('reply')),
      h('button', { class: 'ib', title: 'Forward', 'aria-label': 'Forward', onclick: () => fwd(e) }, ico('fwd'))),
    h('article', { class: 'msg' }, h('h1', { class: 'subj' }, e.subject || '(no subject)'),
      h('div', { class: 'who' }, avatar(addr(e.from), 46), h('div', { class: 'wt' }, h('b', {}, nameOf(e.from)), h('small', {}, addr(e.from))),
        h('time', {}, pd(e.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))),
      h('div', { class: 'rcp' }, 'to ' + arr(e.to).join(', ') + (e.cc && e.cc.length ? '   cc ' + arr(e.cc).join(', ') : '')),
      inbox ? null : chipStatus(e.last_event),
      s.loading ? h('div', { class: 'loadbar' }) : s.fail ? h('div', { class: 'err', style: 'margin:20px 0 0' }, s.fail) : frame(e)));
}
function toggleStar(e, btn) {
  const stars = { ...(S.settings.stars || {}) }; if (stars[e.id]) delete stars[e.id]; else stars[e.id] = 1;
  S.settings.stars = stars; call('settings', { stars });
  const on = !!stars[e.id]; btn.classList.toggle('on', on); btn.replaceChildren(ico('star', on));
  if (S.box === 'starred' && !on) { drawHead(); } drawRows();
}
async function openMail(e) {
  S.sel = { id: e.id, e, box: e._b || S.box, loading: !(e.html || e.text) };
  S.reading = true; root.classList.add('reading'); drawRows(); drawReader();
  if (!S.sel.loading) return;
  const r = await call('get', { box: S.sel.box, id: e.id });
  if (S.sel && S.sel.id === e.id) { if (r.ok) Object.assign(e, r.mail, { _b: S.sel.box }); S.sel.loading = false; S.sel.fail = r.ok ? '' : r.error; drawReader(); }
}
function back() { S.reading = false; root.classList.remove('reading'); setTimeout(() => { if (!S.reading) { S.sel = null; drawRows(); } }, 420); }
function step(d) {
  if (S.box === 'drafts') return;
  const l = items(), i = l.findIndex(e => S.sel && e.id === S.sel.id), n = l[Math.max(0, Math.min(l.length - 1, i + d))];
  if (n) openMail(n);
}
const quote = e => '\n\nOn ' + pd(e.created_at).toLocaleString() + ', ' + e.from + ' wrote:\n' + plain(e).split('\n').map(l => '> ' + l).join('\n');
function reply(e, inbox) {
  const r = [].concat(e.reply_to || [])[0];
  openC({ to: inbox ? [r || addr(e.from)] : arr(e.to), subject: /^re:/i.test(e.subject) ? e.subject : 'Re: ' + e.subject, body: quote(e) });
}
function fwd(e) {
  openC({ subject: /^fwd:/i.test(e.subject) ? e.subject : 'Fwd: ' + e.subject,
    body: `\n\n---------- Forwarded message ----------\nFrom: ${e.from}\nDate: ${pd(e.created_at).toLocaleString()}\nSubject: ${e.subject}\nTo: ${arr(e.to).join(', ')}\n\n` + plain(e) });
}

/* ---------- compose ---------- */
function contacts() {
  const m = new Map(), me = (S.settings.addr || '').toLowerCase();
  const add = (s, w) => { for (const x of [].concat(s || [])) { const a = addr(x).toLowerCase(); if (!a.includes('@') || a === me) continue; const o = m.get(a) || { a, n: nameOf(x), c: 0 }; o.c += w; if (x.includes('<')) o.n = nameOf(x); m.set(a, o); } };
  S.sent.forEach(e => { add(e.to, 2); add(e.cc, 1); }); S.inbox.forEach(e => add(e.from, 2));
  return [...m.values()].sort((x, y) => y.c - x.c);
}
function chipField(key, label, hidden) {
  const box = h('div', { class: 'chips' }), inp = h('input', { autocomplete: 'off', spellcheck: 'false', inputmode: 'email', autocapitalize: 'off', 'aria-label': label });
  const sug = h('div', { class: 'sugg', hidden: true }); box.append(inp, sug);
  let idx = -1, list = [];
  const render = () => { box.querySelectorAll('.chip').forEach(x => x.remove()); C[key].forEach((a, i) => box.insertBefore(h('span', { class: 'chip' + (valid(a) ? '' : ' bad') }, a, h('button', { type: 'button', title: 'Remove', 'aria-label': 'Remove ' + a, onclick: () => { C[key].splice(i, 1); render(); autosave(); } }, ico('x', false, 14))), inp)); };
  const commit = t => { for (const x of split(t == null ? inp.value : t)) if (!C[key].includes(x)) C[key].push(x); inp.value = ''; sug.hidden = true; list = []; render(); autosave(); };
  const mark = () => sug.querySelectorAll('.sg').forEach((b, i) => b.classList.toggle('on', i === idx));
  const suggest = () => {
    const q = inp.value.trim().toLowerCase();
    list = q ? contacts().filter(c => !C[key].includes(c.a) && (c.a.includes(q) || c.n.toLowerCase().includes(q))).slice(0, 5) : [];
    idx = list.length ? 0 : -1;
    sug.replaceChildren(...list.map(c => h('button', { type: 'button', class: 'sg', onmousedown: e => { e.preventDefault(); commit(c.a); }, ontouchstart: e => { e.preventDefault(); commit(c.a); } }, avatar(c.a, 30), h('span', { class: 'sgt' }, h('b', {}, c.n), h('small', {}, c.a)))));
    sug.hidden = !list.length; mark();
  };
  inp.addEventListener('input', () => { if (/[,;\s]$/.test(inp.value)) commit(); else suggest(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); idx = (idx + 1) % list.length; mark(); }
    else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); idx = (idx + list.length - 1) % list.length; mark(); }
    else if ((e.key === 'Enter' || e.key === 'Tab' || e.key === ',') && inp.value.trim()) { e.preventDefault(); commit(list[idx] ? list[idx].a : inp.value); }
    else if (e.key === 'Backspace' && !inp.value && C[key].length) { C[key].pop(); render(); autosave(); }
  });
  inp.addEventListener('blur', () => setTimeout(() => { if (inp.value.trim()) commit(); sug.hidden = true; }, 120));
  box.addEventListener('click', () => inp.focus());
  return { box, hidden, label, render, flush: () => { if (inp.value.trim()) commit(); }, focus: () => inp.focus() };
}
const v = id => $(id).value;
const readC = () => { F.to.flush(); F.cc.flush(); F.bcc.flush(); return { id: C.id, from: v('c-from').trim(), to: [...C.to], cc: [...C.cc], bcc: [...C.bcc], subject: v('c-sub'), body: v('c-body'), att: C.att }; };
let tm; const autosave = () => { clearTimeout(tm); tm = setTimeout(saveDraft, 700); };
async function saveDraft() {
  const d = { id: C.id, from: v('c-from').trim(), to: [...C.to], cc: [...C.cc], bcc: [...C.bcc], subject: v('c-sub'), body: v('c-body'), att: [] };
  if (!d.to.length && !d.subject && !d.body.trim()) return;
  await call('draftSave', d); S.drafts = (await call('state')).drafts;
  if (built) { drawNav(); if (S.box === 'drafts') { drawHead(); drawRows(); } }
}
function buildC() {
  F.to = chipField('to', 'To'); F.cc = chipField('cc', 'Cc', true); F.bcc = chipField('bcc', 'Bcc', true);
  const showOpt = () => { F.cc.row.hidden = false; F.bcc.row.hidden = false; };
  const row = (f, extra) => { f.row = h('div', { class: 'cr', hidden: !!f.hidden }, h('span', { class: 'cl' }, f.label), f.box, extra); return f.row; };
  cmp = h('div', { class: 'cmp', role: 'dialog', 'aria-label': 'New message', hidden: true },
    h('div', { class: 'ch' }, h('button', { class: 'ib mo', title: 'Close', 'aria-label': 'Close', onclick: closeC }, ico('back')), h('b', {}, 'New message'), h('span', { class: 'sp' }),
      h('button', { class: 'ib dk', title: 'Minimize', 'aria-label': 'Minimize', onclick: () => cmp.classList.toggle('min') }, ico('min')),
      h('button', { class: 'ib dk', title: 'Close and keep draft', 'aria-label': 'Close', onclick: closeC }, ico('x')),
      h('button', { class: 'ib sendm mo', title: 'Send', 'aria-label': 'Send', onclick: send }, ico('send'))),
    h('div', { class: 'cb' },
      h('div', { class: 'cr' }, h('span', { class: 'cl' }, 'From'), h('input', { id: 'c-from', autocomplete: 'off', inputmode: 'email', oninput: autosave })),
      row(F.to, h('button', { class: 'tg', type: 'button', onclick: showOpt }, 'Cc Bcc')), row(F.cc), row(F.bcc),
      h('div', { class: 'cr' }, h('span', { class: 'cl' }, 'Subject'), h('input', { id: 'c-sub', autocomplete: 'off', oninput: autosave })),
      h('textarea', { id: 'c-body', placeholder: 'Write your message', oninput: autosave }), h('div', { id: 'c-att', class: 'atts' })),
    h('div', { class: 'cfoot' }, h('button', { class: 'pill dk', onclick: send }, ico('send', false, 18), 'Send', h('kbd', { style: 'color:inherit;border-color:currentColor;opacity:.5' }, 'Ctrl+Enter')),
      h('button', { class: 'ib', title: 'Attach files', 'aria-label': 'Attach', onclick: attach }, ico('clip')), h('span', { class: 'sp' }),
      h('button', { class: 'ib', title: 'Discard', 'aria-label': 'Discard', onclick: discard }, ico('trash'))));
  document.body.append(cmp);
}
function openC(d = {}) {
  if (!cmp) buildC();
  C.id = d.id || crypto.randomUUID(); C.att = d.att || []; C.to = [...arr(d.to)]; C.cc = [...arr(d.cc)]; C.bcc = [...arr(d.bcc)];
  const a = S.settings.addr || '';
  $('c-from').value = d.from || (S.settings.name && a ? `${S.settings.name} <${a}>` : a);
  $('c-sub').value = d.subject || ''; $('c-body').value = d.body || '';
  F.to.render(); F.cc.render(); F.bcc.render(); F.cc.row.hidden = F.bcc.row.hidden = !(C.cc.length || C.bcc.length);
  cmp.classList.remove('out', 'min'); cmp.hidden = false; drawAtt();
  if (C.to.length) { const b = $('c-body'); b.focus(); b.setSelectionRange(0, 0); } else F.to.focus();
}
function hideC() { cmp.classList.add('out'); setTimeout(() => { if (cmp.classList.contains('out')) { cmp.hidden = true; cmp.classList.remove('out'); } }, 200); }
async function closeC() { clearTimeout(tm); hideC(); await saveDraft(); }
async function discard() { clearTimeout(tm); hideC(); await call('draftDel', C.id); S.drafts = (await call('state')).drafts; if (built) { drawNav(); if (S.box === 'drafts') { drawHead(); drawRows(); } } }
function drawAtt() { $('c-att').replaceChildren(...C.att.map((a, i) => h('span', { class: 'chip' }, a.filename + ' (' + kb(a.size) + ')', h('button', { type: 'button', title: 'Remove', onclick: () => { C.att.splice(i, 1); drawAtt(); } }, ico('x', false, 14))))); }
async function attach() {
  const f = await call('pick'); C.att.push(...f);
  if (C.att.reduce((n, a) => n + a.size, 0) > 35e6) { C.att = C.att.filter(a => !f.includes(a)); toast('Attachments are limited to about 35 MB in total.'); }
  drawAtt();
}
function send() {
  const d = readC(), bad = [...d.to, ...d.cc, ...d.bcc].find(x => !valid(x));
  if (!d.from) return toast('Add a From address. Open Settings to set a default.');
  if (!d.to.length) return toast('Add at least one recipient.');
  if (bad) return toast(bad + ' is not a valid address.');
  clearTimeout(tm); hideC();
  const t = setTimeout(async () => {
    const text = d.body + (S.settings.sig ? '\n\n-- \n' + S.settings.sig : '');
    const m = { from: d.from, to: d.to, subject: d.subject || '(no subject)', text, html: toHtml(text) };
    if (d.cc.length) m.cc = d.cc; if (d.bcc.length) m.bcc = d.bcc;
    if (d.att.length) m.attachments = d.att.map(a => ({ filename: a.filename, content: a.content }));
    const r = await call('send', m);
    if (r.ok) { await call('draftDel', d.id); await load(true); toast('Sent'); } else { openC(d); toast(r.error, null, 7000); }
  }, 6000);
  toast('Sending message', { label: 'Undo', fn: () => { clearTimeout(t); openC(d); } }, 6000);
}

/* ---------- onboarding and settings ---------- */
function onboard() {
  const inp = h('input', { type: 'password', placeholder: 're_...', class: 'key', autocomplete: 'off', 'aria-label': 'Resend API key' }), msg = h('p', { class: 'bad-t' });
  const go = h('button', { class: 'pill', onclick: async () => {
    go.disabled = true; go.textContent = 'Checking key';
    const r = await call('keySet', inp.value);
    if (!r.ok) { msg.textContent = r.error; go.disabled = false; go.textContent = 'Connect'; return; }
    await load(true); if (!S.settings.addr) settings(); sync();
  } }, 'Connect');
  inp.addEventListener('keydown', e => e.key === 'Enter' && go.click());
  const R = (d, el) => { el.classList.add('rise'); el.style.setProperty('--d', d); return el; };
  return h('div', { style: 'display:contents' },
    h('div', { class: 'hero' }, R(0, logo(46)), R(1, h('h1', {}, 'Email from your own domain. Free.')),
      R(2, h('p', {}, 'Outpost is a mail app that lives on this device. Bring a Resend key and it handles sending, history and replies. No account, no server, no tracking.'))),
    h('div', { class: 'kc' }, R(3, h('div', { class: 'card' }, h('h2', { class: 'serif' }, 'Connect your key'), h('p', { class: 'cap' }, 'Encrypted on this device. Only ever sent to api.resend.com.'), inp, msg, go,
      h('ol', { class: 'steps' }, h('li', {}, h('span', {}, 'Create a key at ', link('resend.com/api-keys', 'https://resend.com/api-keys'), '.')),
        h('li', {}, 'Pick Full access to sync your sent history. Sending access works too, but history stays empty.'),
        h('li', {}, 'Verify your domain in Resend so you can send from it.'))))));
}
function settings() {
  const nm = h('input', { value: S.settings.name || '', placeholder: 'Your name', autocomplete: 'off' }), ad = h('input', { value: S.settings.addr || '', placeholder: 'hello@yourdomain.com', list: 'doms', inputmode: 'email', autocomplete: 'off' });
  const sg = h('textarea', { placeholder: 'Added under every message' }, S.settings.sig || ''), dl = h('datalist', { id: 'doms' });
  call('domains').then(ds => ds.forEach(x => dl.append(h('option', { value: 'hello@' + x }))));
  const close = () => { d.close(); d.remove(); };
  const tb = (k, l) => h('button', { class: (S.settings.theme || '') === k ? 'on' : '', onclick: e => { S.settings.theme = k; call('settings', { theme: k }); applyTheme(); e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, l);
  const d = h('dialog', { class: 'dlg' }, h('h2', { class: 'serif' }, 'Settings'),
    h('label', {}, 'Display name'), nm, h('label', {}, 'Send from (verified domain in Resend)'), ad, dl, h('label', {}, 'Signature'), sg,
    h('label', {}, 'Appearance'), h('div', { class: 'seg' }, tb('', 'System'), tb('dark', 'Dark'), tb('light', 'Light')),
    h('label', {}, 'Free plan usage'), usage(),
    h('div', { class: 'row2' },
      h('button', { class: 'pill', onclick: async () => { await call('settings', { name: nm.value.trim(), addr: ad.value.trim(), sig: sg.value }); await load(true); close(); } }, 'Save'),
      h('button', { class: 'pill alt', onclick: close }, 'Cancel'), h('span', { class: 'sp' }),
      h('button', { class: 'ib danger', title: 'Sign out and erase data', 'aria-label': 'Sign out and erase data', onclick: async () => { if (confirm('Remove the API key and erase all mail stored on this device?')) { await call('signout'); S.sel = null; S.reading = false; await load(true); close(); } } }, ico('trash'))));
  document.body.append(d); d.showModal();
}

/* ---------- data ---------- */
async function load(force) {
  const n = await call('state'); Object.assign(S, n);
  S.sent.forEach(e => e._b = 'sent'); S.inbox.forEach(e => e._b = 'inbox');
  const s = [n.hasKey, n.mode, JSON.stringify(n.settings), n.sent.map(e => e.id + e.last_event).join(), n.inbox.map(e => e.id).join(), n.drafts.map(d => d.id + d.updated).join()].join('|');
  if (force || s !== sig) { sig = s; draw(); }
}
async function sync() {
  if (syncing || !S.hasKey) return; syncing = true;
  const b = $('syncb'); if (b) b.classList.add('spin');
  const r = await call('sync'), prev = S.err; S.err = r.ok ? '' : r.error;
  syncing = false; await load(prev !== S.err);
  if (built) drawNav(); const b2 = $('syncb'); if (b2) b2.classList.remove('spin');
}

addEventListener('keydown', e => {
  const t = e.target, typing = /INPUT|TEXTAREA/.test(t.tagName);
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && cmp && !cmp.hidden) return send();
  if (e.key === 'Escape') { if (cmp && !cmp.hidden && cmp.contains(t)) return closeC(); if (S.reading && mq.matches) return back(); }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || !S.hasKey) return;
  if (e.key === 'c') { e.preventDefault(); openC(); }
  else if (e.key === '/') { e.preventDefault(); const q = $('q'); if (q) q.focus(); }
  else if (e.key === 'j') step(1); else if (e.key === 'k') step(-1);
});
addEventListener('focus', () => sync());
(function bindBack() {
  const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (!A) return;
  A.addListener('backButton', () => {
    const dlg = document.querySelector('dialog[open]'); if (dlg) { dlg.close(); dlg.remove(); return; }
    if (cmp && !cmp.hidden) return closeC();
    if (S.reading) return back();
    if (S.box !== 'sent') return go('sent');
    A.exitApp();
  });
})();
(async () => { await load(true); if (S.hasKey) sync(); setInterval(() => sync(), 60000); })();
