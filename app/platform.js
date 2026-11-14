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
  window.api = { call: createCore({
    fetch: (...a) => window.fetch(...a), // CapacitorHttp patches fetch to go through native, so no CORS
    load: () => kv('readonly', s => s.get('db')),
    save: db => kv('readwrite', s => s.put(db, 'db')),
    getKey: async () => localStorage.getItem('rk'),
    setKey: async v => localStorage.setItem('rk', v),
    delKey: async () => localStorage.removeItem('rk'),
    pick,
    ext: u => { const B = Capacitor.Plugins && Capacitor.Plugins.Browser; if (B) B.open({ url: u }); else window.open(u, '_blank'); }
  }) };
})();
