// Android (Capacitor) bridge. On desktop, preload.js provides window.api instead.
(function () {
  if (window.api || !window.Capacitor || typeof createCore === 'undefined') return;
  const idb = () => new Promise((ok, no) => {
    const r = indexedDB.open('outpost', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const kv = async (mode, fn) => {
    const d = await idb();
    return new Promise((ok, no) => { const t = d.transaction('kv', mode), q = fn(t.objectStore('kv')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); });
  };
  const pick = () => new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = true;
    i.onchange = async () => {
      const out = [];
      for (const f of i.files) {
        const u = new Uint8Array(await f.arrayBuffer()); let s = '';
        for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000));
        out.push({ filename: f.name, content: btoa(s), size: f.size });
      }
      res(out);
    };
    i.oncancel = () => res([]); i.click();
  });
  // The API key lives in the Android Keystore, behind a native plugin. The web layer only ever holds the
  // placeholder "@vault", and the plugin swaps in the real key for requests to api.resend.com.
  const SK = Capacitor.registerPlugin ? Capacitor.registerPlugin('SecureKey') : Capacitor.Plugins.SecureKey;
  const migrate = async () => { // older builds kept the key in WebView storage
    const old = localStorage.getItem('rk');
    if (old) { await SK.set({ value: old }); localStorage.removeItem('rk'); }
  };
  window.api = { call: createCore({
    fetch: async (url, o) => {
      const r = await SK.request({ path: url.replace(/^https:\/\/api\.resend\.com/, ''), method: o.method, headers: o.headers, body: o.body });
      return { ok: r.status >= 200 && r.status < 300, status: r.status,
        headers: { get: k => (/^retry-after$/i.test(k) && r.retryAfter) || null }, json: async () => JSON.parse(r.body || '{}') };
    },
    load: () => kv('readonly', s => s.get('db')),
    save: db => kv('readwrite', s => s.put(db, 'db')),
    getKey: async () => { await migrate(); return (await SK.status()).has ? '@vault' : null; },
    setKey: async v => { await SK.set({ value: v }); return 'keychain'; },
    delKey: async () => { localStorage.removeItem('rk'); await SK.remove(); },
    vault: async () => { const s = await SK.status(); return { level: 'keychain', where: s.hardware ? 'Android Keystore (hardware backed)' : 'Android Keystore', has: s.has }; },
    pick,
    ext: u => { const B = Capacitor.Plugins && Capacitor.Plugins.Browser; if (B) B.open({ url: u }); else window.open(u, '_blank'); }
  }) };
})();
