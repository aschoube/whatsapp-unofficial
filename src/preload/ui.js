'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only channel between our local UI and the main process. WhatsApp's own
// views get no preload at all -- a remote page we do not control should have
// no bridge to reach for.
contextBridge.exposeInMainWorld('app', {
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    activate: (id) => ipcRenderer.invoke('accounts:activate', id),
    add: (name) => ipcRenderer.invoke('accounts:add', name),
    remove: (id) => ipcRenderer.invoke('accounts:remove', id),
    rename: (id, name) => ipcRenderer.invoke('accounts:rename', id, name),
    onChanged: (callback) => {
      ipcRenderer.on('accounts:changed', (_event, list) => callback(list));
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    open: () => ipcRenderer.invoke('settings:open')
  }
});
