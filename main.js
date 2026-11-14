const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, session, nativeTheme } = require('electron');
const fs = require('fs'), path = require('path');
const createCore = require('./app/core.js');

const P = n => path.join(app.getPath('userData'), n);
const rd = (n, d) => { try { return JSON.parse(fs.readFileSync(P(n), 'utf8')); } catch { return d; } };
const wr = (n, v, mode = 0o644) => { const t = P(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v), { mode }); fs.renameSync(t, P(n)); };

// All mail logic lives in app/core.js and is shared with the Android build.
// This file only supplies the desktop pieces: storage, keychain, file picker.
const core = createCore({
  fetch: (...a) => fetch(...a),
  load: async () => rd('mail.json', null),
  save: async db => wr('mail.json', db, 0o600),
  getKey: async () => {
    const k = rd('key.json', null); if (!k) return null;
    try { return k.enc ? safeStorage.decryptString(Buffer.from(k.d, 'base64')) : k.d; } catch { return null; }
  },
  setKey: async v => {
    const enc = safeStorage.isEncryptionAvailable();
    wr('key.json', { enc, d: enc ? safeStorage.encryptString(v).toString('base64') : v }, 0o600);
  },
  delKey: async () => { try { fs.unlinkSync(P('key.json')); } catch {} },
  pick: async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return [];
    return r.filePaths.map(f => ({ filename: path.basename(f), content: fs.readFileSync(f).toString('base64'), size: fs.statSync(f).size }));
  },
  ext: u => shell.openExternal(u)
});
ipcMain.handle('core', (_, c, a) => core(c, a));

function createWindow() {
  const w = new BrowserWindow({
    width: 1320, height: 840, minWidth: 940, minHeight: 580, title: 'Outpost', autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121211' : '#e9ebee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  w.loadFile(path.join(__dirname, 'app', 'index.html'));
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^(https:\/\/|mailto:)/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', e => e.preventDefault());
}

if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(() => {
  // The UI never touches the network. Anything it tries is cancelled.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_, cb) => cb({ cancel: true }));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
