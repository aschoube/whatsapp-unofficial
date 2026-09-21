'use strict';

const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

const ICONS = path.join(__dirname, '..', '..', 'build');

function icon(name) {
  const image = nativeImage.createFromPath(path.join(ICONS, name));
  return image.isEmpty() ? nativeImage.createEmpty() : image;
}

// GNOME shows no tray at all without the AppIndicator extension, and a good
// share of users do not have it. We report whether the tray was actually
// created so the app can warn instead of silently hiding into nothing.
class AppTray {
  constructor({ config, accounts, mainWindow, i18n, onSettings, onQuit }) {
    this.config = config;
    this.accounts = accounts;
    this.mainWindow = mainWindow;
    this.i18n = i18n;
    this.onSettings = onSettings;
    this.onQuit = onQuit;
    this.tray = null;

    try {
      this.tray = new Tray(icon('tray.png'));
      this.tray.setToolTip('WhatsApp Unofficial');
      this.tray.on('click', () => this.mainWindow.toggle());
      this.rebuild();
    } catch {
      this.tray = null;
    }
  }

  get available() {
    return this.tray !== null;
  }

  rebuild() {
    if (!this.tray) return;
    const t = (key, vars) => this.i18n.t(key, vars);

    const accountItems = this.accounts.list().map((account) => {
      const unread = this.accounts.unreadFor(account.id);
      return {
        label: unread > 0 ? `${account.name} (${unread})` : account.name,
        type: 'radio',
        checked: account.id === this.accounts.activeId,
        click: () => {
          this.accounts.activate(account.id);
          this.mainWindow.show();
        }
      };
    });

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t('tray.toggle'), click: () => this.mainWindow.toggle() },
        { type: 'separator' },
        ...accountItems,
        { type: 'separator' },
        { label: t('tray.settings'), click: () => this.onSettings() },
        { label: t('tray.reload'), click: () => this.accounts.reloadActive() },
        { type: 'separator' },
        { label: t('tray.quit'), click: () => this.onQuit() }
      ])
    );
  }

  setUnread(total) {
    if (this.tray) {
      this.tray.setImage(icon(total > 0 ? 'tray-unread.png' : 'tray.png'));
      this.tray.setToolTip(
        total > 0 ? this.i18n.t('tray.unread', { count: total }) : 'WhatsApp Unofficial'
      );
    }
    // Unity/KDE launcher badge. Harmless where unsupported.
    if (typeof app.setBadgeCount === 'function') app.setBadgeCount(total);
    this.rebuild();
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { AppTray };
