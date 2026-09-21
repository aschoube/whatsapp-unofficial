'use strict';

const { Menu, shell } = require('electron');

// Without an application menu the standard editing and zoom accelerators are
// not registered, so Ctrl+C/V and Ctrl+Q stop working in the embedded views.
function buildMenu({ accounts, mainWindow, i18n, onSettings, onQuit }) {
  const t = (key) => i18n.t(key);

  const menu = Menu.buildFromTemplate([
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.settings'), accelerator: 'CmdOrCtrl+,', click: onSettings },
        { label: t('menu.reload'), accelerator: 'CmdOrCtrl+R', click: () => accounts.reloadActive() },
        { type: 'separator' },
        { label: t('menu.hide'), accelerator: 'CmdOrCtrl+W', click: () => mainWindow.toggle() },
        { label: t('menu.quit'), accelerator: 'CmdOrCtrl+Q', click: onQuit }
      ]
    },
    { label: t('menu.edit'), submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ] },
    { label: t('menu.view'), submenu: [
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' }
    ] },
    {
      label: t('menu.help'),
      submenu: [
        {
          label: t('menu.project'),
          click: () => shell.openExternal('https://github.com/aschoube/whatsapp-unofficial')
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { buildMenu };
