'use strict';

const { app, ipcMain, dialog } = require('electron');
const { Config } = require('./config');
const { I18n, available } = require('./i18n');
const { AccountManager } = require('./accounts');
const { MainWindow } = require('./window');
const { AppTray } = require('./tray');
const { buildMenu } = require('./menu');
const { openSettings } = require('./settings-window');
const { chromeUserAgent } = require('./user-agent');
const { acquireSingleInstance } = require('./single-instance');

// Wayland sessions need this hint or the window misbehaves. Harmless on X11.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

// Must happen before any window exists -- set it later and the first request
// has already gone out advertising Electron, which is what triggers the
// "unsupported browser" page.
app.userAgentFallback = chromeUserAgent();

let config;
let i18n;
let accounts;
let mainWindow;
let tray;

function quit() {
  if (mainWindow) mainWindow.quitting = true;
  app.quit();
}

function showSettings() {
  openSettings(null);
}

function warnIfNoTray() {
  if (tray.available || !config.get('prefs.closeToTray')) return;
  // Closing to a tray that does not exist would make the window unrecoverable.
  config.set('prefs.closeToTray', false);
  dialog.showMessageBox({
    type: 'info',
    title: i18n.t('tray.missing.title'),
    message: i18n.t('tray.missing.message'),
    detail: i18n.t('tray.missing.detail'),
    buttons: ['OK']
  }).catch(() => {});
}

function registerIpc() {
  ipcMain.handle('accounts:list', () =>
    accounts.list().map((account) => ({
      ...account,
      unread: accounts.unreadFor(account.id),
      active: account.id === accounts.activeId
    })));

  ipcMain.handle('accounts:activate', (_event, id) => {
    accounts.activate(id);
    mainWindow.refreshSidebar();
  });

  ipcMain.handle('accounts:add', (_event, name) => {
    const account = config.addAccount(name);
    accounts.activate(account.id);
    mainWindow.refreshSidebar();
    tray.rebuild();
    return account;
  });

  ipcMain.handle('accounts:remove', (_event, id) => {
    accounts.remove(id);
    mainWindow.refreshSidebar();
    tray.rebuild();
  });

  ipcMain.handle('accounts:rename', (_event, id, name) => {
    config.renameAccount(id, name);
    mainWindow.refreshSidebar();
    tray.rebuild();
  });

  ipcMain.handle('settings:get', () => ({
    prefs: config.get('prefs'),
    accounts: config.accounts,
    locales: available(),
    trayAvailable: tray.available,
    versions: {
      app: app.getVersion(),
      electron: process.versions.electron,
      chromium: process.versions.chrome
    }
  }));

  ipcMain.handle('settings:set', (_event, key, value) => {
    config.set(`prefs.${key}`, value);
    if (key === 'closeToTray' && value === true) warnIfNoTray();
    return config.get('prefs');
  });

  ipcMain.handle('settings:open', () => showSettings());
}

app.whenReady().then(async () => {
  // Our own lock, not Electron's: Electron's keeps its socket under /tmp,
  // which Flatpak makes private per instance, so every launch would start
  // another copy on the same Chromium profile and corrupt it.
  const primary = await acquireSingleInstance(() => {
    if (mainWindow) mainWindow.show();
  });

  if (!primary) {
    app.quit();
    return;
  }

  config = new Config();
  i18n = new I18n(config.get('prefs.locale'));
  accounts = new AccountManager(config);
  mainWindow = new MainWindow(config, accounts);

  tray = new AppTray({
    config,
    accounts,
    mainWindow,
    i18n,
    onSettings: showSettings,
    onQuit: quit
  });

  buildMenu({ accounts, mainWindow, i18n, onSettings: showSettings, onQuit: quit });
  registerIpc();

  accounts.on('unread-changed', (total) => {
    tray.setUnread(total);
    mainWindow.refreshSidebar();
  });

  accounts.activate(config.accounts[0].id);
  mainWindow.layout();
  mainWindow.refreshSidebar();

  if (!config.get('prefs.startMinimized')) mainWindow.show();
  warnIfNoTray();
});

app.on('window-all-closed', () => {
  // With close-to-tray off there is no tray to restore from, so the app
  // should actually exit rather than linger with no visible surface.
  if (!config || !config.get('prefs.closeToTray')) app.quit();
});

app.on('before-quit', () => {
  if (mainWindow) mainWindow.quitting = true;
  if (tray) tray.destroy();
});
