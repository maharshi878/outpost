const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, session, nativeTheme } = require('electron');
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const createCore = require('./app/core.js');
const createVault = require('./vault.js');

const P = n => path.join(app.getPath('userData'), n);
const rd = (n, d) => { try { return JSON.parse(fs.readFileSync(P(n), 'utf8')); } catch { return d; } };
const wr = (n, v, mode = 0o644) => { const t = P(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v), { mode }); fs.renameSync(t, P(n)); };

// All mail logic lives in app/core.js and is shared with the Android build.
// This file only supplies the desktop pieces: storage, keychain, file picker.
const vault = createVault({ safeStorage, fs, file: P('key.json') });
const core = createCore({
  fetch: (...a) => fetch(...a),
  load: async () => rd('mail.json', null),
  save: async db => wr('mail.json', db, 0o600),
  getKey: async () => vault.get(),
  setKey: async v => vault.set(v),
  delKey: async () => vault.remove(),
  vault: async () => vault.status(),
  pick: async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return [];
    return r.filePaths.map(f => ({ filename: path.basename(f), content: fs.readFileSync(f).toString('base64'), size: fs.statSync(f).size }));
  },
  ext: u => shell.openExternal(u)
});
const APP_URL = pathToFileURL(path.join(__dirname, 'app', 'index.html')).href;
// Only the app's own top-level page may talk to the core. Iframes and anything else are refused.
ipcMain.handle('core', (e, c, a) => {
  const f = e.senderFrame;
  if (!f || f.parent || !String(f.url).startsWith(APP_URL)) throw new Error('blocked');
  return core(c, a);
});

function createWindow() {
  const w = new BrowserWindow({
    width: 1320, height: 840, minWidth: 940, minHeight: 580, title: 'Outpost', autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121211' : '#e9ebee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: !app.isPackaged }
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
