const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', { call: (c, a) => ipcRenderer.invoke('core', c, a) });
