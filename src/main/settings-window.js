'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');

let win = null;

function openSettings(parent) {
  if (win && !win.isDestroyed()) {
    win.focus();
    return win;
  }

  win = new BrowserWindow({
    width: 560,
    height: 620,
    parent: parent || undefined,
    autoHideMenuBar: true,
    title: 'Settings',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'ui.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  win.on('closed', () => {
    win = null;
  });
  return win;
}

module.exports = { openSettings };
