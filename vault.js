// Desktop key vault. The Electron main process owns it, the UI never sees the key.
// safeStorage and fs are passed in so the logic can be tested without Electron.
//
// Rules:
//  1. The key is only ever written to disk encrypted by the OS (Keychain, DPAPI, libsecret or kwallet).
//  2. If the OS cannot protect it (for example a Linux box with no keyring, where Electron would
//     silently fall back to plain text), the key is kept in memory only. Nothing touches the disk.
//  3. remove() deletes the file and clears memory in one call.
module.exports = function createVault({ safeStorage, fs, file, platform = process.platform }) {
  let mem = null;

  const backend = () => { try { return safeStorage.getSelectedStorageBackend ? String(safeStorage.getSelectedStorageBackend()) : ''; } catch { return ''; } };
  const secure = () => {
    try { if (!safeStorage.isEncryptionAvailable()) return false; } catch { return false; }
    if (platform === 'linux') { const b = backend(); return b.startsWith('gnome_libsecret') || b.startsWith('kwallet'); }
    return true;
  };
  const where = () => {
    if (!secure()) return null;
    if (platform === 'darwin') return 'macOS Keychain';
    if (platform === 'win32') return 'Windows data protection (DPAPI)';
    return backend().startsWith('kwallet') ? 'KDE Wallet' : 'GNOME Keyring';
  };
  const wipeFile = () => { try { fs.unlinkSync(file); } catch {} try { fs.unlinkSync(file + '.tmp'); } catch {} };
  const writeFile = v => {
    const t = file + '.tmp';
    fs.writeFileSync(t, JSON.stringify({ v: 2, enc: true, d: safeStorage.encryptString(v).toString('base64') }), { mode: 0o600 });
    fs.renameSync(t, file);
  };

  function get() {
    if (mem) return mem;
    let k; try { k = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
    try {
      if (k.enc) { if (!secure()) return null; mem = safeStorage.decryptString(Buffer.from(k.d, 'base64')); }
      else if (typeof k.d === 'string' && k.d) { // plain text file written by Outpost 0.2.0: upgrade it or destroy it
        mem = k.d;
        if (secure()) writeFile(mem); else wipeFile();
      }
    } catch { return null; }
    return mem;
  }
  function set(v) {
    mem = v;
    if (secure()) { try { writeFile(v); return 'keychain'; } catch { wipeFile(); return 'session'; } }
    wipeFile(); return 'session';
  }
  function remove() { mem = null; wipeFile(); }
  function status() { const w = where(); return { level: w ? 'keychain' : 'session', where: w, has: !!get() }; }

  return { get, set, remove, status };
};
